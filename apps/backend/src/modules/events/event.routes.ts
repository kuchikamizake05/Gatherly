import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";

import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import { requireCsrf, requireSession, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import { requireOrganizer } from "../authorization/authorization.middleware.js";
import { CommitteeAssignment } from "../committee/committee-assignment.model.js";
import { Order } from "../orders/order.model.js";
import { requestEventCancellation, requestOrganizerRefund } from "../refunds/refund.service.js";
import { queueEmail } from "../notifications/email.service.js";
import { scheduleChangedEmail } from "../notifications/email-templates.js";
import { notifyOrderTickets, resendBatchKey } from "../notifications/tickets.js";
import { env } from "../../config/env.js";
import { publishUpdate } from "../realtime/events.js";
import { StorageAsset, claimUploads } from "../storage/storage.service.js";
import mongoose from "mongoose";
import { WorkspaceAccount } from "../workspace/workspace.models.js";
import { Event, TicketType } from "./event.models.js";

const date = z.coerce.date();
const eventSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().min(1).max(5_000),
    category: z.string().trim().min(2).max(80),
    startsAt: date,
    endsAt: date,
    timezone: z.string().trim().min(1).max(100),
    venueName: z.string().trim().min(2).max(160),
    address: z.string().trim().min(2).max(300),
    city: z.string().trim().min(2).max(100),
    posterAssetId: z.string().trim().min(1).optional(),
    locationType: z.enum(["offline", "online"]).default("offline"),
    terms: z.array(z.string().trim().min(1).max(1000)).max(30).default([]),
    performerLabel: z.string().trim().min(1).max(80).default("Performers"),
    performers: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(100),
          note: z.string().max(500).default(""),
          time: z.string().max(30).default(""),
          photoAssetId: z.string().optional(),
          photoUrl: z.string().url().optional(),
        }),
      )
      .max(100)
      .default([]),
    showRemaining: z.boolean().default(true),
    checkInOpensAt: date.optional(),
    checkInClosesAt: date.optional(),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  });
const eventUpdateSchema = eventSchema
  .innerType()
  .partial()
  .extend({ salesClosed: z.boolean().optional() });

/**
 * Draf boleh disimpan sebelum lengkap: cukup nama acara. Teks kosong diterima dan tanggal kosong
 * diabaikan. Kelengkapan diperiksa dengan eventSchema saat diterbitkan.
 */
const blank = (value: unknown) => (value === "" || value === null ? undefined : value);
const draftDate = z.preprocess(blank, date.optional());
const draftObject = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5_000).optional(),
  category: z.string().trim().max(80).optional(),
  startsAt: draftDate,
  endsAt: draftDate,
  timezone: z.string().trim().min(1).max(100).optional(),
  venueName: z.string().trim().max(160).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(100).optional(),
  posterAssetId: z.preprocess(blank, z.string().trim().min(1).optional()),
  locationType: z.enum(["offline", "online"]).default("offline"),
  terms: z.array(z.string().trim().max(1000)).max(30).default([]),
  performerLabel: z.string().trim().min(1).max(80).default("Performers"),
  performers: eventSchema.innerType().shape.performers,
  showRemaining: z.boolean().default(true),
  checkInOpensAt: draftDate,
  checkInClosesAt: draftDate,
});
const draftSchema = draftObject.refine(
  (data) => !data.startsAt || !data.endsAt || data.endsAt > data.startsAt,
  { message: "endsAt must be after startsAt", path: ["endsAt"] },
);
const draftUpdateSchema = draftObject.partial().extend({ salesClosed: z.boolean().optional() });

