import { Router } from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import { createToken, hashToken } from "../../lib/crypto.js";
import { User } from "../auth/auth.models.js";
import { Event } from "../events/event.models.js";
import { CommitteeAssignment } from "../committee/committee-assignment.model.js";
import { queueEmail } from "../notifications/email.service.js";
import { WorkspaceAccount, WorkspaceSession } from "./workspace.models.js";
import {
  requireWorkspace,
  workspaceCookie,
  workspaceMe,
  type WorkspaceRequest,
} from "./workspace.middleware.js";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9._-]*$/);
export const strongPassword = z.string().min(12).max(128);
export const workspaceAuthRouter = Router();
export const teamRouter = Router();
const route = asyncHandler;
const tempDuration = 7 * 86400_000;

export function temporaryCredentials(username: string) {
  return {
    username,
    temporaryPassword: createToken().slice(0, 20),
    expiresAt: new Date(Date.now() + tempDuration),
  };
}
export async function setTemporaryPassword(account: InstanceType<typeof WorkspaceAccount>) {
  const result = temporaryCredentials(account.username);
  account.passwordHash = await bcrypt.hash(result.temporaryPassword, 12);
  account.mustChangePassword = true;
  account.temporaryExpiresAt = result.expiresAt;
  account.failures = 0;
  account.lockedUntil = undefined;
  await account.save();
  await WorkspaceSession.deleteMany({ accountId: account._id });
  return result;
}

workspaceAuthRouter.post(
  "/login",
  route(async (req, res) => {
    const input = z
      .object({ username: usernameSchema, password: z.string().min(1).max(128) })
      .parse(req.body);
    const account = await WorkspaceAccount.findOne({ username: input.username, active: true });
    if (account?.lockedUntil && account.lockedUntil > new Date())
      throw new AppError(429, "ACCOUNT_LOCKED", "Account is temporarily locked.");
    const valid = await bcrypt.compare(
      input.password,
      account?.passwordHash ?? "$2b$12$C6UzMDM.H6dfI/f/IKcEe.ouN9q0AqNk.MW4f7VfM4eWcLZb3S9Pi",
    );
    if (!account || !valid) {
      if (account)
        await WorkspaceAccount.updateOne(
          { _id: account._id },
          {
            $inc: { failures: 1 },
            ...(account.failures >= 4
              ? { $set: { lockedUntil: new Date(Date.now() + 600_000) } }
              : {}),
          },
        );
      throw new AppError(401, "UNAUTHENTICATED", "Username or password is incorrect.");
    }
    if (
      account.mustChangePassword &&
      account.temporaryExpiresAt &&
      account.temporaryExpiresAt <= new Date()
    )
      throw new AppError(410, "TEMPORARY_PASSWORD_EXPIRED", "Temporary password has expired.");
    account.failures = 0;
    account.lockedUntil = undefined;
    account.lastLoginAt = new Date();
    await account.save();
    const { Organizer } = await import("../organizers/organizer.model.js");
    await Organizer.updateOne(
      { _id: account.organizerId, status: "never_logged_in" },
      { $set: { status: "active" } },
    );
    const token = createToken();
    await WorkspaceSession.create({
      accountId: account._id,
      tokenHash: hashToken(token),
      csrfToken: createToken(),
      expiresAt: new Date(Date.now() + tempDuration),
    });
    req.cookies = { ...req.cookies, [workspaceCookie.name]: token };
    const { authenticateWorkspaceCookie } = await import("./workspace.middleware.js");
    await authenticateWorkspaceCookie(req);
    res
      .cookie(workspaceCookie.name, token, workspaceCookie.options)
      .json({ data: workspaceMe(req as WorkspaceRequest) });
  }),
);

