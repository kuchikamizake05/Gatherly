import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import { createToken } from "../../lib/crypto.js";
import { OrganizerApplication } from "../applications/application.models.js";
import { applicationDto, usernameAvailable } from "../applications/application.routes.js";
import { applicationFlagSchema } from "../applications/application.schemas.js";
import { Organizer } from "../organizers/organizer.model.js";
import { User } from "../auth/auth.models.js";
import { Event, TicketType } from "../events/event.models.js";
import { Order } from "../orders/order.model.js";
import { WorkspaceAccount } from "../workspace/workspace.models.js";
import { temporaryCredentials, setTemporaryPassword } from "../workspace/workspace.routes.js";
import { signedDocumentUrl, StorageAsset } from "../storage/storage.service.js";
import { queueEmail } from "../notifications/email.service.js";
import { requireAdmin, type AdminRequest } from "./admin.middleware.js";
import { AuditLog } from "./admin.models.js";

export const adminOrganizersRouter = Router();
adminOrganizersRouter.use(requireAdmin);
const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  q: z.string().max(100).optional(),
  tab: z.string().max(30).optional(),
  type: z.string().max(30).optional(),
});
function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function paginated<T>(data: T[], total: number, page: number) {
  return { data, meta: { page, limit: 20, total } };
}
function id(value: unknown) {
  const s = String(value);
  if (!mongoose.Types.ObjectId.isValid(s))
    throw new AppError(404, "NOT_FOUND", "Resource not found.");
  return s;
}
async function application(req: AdminRequest) {
  const app = await OrganizerApplication.findById(id(req.params.id));
  if (!app) throw new AppError(404, "NOT_FOUND", "Application not found.");
  return app;
}
async function reviewable(req: AdminRequest) {
  const app = await application(req);
  if (!["new", "fix_submitted"].includes(app.status))
    throw new AppError(409, "REVIEW_CONFLICT", "Application is no longer awaiting review.");
  return app;
}
async function audit(req: AdminRequest, action: string, targetId: string, note?: string) {
  await AuditLog.create({ actorId: req.admin!.id, action, targetId, note });
}