/** Field acara yang diperiksa ulang dengan eventSchema saat terbit atau saat acara terbit diubah. */
function completeFields(event: any) {
  return {
    title: event.title,
    description: event.description ?? "",
    category: event.category ?? "",
    startsAt: event.startsAt ?? "",
    endsAt: event.endsAt ?? "",
    timezone: event.timezone,
    venueName: event.venueName ?? "",
    address: event.address ?? "",
    city: event.city ?? "",
    posterAssetId: event.posterAssetId ?? undefined,
    locationType: event.locationType,
    terms: event.terms ?? [],
    performerLabel: event.performerLabel,
    performers: (event.performers ?? []).map((p: any) => ({
      name: p.name,
      note: p.note ?? "",
      time: p.time ?? "",
      photoAssetId: p.photoAssetId ?? undefined,
      photoUrl: /^https?:\/\//.test(p.photoUrl ?? "") ? p.photoUrl : undefined,
    })),
    showRemaining: event.showRemaining,
    checkInOpensAt: event.checkInOpensAt ?? undefined,
    checkInClosesAt: event.checkInClosesAt ?? undefined,
  };
}
const ticketSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).default(""),
  price: z.number().int().nonnegative(),
  capacity: z.number().int().positive(),
  salesStartsAt: date,
  salesEndsAt: date,
});

async function validateEventUploads(
  input: { posterAssetId?: string; performers?: { photoAssetId?: string; photoUrl?: string }[] },
  userId: string,
) {
  const ids = [input.posterAssetId, ...(input.performers ?? []).map((p) => p.photoAssetId)].filter(
    (id): id is string => !!id,
  );
  for (const id of ids) {
    if (
      !Types.ObjectId.isValid(id) ||
      !(await StorageAsset.exists({
        _id: id,
        ownerId: userId,
        private: false,
        type: { $in: ["image/png", "image/jpeg", "image/webp"] },
      }))
    )
      throw new AppError(400, "INVALID_ASSET", "Select an image uploaded by this organizer.");
  }
  if (ids.length) await claimUploads(ids, userId);
  for (const performer of input.performers ?? [])
    if (performer.photoAssetId) performer.photoUrl = `/api/v1/media/${performer.photoAssetId}`;
}
function validateCheckInWindow(event: {
  startsAt?: Date;
  endsAt?: Date;
  checkInOpensAt?: Date;
  checkInClosesAt?: Date;
  timezone?: string;
}) {
  if (!event.startsAt || !event.endsAt) return;
  try {
    if (event.timezone) new Intl.DateTimeFormat("en", { timeZone: event.timezone }).format();
  } catch {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid event timezone.");
  }
  const opens = event.checkInOpensAt ?? new Date(event.startsAt.getTime() - 2 * 3600000);
  const closes = event.checkInClosesAt ?? event.endsAt;
  if (opens >= closes || closes > event.endsAt)
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Check-in must open before closing and close no later than event end.",
    );
}
function invalid(result: { success: false; error?: z.ZodError }) {
  const fields = result.error
    ? Object.fromEntries(
        result.error.issues.map((issue) => [issue.path.join(".") || "request", issue.message]),
      )
    : undefined;
  throw new AppError(400, "VALIDATION_ERROR", "Please check the submitted fields.", fields);
}
function slugify(value: string) {
  return `${value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}-${Math.random().toString(36).slice(2, 8)}`;
}
function dto(event: any) {
  return {
    posterUrl: event.posterAssetId ? `/api/v1/media/${event.posterAssetId}` : null,
    locationType: event.locationType ?? "offline",
    terms: event.terms ?? [],
    performerLabel: event.performerLabel ?? "Performers",
    performers: event.performers ?? [],
    showRemaining: event.showRemaining ?? true,
    checkInOpensAt:
      event.checkInOpensAt ??
      (event.startsAt ? new Date(event.startsAt.getTime() - 2 * 3600000) : null),
    checkInClosesAt: event.checkInClosesAt ?? event.endsAt ?? null,
    cancellationStatus: event.cancellationStatus ?? null,
    cancellationReason: event.cancellationReason ?? null,
    updatedAt: event.updatedAt,
    status:
      event.publicationStatus === "cancelled"
        ? "cancelled"
        : event.publicationStatus === "draft"
          ? "draft"
          : event.endsAt && event.endsAt <= new Date()
            ? "ended"
            : event.salesClosed
              ? "scheduled"
              : "on_sale",
    id: event._id.toString(),
    slug: event.slug,
    title: event.title,
    description: event.description,
    category: event.category,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
    venueName: event.venueName,
    address: event.address,
    city: event.city,
    posterAssetId: event.posterAssetId ?? null,
    publicationStatus: event.publicationStatus,
    salesClosed: event.salesClosed,
  };
}
async function owned(request: AuthenticatedRequest) {
  const id = String(request.params.id);
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, "NOT_FOUND", "Event not found.");
  const event = await Event.findOne({ _id: id, organizerId: request.auth!.organizerId });
  if (!event) throw new AppError(404, "NOT_FOUND", "Event not found.");
  return event;
}