workspaceAuthRouter.post(
  "/password/forgot",
  route(async (req, res) => {
    const { usernameOrEmail } = z
      .object({ usernameOrEmail: z.string().trim().min(3).max(254).toLowerCase() })
      .parse(req.body);
    const account = await WorkspaceAccount.findOne({
      $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
      active: true,
    });
    if (account?.role === "committee") {
      res.json({ data: { isCommittee: true } });
      return;
    }
    if (account?.email) {
      const token = createToken();
      account.resetTokenHash = hashToken(token);
      account.resetExpiresAt = new Date(Date.now() + 1800_000);
      await account.save();
      await queueEmail({
        key: `workspace-reset:${account.id}:${account.resetTokenHash}`,
        to: account.email,
        subject: "Atur ulang password Gatherly",
        text: `Buka ${process.env.ORGANIZER_ORIGIN ?? "http://organizer.localhost:3000"}/reset-password?token=${encodeURIComponent(token)}. Tautan berlaku 30 menit.`,
      });
    }
    res.json({ data: { isCommittee: false } });
  }),
);
workspaceAuthRouter.post(
  "/password/reset",
  route(async (req, res) => {
    const input = z.object({ token: z.string().min(20), password: strongPassword }).parse(req.body);
    const account = await WorkspaceAccount.findOneAndUpdate(
      {
        resetTokenHash: hashToken(input.token),
        resetExpiresAt: { $gt: new Date() },
        role: "organizer",
      },
      {
        $set: {
          passwordHash: await bcrypt.hash(input.password, 12),
          mustChangePassword: false,
          failures: 0,
        },
        $unset: { resetTokenHash: 1, resetExpiresAt: 1, temporaryExpiresAt: 1, lockedUntil: 1 },
      },
    );
    if (!account) throw new AppError(410, "RESET_EXPIRED", "Reset link is invalid or expired.");
    await WorkspaceSession.deleteMany({ accountId: account._id });
    res.sendStatus(204);
  }),
);
workspaceAuthRouter.use(requireWorkspace);
workspaceAuthRouter.get(
  "/me",
  route(async (req, res) => {
    res.json({ data: workspaceMe(req as WorkspaceRequest) });
  }),
);
workspaceAuthRouter.post(
  "/logout",
  route(async (req, res) => {
    await WorkspaceSession.deleteOne({ _id: (req as WorkspaceRequest).workspace!.session._id });
    res.clearCookie(workspaceCookie.name, workspaceCookie.options).sendStatus(204);
  }),
);
workspaceAuthRouter.post(
  "/password/first",
  route(async (req, res) => {
    const { newPassword } = z.object({ newPassword: strongPassword }).parse(req.body);
    const account = (req as WorkspaceRequest).workspace!.account;
    if (!account.mustChangePassword)
      throw new AppError(409, "CONFLICT", "Password has already been changed.");
    if (await bcrypt.compare(newPassword, account.passwordHash))
      throw new AppError(400, "PASSWORD_REUSED", "Choose a different password.");
    account.passwordHash = await bcrypt.hash(newPassword, 12);
    account.mustChangePassword = false;
    account.temporaryExpiresAt = undefined;
    await account.save();
    await WorkspaceSession.deleteMany({
      accountId: account._id,
      _id: { $ne: (req as WorkspaceRequest).workspace!.session._id },
    });
    res.sendStatus(204);
  }),
);
workspaceAuthRouter.post(
  "/password",
  route(async (req, res) => {
    const input = z
      .object({ currentPassword: z.string(), newPassword: strongPassword })
      .parse(req.body);
    const account = (req as WorkspaceRequest).workspace!.account;
    if (!(await bcrypt.compare(input.currentPassword, account.passwordHash)))
      throw new AppError(400, "WRONG_PASSWORD", "Current password is incorrect.");
    account.passwordHash = await bcrypt.hash(input.newPassword, 12);
    await account.save();
    await WorkspaceSession.deleteMany({
      accountId: account._id,
      _id: { $ne: (req as WorkspaceRequest).workspace!.session._id },
    });
    res.sendStatus(204);
  }),
);