adminOrganizersRouter.get(
  "/applications",
  asyncHandler(async (req, res) => {
    const query = pageQuery.parse(req.query);
    const filter: Record<string, unknown> = {};
    if (query.tab)
      filter.status = query.tab === "new" ? { $in: ["new", "fix_submitted"] } : query.tab;
    if (query.type) filter.organizerType = query.type;
    if (query.q)
      filter.$or = [
        { organizerName: new RegExp(escaped(query.q), "i") },
        { number: new RegExp(escaped(query.q), "i") },
      ];
    const [apps, total, newCount, needs_fix, approved, rejected] = await Promise.all([
      OrganizerApplication.find(filter)
        .sort({ submittedAt: -1 })
        .skip((query.page - 1) * 20)
        .limit(20),
      OrganizerApplication.countDocuments(filter),
      OrganizerApplication.countDocuments({ status: { $in: ["new", "fix_submitted"] } }),
      OrganizerApplication.countDocuments({ status: "needs_fix" }),
      OrganizerApplication.countDocuments({ status: "approved" }),
      OrganizerApplication.countDocuments({ status: "rejected" }),
    ]);
    res.json({
      ...paginated(
        apps.map((a) => ({
          id: a.id,
          number: a.number,
          organizerName: a.organizerName,
          type: a.organizerType,
          submittedAt: a.submittedAt,
          status: a.status,
        })),
        total,
        query.page,
      ),
      counts: { new: newCount, needs_fix, approved, rejected },
    });
  }),
);
adminOrganizersRouter.get(
  "/applications.csv",
  asyncHandler(async (req, res) => {
    const apps = await OrganizerApplication.find().sort({ submittedAt: -1 }).limit(10000);
    const cell = (s: unknown) =>
      `"${String(s ?? "")
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""')}"`;
    res
      .type("text/csv")
      .attachment("gatherly-applications.csv")
      .send(
        [
          "number,name,type,status,submittedAt",
          ...apps.map((a) =>
            [a.number, a.organizerName, a.organizerType, a.status, a.submittedAt.toISOString()]
              .map(cell)
              .join(","),
          ),
        ].join("\r\n"),
      );
  }),
);
adminOrganizersRouter.get(
  "/applications/:id",
  asyncHandler(async (req, res) => {
    const app = await application(req as AdminRequest);
    const documents = await Promise.all(
      (
        [
          ["ktp", app.ktp],
          ["legal", app.legalDocument],
        ] as const
      )
        .filter(([, doc]) => Boolean(doc?.id))
        .map(async ([kind, doc]) => ({
          kind,
          fileName: doc!.name,
          size: doc!.size,
          uploadedAt: app.createdAt,
          url: await signedDocumentUrl(doc!.id!),
        })),
    );
    await audit(req as AdminRequest, "application.documents.viewed", app.id);
    const history = await AuditLog.find({ targetId: app.id }).sort({ createdAt: -1 }).limit(100);
    res.json({
      data: {
        ...applicationDto(app),
        documents,
        checks: {
          emailVerified: Boolean(app.emailVerifiedAt),
          usernameAvailable: await usernameAvailable(app.username),
          similarOrganizers: await Organizer.countDocuments({
            name: new RegExp(`^${escaped(app.organizerName)}$`, "i"),
          }),
        },
        history: history.map((h) => ({ action: h.action, by: h.actorId, at: h.createdAt })),
      },
    });
  }),
);
adminOrganizersRouter.post(
  "/applications/:id/request-fix",
  asyncHandler(async (req, res) => {
    const { flags } = applicationFlagSchema.parse(req.body);
    const app = await reviewable(req as AdminRequest);
    const deadline = new Date(Date.now() + 14 * 86400_000);
    const result = await OrganizerApplication.updateOne(
      { _id: app._id, status: app.status, version: app.version },
      { $set: { flags, status: "needs_fix", fixDeadline: deadline }, $inc: { version: 1 } },
    );
    if (!result.modifiedCount)
      throw new AppError(409, "REVIEW_CONFLICT", "Application was reviewed by another admin.");
    await audit(req as AdminRequest, "application.request_fix", app.id);
    await queueEmail({
      key: `application-fix:${app.id}:${app.version + 1}`,
      to: app.pic!.email!,
      subject: "Perbaikan pengajuan organizer Gatherly",
      text: `Pengajuan ${app.number} memerlukan perbaikan paling lambat ${deadline.toISOString()}.\n${flags.map((f) => `${f.field} — ${f.note}`).join("\n")}`,
    });
    res.sendStatus(204);
  }),
);
adminOrganizersRouter.post(
  "/applications/:id/reject",
  asyncHandler(async (req, res) => {
    const { reason } = z.object({ reason: z.string().trim().min(5).max(2000) }).parse(req.body);
    const app = await reviewable(req as AdminRequest);
    const now = new Date();
    const result = await OrganizerApplication.updateOne(
      { _id: app._id, status: app.status, version: app.version },
      {
        $set: {
          status: "rejected",
          rejectionReason: reason,
          decidedAt: now,
          documentsExpireAt: new Date(now.getTime() + 90 * 86400_000),
        },
        $inc: { version: 1 },
        $unset: { activeEmail: 1, editTokenHash: 1, editTokenExpiresAt: 1 },
      },
    );
    if (!result.modifiedCount)
      throw new AppError(409, "REVIEW_CONFLICT", "Application was reviewed by another admin.");
    await StorageAsset.updateMany(
      { _id: { $in: [app.ktp?.id, app.legalDocument?.id].filter(Boolean) } },
      { $set: { deleteAfter: new Date(now.getTime() + 90 * 86400_000) } },
    );
    await audit(req as AdminRequest, "application.rejected", app.id, reason);
    await queueEmail({
      key: `application-rejected:${app.id}`,
      to: app.pic!.email!,
      subject: "Hasil pengajuan organizer Gatherly",
      text: `Pengajuan ${app.number} ditolak. ${reason}. Anda dapat mengajukan kembali setelah 30 hari.`,
    });
    res.sendStatus(204);
  }),
);
adminOrganizersRouter.post(
  "/applications/:id/approve",
  asyncHandler(async (req, res) => {
    const app = await reviewable(req as AdminRequest);
    // Every flagged field must have been resubmitted before approval.
    if (!app.emailVerifiedAt)
      throw new AppError(409, "EMAIL_NOT_VERIFIED", "PIC email must be verified before approval.");
    if (app.status === "new" && app.flags.length)
      throw new AppError(409, "FLAGS_EXIST", "Resolve flagged fields before approval.");
    if (!(await usernameAvailable(app.username)))
      throw new AppError(409, "USERNAME_TAKEN", "Username is unavailable.");
    const credentials = temporaryCredentials(app.username),
      passwordHash = await bcrypt.hash(credentials.temporaryPassword, 12);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const now = new Date();
        const changed = await OrganizerApplication.updateOne(
          { _id: app._id, status: app.status, version: app.version },
          {
            $set: {
              status: "approved",
              decidedAt: now,
              documentsExpireAt: new Date(now.getTime() + 90 * 86400_000),
              flags: [],
            },
            $inc: { version: 1 },
            $unset: { activeEmail: 1 },
          },
          { session },
        );
        if (!changed.modifiedCount)
          throw new AppError(409, "REVIEW_CONFLICT", "Application was reviewed by another admin.");
        await StorageAsset.updateMany(
          { _id: { $in: [app.ktp?.id, app.legalDocument?.id].filter(Boolean) } },
          { $set: { deleteAfter: new Date(now.getTime() + 90 * 86400_000) } },
          { session },
        );
        const [user] = await User.create(
          [{ name: app.pic!.name!, emailNormalized: `${createToken()}@workspace.invalid` }],
          { session },
        );
        const organizer = new Organizer({
          ownerId: user!._id,
          name: app.organizerName,
          description: app.description,
          contactEmail: app.pic!.email!,
          username: app.username,
          city: app.address!.city!,
          links: app.links.map((link) => ({ type: link.type ?? "lainnya", url: link.url ?? "" })),
          status: "never_logged_in",
          applicationNumber: app.number,
          pic: {
            name: app.pic!.name!,
            role: app.pic!.role!,
            email: app.pic!.email!,
            phone: app.pic!.phone!,
          },
        });
        await organizer.save({ session });
        await WorkspaceAccount.create(
          [
            {
              userId: user!._id,
              organizerId: organizer._id,
              username: app.username,
              name: app.pic!.name!,
              role: "organizer",
              email: app.pic!.email!,
              passwordHash,
              temporaryExpiresAt: credentials.expiresAt,
            },
          ],
          { session },
        );
        await AuditLog.create(
          [
            {
              actorId: (req as AdminRequest).admin!.id,
              action: "application.approved",
              targetId: app.id,
            },
          ],
          { session },
        );
        await queueEmail(
          {
            key: `application-approved:${app.id}`,
            to: app.pic!.email!,
            subject: "Pengajuan organizer Gatherly disetujui",
            text: `Pengajuan ${app.number} disetujui. Username ${app.username}. Password sementara ${credentials.temporaryPassword}. Berlaku sampai ${credentials.expiresAt.toISOString()}. Ganti password saat login pertama.`,
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }
    res.sendStatus(204);
  }),
);

async function organizerStats(organizer: InstanceType<typeof Organizer>) {
  const events = await Event.find({ organizerId: organizer._id });
  const ids = events.map((e) => e._id);
  const totals = await Order.aggregate([
    { $match: { eventId: { $in: ids }, paymentStatus: "paid" } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } },
  ]);
  return {
    id: organizer.id,
    name: organizer.name,
    username: organizer.username ?? "",
    status: organizer.status,
    activeEvents: events.filter((e) => e.endsAt > new Date() && e.publicationStatus === "published")
      .length,
    grossSales: Number(totals[0]?.total ?? 0),
    events,
  };
}
adminOrganizersRouter.get(
  "/organizers",
  asyncHandler(async (req, res) => {
    const query = pageQuery.parse(req.query),
      filter: Record<string, unknown> = {};
    if (query.tab) filter.status = query.tab;
    if (query.q)
      filter.$or = ["name", "username", "contactEmail"].map((field) => ({
        [field]: new RegExp(escaped(query.q!), "i"),
      }));
    const [orgs, total, active, never_logged_in, frozen] = await Promise.all([
      Organizer.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * 20)
        .limit(20),
      Organizer.countDocuments(filter),
      Organizer.countDocuments({ status: "active" }),
      Organizer.countDocuments({ status: "never_logged_in" }),
      Organizer.countDocuments({ status: "frozen" }),
    ]);
    const rows = await Promise.all(
      orgs.map(async (o) => {
        const { events: _, ...row } = await organizerStats(o);
        return row;
      }),
    );
    res.json({
      ...paginated(rows, total, query.page),
      counts: { active, never_logged_in, frozen },
    });
  }),
);
async function ownedOrganizer(req: AdminRequest) {
  const org = await Organizer.findById(id(req.params.id));
  if (!org) throw new AppError(404, "NOT_FOUND", "Organizer not found.");
  return org;
}
adminOrganizersRouter.get(
  "/organizers/:id",
  asyncHandler(async (req, res) => {
    const org = await ownedOrganizer(req as AdminRequest),
      stats = await organizerStats(org);
    const history = await AuditLog.find({ targetId: org.id }).sort({ createdAt: -1 }).limit(100);
    const events = await Promise.all(
      stats.events.map(async (e) => {
        const tickets = await TicketType.find({ eventId: e._id });
        return {
          id: e.id,
          title: e.title,
          startsAt: e.startsAt,
          sold: tickets.reduce((n, t) => n + t.sold, 0),
          capacity: tickets.reduce((n, t) => n + t.capacity, 0),
          status: e.publicationStatus,
        };
      }),
    );
    res.json({
      data: {
        ...stats,
        events,
        joinedAt: org.createdAt,
        applicationNumber: org.applicationNumber ?? "",
        totalEvents: events.length,
        completedEvents: stats.events.filter((e) => e.endsAt <= new Date()).length,
        pic: org.pic ?? { name: org.name, role: "", email: org.contactEmail, phone: "" },
        frozenReason: org.frozenReason,
        activity: history.map((h) => ({ action: h.action, at: h.createdAt })),
        reportCount: 0,
      },
    });
  }),
);
adminOrganizersRouter.post(
  "/organizers/:id/freeze",
  asyncHandler(async (req, res) => {
    const { reason } = z.object({ reason: z.string().trim().min(5).max(2000) }).parse(req.body);
    const org = await ownedOrganizer(req as AdminRequest);
    org.status = "frozen";
    org.frozenReason = reason;
    await org.save();
    await audit(req as AdminRequest, "organizer.frozen", org.id, reason);
    res.sendStatus(204);
  }),
);
adminOrganizersRouter.post(
  "/organizers/:id/unfreeze",
  asyncHandler(async (req, res) => {
    const org = await ownedOrganizer(req as AdminRequest);
    const account = await WorkspaceAccount.findOne({ organizerId: org._id, role: "organizer" });
    org.status = account?.lastLoginAt ? "active" : "never_logged_in";
    org.frozenReason = undefined;
    await org.save();
    await audit(req as AdminRequest, "organizer.unfrozen", org.id);
    res.sendStatus(204);
  }),
);
adminOrganizersRouter.post(
  "/organizers/:id/resend-access",
  asyncHandler(async (req, res) => {
    const org = await ownedOrganizer(req as AdminRequest);
    const account = await WorkspaceAccount.findOne({
      organizerId: org._id,
      role: "organizer",
      lastLoginAt: { $exists: false },
    });
    if (!account) throw new AppError(409, "ALREADY_LOGGED_IN", "Organizer has already signed in.");
    const credentials = await setTemporaryPassword(account);
    await queueEmail({
      key: `organizer-resend:${org.id}:${credentials.expiresAt.getTime()}`,
      to: org.contactEmail,
      subject: "Akses organizer Gatherly",
      text: `Username ${account.username}. Password sementara ${credentials.temporaryPassword}. Berlaku sampai ${credentials.expiresAt.toISOString()}.`,
    });
    await audit(req as AdminRequest, "organizer.access_resent", org.id);
    res.sendStatus(204);
  }),
);