export const eventRouter = Router();
eventRouter.use(requireSession, requireOrganizer);
eventRouter.get(
  "/",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const events = await Event.find({ organizerId: request.auth!.organizerId }).sort({
      startsAt: -1,
    });
    const data = [];
    for (const event of events) {
      const types = await TicketType.find({ eventId: event._id });
      const orders = await Order.find({ eventId: event._id, paymentStatus: "paid" }).select(
        "subtotalAmount unitPrice quantity refundedBaseAmount",
      );
      data.push({
        ...dto(event),
        startsAt: event.startsAt ?? null,
        sold: types.reduce((n, t) => n + t.sold, 0),
        capacity: types.reduce((n, t) => n + t.capacity, 0),
        gross: orders.reduce(
          (n, o) =>
            n + (o.subtotalAmount ?? o.unitPrice * o.quantity) - (o.refundedBaseAmount ?? 0),
          0,
        ),
      });
    }
    response.json({ data, meta: { page: 1, limit: data.length, total: data.length } });
  }),
);
eventRouter.post(
  "/",
  requireCsrf,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const parsed = draftSchema.safeParse(request.body);
    if (!parsed.success) invalid(parsed);
    if (parsed.data!.startsAt && parsed.data!.startsAt <= new Date())
      throw new AppError(400, "VALIDATION_ERROR", "The event must start in the future.", {
        startsAt: "The event must start in the future.",
      });
    validateCheckInWindow(parsed.data!);
    await validateEventUploads(parsed.data!, request.auth!.user._id);
    const event = await Event.create({
      ...parsed.data!,
      organizerId: new Types.ObjectId(request.auth!.organizerId),
      slug: slugify(parsed.data!.title),
    });
    response.status(201).json({ data: dto(event) });
  }),
);
eventRouter.get(
  "/:id",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const event = await owned(request);
    const types = await TicketType.find({ eventId: event._id });
    response.json({
      data: {
        ...dto(event),
        ticketTypes: types.map((t) => ({
          ...t.toObject(),
          id: t._id.toString(),
          available: t.capacity - t.sold - t.reserved,
        })),
      },
    });
  }),
);
eventRouter.patch(
  "/:id",
  requireCsrf,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const event = await owned(request);
    const parsed = (
      event.publicationStatus === "draft" ? draftUpdateSchema : eventUpdateSchema
    ).safeParse(request.body);
    if (!parsed.success) invalid(parsed);
    if (event.publicationStatus === "cancelled")
      throw new AppError(409, "EVENT_CANCELLED", "Cancelled events cannot be changed.");
    const changedSchedule = ["startsAt", "endsAt", "venueName", "address", "city"].some(
      (k) => k in parsed.data! && String((event as any)[k]) !== String((parsed.data as any)[k]),
    );
    await validateEventUploads(parsed.data!, request.auth!.user._id);
    Object.assign(event, parsed.data!);
    if (event.publicationStatus !== "draft") {
      const complete = eventSchema.safeParse(completeFields(event));
      if (!complete.success) invalid(complete);
    }
    validateCheckInWindow(event);
    if (event.startsAt && event.endsAt && event.endsAt <= event.startsAt)
      throw new AppError(400, "VALIDATION_ERROR", "endsAt must be after startsAt", {
        endsAt: "endsAt must be after startsAt",
      });
    event.checkoutVersion += 1;
    await event.save();
    if (changedSchedule) {
      const orders = await Order.find({ eventId: event._id, paymentStatus: "paid" });
      for (const order of orders)
        for (const email of new Set([
          order.buyerSnapshot.email,
          ...order.attendees.map((a) => a.email).filter((e): e is string => !!e),
        ]))
          await queueEmail(
            scheduleChangedEmail(
              `schedule-${event._id}-${event.checkoutVersion}-${order._id}-${email}`,
              email,
              event.title,
              `${env.PUBLIC_WEB_URL}/tickets`,
            ),
          );
    }
    await publishUpdate({ topic: "event", id: event._id.toString(), type: "event.updated" });
    response.json({ data: dto(event) });
  }),
);
eventRouter.delete(
  "/:id",
  requireCsrf,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const event = await owned(request);
    if (event.publicationStatus !== "draft")
      throw new AppError(409, "CONFLICT", "Only draft events can be deleted.");
    if (await Order.exists({ eventId: event._id }))
      throw new AppError(409, "HAS_ORDERS", "Events with orders cannot be deleted.");
    await TicketType.deleteMany({ eventId: event._id });
    await event.deleteOne();
    response.status(204).send();
  }),
);
eventRouter.post(
  "/:id/publish",
  requireCsrf,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const event = await owned(request);
    if (event.publicationStatus === "cancelled")
      throw new AppError(409, "EVENT_CANCELLED", "Cancelled events cannot be republished.");
    const types = await TicketType.find({ eventId: event._id });
    if (event.publicationStatus === "draft") {
      const complete = eventSchema.safeParse(completeFields(event));
      if (!complete.success) invalid(complete);
      if (event.startsAt <= new Date())
        throw new AppError(400, "VALIDATION_ERROR", "The event must start in the future.", {
          startsAt: "The event must start in the future.",
        });
      validateCheckInWindow(event);
      if (types.some((t) => t.salesEndsAt > event.startsAt))
        throw new AppError(400, "VALIDATION_ERROR", "Ticket sales must end before the event starts.", {
          ticketTypes: "Ticket sales must end before the event starts.",
        });
    }
    if (!event.posterAssetId || types.length === 0)
      throw new AppError(409, "CONFLICT", "A poster and at least one ticket type are required.");
    event.publicationStatus = "published";
    event.checkoutVersion += 1;
    await event.save();
    response.json({ data: dto(event) });
  }),
);
eventRouter.post(
  "/:id/ticket-types",
  requireCsrf,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const event = await owned(request);
    const parsed = ticketSchema.safeParse(request.body);
    if (!parsed.success) invalid(parsed);
    if (
      parsed.data!.salesEndsAt <= parsed.data!.salesStartsAt ||
      (event.startsAt && parsed.data!.salesEndsAt > event.startsAt)
    )
      throw new AppError(400, "VALIDATION_ERROR", "Invalid ticket sales period.");
    const ticket = await TicketType.create({ ...parsed.data!, eventId: event._id });
    response
      .status(201)
      .json({ data: { id: ticket._id.toString(), ...parsed.data!, available: ticket.capacity } });
  }),
);
eventRouter.patch(
  "/:id/ticket-types/:typeId",
  requireCsrf,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const ownedEvent = await owned(request);
    const parsed = ticketSchema.partial().safeParse(request.body);
    if (!parsed.success) invalid(parsed);
    const session = await mongoose.startSession();
    let result: any;
    try {
      await session.withTransaction(async () => {
        const event = await Event.findOneAndUpdate(
          { _id: ownedEvent._id, publicationStatus: { $ne: "cancelled" } },
          { $inc: { checkoutVersion: 1 } },
          { session, returnDocument: "after" },
        );
        if (!event)
          throw new AppError(409, "EVENT_CANCELLED", "Cancelled events cannot be changed.");
        const ticket = await TicketType.findOne({
          _id: request.params.typeId,
          eventId: event._id,
        }).session(session);
        if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket type not found.");
        if (
          parsed.data!.capacity !== undefined &&
          parsed.data!.capacity < ticket.sold + ticket.reserved
        )
          throw new AppError(409, "CONFLICT", "Capacity cannot be below sold or reserved tickets.");
        Object.assign(ticket, parsed.data!);
        if (ticket.salesEndsAt <= ticket.salesStartsAt || ticket.salesEndsAt > event.startsAt)
          throw new AppError(400, "VALIDATION_ERROR", "Invalid ticket sales period.");
        await ticket.save({ session });
        result = {
          ...ticket.toObject(),
          id: ticket._id.toString(),
          available: ticket.capacity - ticket.sold - ticket.reserved,
        };
      });
    } finally {
      await session.endSession();
    }
    response.json({ data: result });
  }),
);
eventRouter.delete(
  "/:id/ticket-types/:typeId",
  requireCsrf,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const event = await owned(request);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Event.updateOne({ _id: event._id }, { $inc: { checkoutVersion: 1 } }, { session });
        const ticket = await TicketType.findOne({
          _id: request.params.typeId,
          eventId: event._id,
        }).session(session);
        if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket type not found.");
        if (
          (await Order.exists({ ticketTypeId: ticket._id }).session(session)) ||
          ticket.sold + ticket.reserved > 0
        )
          throw new AppError(409, "HAS_ORDERS", "Ticket type already has orders.");
        await ticket.deleteOne({ session });
      });
    } finally {
      await session.endSession();
    }
    response.status(204).send();
  }),
);
eventRouter.get(
  "/:id/committee",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const event = await owned(request);
    const assignments = await CommitteeAssignment.find({ eventId: event._id }).populate(
      "userId",
      "name emailNormalized",
    );
    response.json({
      data: assignments.map((assignment: any) => ({
        userId: assignment.userId._id.toString(),
        name: assignment.userId.name,
        email: assignment.userId.emailNormalized,
      })),
    });
  }),
);
eventRouter.post(
  "/:id/committee",
  requireCsrf,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const event = await owned(request);
    const members = z
      .object({
        memberIds: z
          .array(z.string().regex(/^[a-f\d]{24}$/i))
          .min(1)
          .max(100),
      })
      .safeParse(request.body);
    if (members.success) {
      const accounts = await WorkspaceAccount.find({
        _id: { $in: members.data.memberIds },
        organizerId: event.organizerId,
        role: "committee",
        active: true,
      });
      if (accounts.length !== new Set(members.data.memberIds).size)
        throw new AppError(
          400,
          "INVALID_MEMBERS",
          "Select active committee accounts belonging to this organizer.",
        );
      await CommitteeAssignment.bulkWrite(
        accounts.map((account) => ({
          updateOne: {
            filter: { eventId: event._id, userId: account.userId },
            update: {
              $setOnInsert: {
                assignedBy: new Types.ObjectId(request.auth!.user._id),
                checkInVersion: 0,
                createdAt: new Date(),
              },
            },
            upsert: true,
          },
        })),
      );
      response
        .status(201)
        .json({
          data: accounts.map((a) => ({
            userId: a.userId!.toString(),
            username: a.username,
            name: a.name,
          })),
        });
      return;
    }
    throw new AppError(400, "VALIDATION_ERROR", "Select committee accounts by memberIds.");
  }),
);
eventRouter.delete(
  "/:id/committee/:userId",
  requireCsrf,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const event = await owned(request);
    const result = await CommitteeAssignment.deleteOne({
      eventId: event._id,
      userId: request.params.userId,
    });
    if (result.deletedCount === 0)
      throw new AppError(404, "NOT_FOUND", "Committee assignment not found.");
    response.status(204).send();
  }),
);