teamRouter.use(requireWorkspace);
teamRouter.use((req, _res, next) => {
  const workspace = (req as WorkspaceRequest).workspace!;
  if (workspace.account.role !== "organizer" || workspace.account.mustChangePassword) {
    next(new AppError(403, "FORBIDDEN", "Organizer access is required."));
    return;
  }
  next();
});
teamRouter.get(
  "/username",
  route(async (req, res) => {
    const username = usernameSchema.parse(req.query.username);
    res.json({ data: { available: !(await WorkspaceAccount.exists({ username })) } });
  }),
);
teamRouter.get(
  "/",
  route(async (req, res) => {
    const { account, organizer } = (req as WorkspaceRequest).workspace!;
    const accounts = await WorkspaceAccount.find({
      organizerId: organizer._id,
      role: "committee",
    }).sort({ createdAt: -1 });
    const members = await Promise.all(
      accounts.map(async (a) => {
        const assignments = await CommitteeAssignment.find({ userId: a.userId })
          .select("eventId")
          .lean();
        return {
          id: a.id,
          name: a.name,
          username: a.username,
          assignedEvents: assignments.length,
          eventIds: assignments.map((assignment) => assignment.eventId.toString()),
          status: !a.active ? "inactive" : a.lastLoginAt ? "active" : "never_logged_in",
        };
      }),
    );
    res.json({
      data: [
        {
          id: account.id,
          name: account.name,
          username: account.username,
          assignedEvents: -1,
          status: "owner",
        },
        ...members,
      ],
    });
  }),
);
async function ownedMember(req: WorkspaceRequest) {
  if (!mongoose.Types.ObjectId.isValid(String(req.params.id)))
    throw new AppError(404, "NOT_FOUND", "Member not found.");
  const member = await WorkspaceAccount.findOne({
    _id: req.params.id,
    organizerId: req.workspace!.organizer._id,
    role: "committee",
  });
  if (!member) throw new AppError(404, "NOT_FOUND", "Member not found.");
  return member;
}
async function setAssignments(
  account: InstanceType<typeof WorkspaceAccount>,
  ids: string[],
  actorId: mongoose.Types.ObjectId,
) {
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !mongoose.Types.ObjectId.isValid(id)) ||
    (await Event.countDocuments({ _id: { $in: ids }, organizerId: account.organizerId })) !==
      ids.length
  )
    throw new AppError(400, "INVALID_EVENTS", "Assignments must belong to this organizer.");
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await CommitteeAssignment.deleteMany({ userId: account.userId }).session(session);
      if (ids.length)
        await CommitteeAssignment.insertMany(
          ids.map((eventId) => ({ eventId, userId: account.userId, assignedBy: actorId })),
          { session },
        );
    });
  } finally {
    await session.endSession();
  }
}
teamRouter.post(
  "/",
  route(async (req, res) => {
    const input = z
      .object({
        name: z.string().trim().min(1).max(100),
        username: usernameSchema,
        eventIds: z.array(z.string()).max(100),
      })
      .parse(req.body);
    if (await WorkspaceAccount.exists({ username: input.username }))
      throw new AppError(409, "USERNAME_TAKEN", "Username is already used.");
    const workspace = (req as WorkspaceRequest).workspace!;
    if (
      (await WorkspaceAccount.countDocuments({
        organizerId: workspace.organizer._id,
        role: "committee",
      })) >= 100
    )
      throw new AppError(409, "MEMBER_LIMIT", "Committee member limit reached.");
    const user = await User.create({
      name: input.name,
      emailNormalized: `${createToken()}@workspace.invalid`,
    });
    const credentials = temporaryCredentials(input.username);
    const account = await WorkspaceAccount.create({
      username: input.username,
      name: input.name,
      role: "committee",
      userId: user._id,
      organizerId: workspace.organizer._id,
      passwordHash: await bcrypt.hash(credentials.temporaryPassword, 12),
      temporaryExpiresAt: credentials.expiresAt,
    });
    try {
      await setAssignments(account, input.eventIds, workspace.account.userId);
    } catch (error) {
      await account.deleteOne();
      await user.deleteOne();
      throw error;
    }
    res.status(201).json({ data: credentials });
  }),
);
teamRouter.post(
  "/:id/reset-password",
  route(async (req, res) => {
    res.json({ data: await setTemporaryPassword(await ownedMember(req as WorkspaceRequest)) });
  }),
);
teamRouter.put(
  "/:id/assignments",
  route(async (req, res) => {
    const { eventIds } = z.object({ eventIds: z.array(z.string()).max(100) }).parse(req.body);
    await setAssignments(
      await ownedMember(req as WorkspaceRequest),
      eventIds,
      (req as WorkspaceRequest).workspace!.account.userId,
    );
    res.sendStatus(204);
  }),
);
for (const [action, active] of [
  ["deactivate", false],
  ["reactivate", true],
] as const)
  teamRouter.post(
    `/:id/${action}`,
    route(async (req, res) => {
      const account = await ownedMember(req as WorkspaceRequest);
      account.active = active;
      await account.save();
      if (!active) await WorkspaceSession.deleteMany({ accountId: account._id });
      res.sendStatus(204);
    }),
  );
teamRouter.delete(
  "/:id",
  route(async (req, res) => {
    const account = await ownedMember(req as WorkspaceRequest);
    await WorkspaceSession.deleteMany({ accountId: account._id });
    await CommitteeAssignment.deleteMany({ userId: account.userId });
    await account.deleteOne();
    res.sendStatus(204);
  }),
);