eventRouter.post(
  "/:id/cancel",
  requireCsrf,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = z
      .object({ confirmTitle: z.string(), reason: z.string().trim().min(10).max(1000) })
      .safeParse(req.body);
    if (!parsed.success) invalid(parsed);
    res
      .status(201)
      .json({
        data: await requestEventCancellation(
          String(req.params.id),
          req.auth!.organizerId!,
          parsed.data!.confirmTitle,
          parsed.data!.reason,
        ),
      });
  }),
);
eventRouter.post(
  "/:id/orders/:orderId/refunds",
  requireCsrf,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = z
      .object({
        mode: z.enum(["full", "partial"]),
        ticketIds: z.array(z.string()).max(20).optional(),
        reason: z.string().trim().min(3).max(500),
      })
      .safeParse(req.body);
    if (!parsed.success) invalid(parsed);
    res.status(201).json({
      data: await requestOrganizerRefund(
        String(req.params.id),
        String(req.params.orderId),
        req.auth!.organizerId!,
        parsed.data!,
      ),
    });
  }),
);
eventRouter.post(
  "/:id/orders/:orderId/resend",
  requireCsrf,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const event = await owned(req);
    if (!Types.ObjectId.isValid(String(req.params.orderId)))
      throw new AppError(404, "NOT_FOUND", "Order not found.");
    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.orderId,
        eventId: event._id,
        paymentStatus: "paid",
        issuanceStatus: "issued",
        $or: [
          { lastTicketResendAt: { $exists: false } },
          { lastTicketResendAt: { $lt: new Date(Date.now() - 60_000) } },
        ],
      },
      { $set: { lastTicketResendAt: new Date() } },
      { strict: false, returnDocument: "after" },
    );
    if (!order)
      throw new AppError(
        409,
        "RESEND_UNAVAILABLE",
        "Tickets cannot be resent yet. Wait 60 seconds and retry.",
      );
    await notifyOrderTickets(order.id, resendBatchKey());
    res.status(202).json({ data: { queued: true } });
  }),
);
eventRouter.post(
  "/:id/duplicate",
  requireCsrf,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const source = await owned(req);
    const session = await mongoose.startSession();
    let id = "";
    try {
      await session.withTransaction(async () => {
        const { _id, createdAt, updatedAt, __v, ...input } = source.toObject() as any;
        const [copy] = await Event.create(
          [
            {
              ...input,
              title: `${source.title} (salinan)`,
              slug: slugify(source.title),
              publicationStatus: "draft",
              salesClosed: false,
              checkoutVersion: 0,
              financialVersion: 0,
              cancellationStatus: undefined,
              cancellationReason: undefined,
              cancellationRequestedAt: undefined,
              cancellationDecidedAt: undefined,
              cancellationDecidedBy: undefined,
              cancellationDecisionNote: undefined,
            },
          ],
          { session },
        );
        const types = await TicketType.find({ eventId: source._id }).session(session);
        if (types.length)
          await TicketType.create(
            types.map((t) => ({
              eventId: copy._id,
              name: t.name,
              description: t.description,
              price: t.price,
              capacity: t.capacity,
              reserved: 0,
              sold: 0,
              salesStartsAt: t.salesStartsAt,
              salesEndsAt: t.salesEndsAt,
              salesStopped: false,
            })),
            { session },
          );
        id = copy._id.toString();
      });
    } finally {
      await session.endSession();
    }
    res.status(201).json({ data: { id } });
  }),
);
for (const action of ["stop", "resume"] as const)
  eventRouter.post(
    `/:id/ticket-types/:typeId/${action}`,
    requireCsrf,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const event = await owned(req);
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await Event.updateOne({ _id: event._id }, { $inc: { checkoutVersion: 1 } }, { session });
          const ticket = await TicketType.findOneAndUpdate(
            { _id: req.params.typeId, eventId: event._id },
            { $set: { salesStopped: action === "stop" } },
            { session },
          );
          if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket type not found.");
        });
      } finally {
        await session.endSession();
      }
      res.status(204).send();
    }),
  );
