import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { createToken, hashToken } from "../../lib/crypto.js";
import { Session, User } from "../auth/auth.models.js";
import { Event } from "../events/event.models.js";
import { Ticket } from "../tickets/ticket.model.js";
import { Organizer } from "../organizers/organizer.model.js";
import { Order } from "../orders/order.model.js";
import { queueEmail } from "../notifications/email.service.js";
import { passwordResetEmail } from "../notifications/email-templates.js";
import { PasswordReset } from "./account.models.js";

export async function accountView(userId: string, now = new Date()) {
  const user = await User.findOne({ _id: userId, deletedAt: { $exists: false } }).lean();
  if (!user) throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  return {
    name: user.name,
    email: user.emailNormalized,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? null,
    joinedAt: user.createdAt,
    passwordChangedAt: user.passwordChangedAt ?? null,
    hasPassword: Boolean(user.passwordHash),
    googleEmail: user.googleId ? user.emailNormalized : null,
    activeDevices: await Session.countDocuments({ userId, expiresAt: { $gt: now } }),
    notifications: user.notifications ?? { reminders: true, recommendations: false },
  };
}

export async function changeParticipantPassword(
  userId: string,
  sessionId: string,
  input: { currentPassword?: string; newPassword: string },
  now = new Date(),
) {
  const user = await User.findById(userId);
  if (!user || user.deletedAt)
    throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
  if (user.passwordLockedUntil && user.passwordLockedUntil > now) {
    throw new AppError(429, "PASSWORD_LOCKED", "Please wait before changing your password again.");
  }
  const previous = user.passwordHash;
  if (previous && !(await bcrypt.compare(input.currentPassword ?? "", previous))) {
    const failed = await User.findOneAndUpdate(
      { _id: userId, passwordHash: previous },
      { $inc: { passwordFailures: 1 } },
      { returnDocument: "after" },
    );
    if ((failed?.passwordFailures ?? 0) >= 5) {
      await User.updateOne(
        { _id: userId },
        {
          $set: { passwordLockedUntil: new Date(now.getTime() + 10 * 60_000), passwordFailures: 0 },
        },
      );
      throw new AppError(
        429,
        "PASSWORD_LOCKED",
        "Please wait before changing your password again.",
      );
    }
    throw new AppError(400, "INVALID_PASSWORD", "Current password is incorrect.");
  }
  if (previous && (await bcrypt.compare(input.newPassword, previous)))
    throw new AppError(400, "PASSWORD_REUSED", "Choose a different password.");
  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const changed = await User.updateOne(
        {
          _id: userId,
          passwordHash: previous ?? { $exists: false },
          deletedAt: { $exists: false },
        },
        {
          $set: { passwordHash, passwordChangedAt: now, passwordFailures: 0 },
          $unset: { passwordLockedUntil: 1 },
        },
        { session },
      );
      if (!changed.modifiedCount)
        throw new AppError(409, "CONFLICT", "Account changed. Please try again.");
      await Session.deleteMany({ userId, _id: { $ne: sessionId } }, { session });
      await PasswordReset.deleteMany({ userId }, { session });
    });
  } finally {
    await session.endSession();
  }
}

export async function forgotPassword(email: string, now = new Date()) {
  const user = await User.findOne({
    emailNormalized: email.trim().toLowerCase(),
    deletedAt: { $exists: false },
  }).lean();
  if (!user) return;
  const token = createToken();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Serialize reset issuance with password changes and other reset requests.
      const valid = await User.updateOne(
        { _id: user._id, deletedAt: { $exists: false } },
        { $set: { updatedAt: now } },
        { session },
      );
      if (!valid.matchedCount) return;
      await PasswordReset.updateMany(
        { userId: user._id, usedAt: { $exists: false } },
        { $set: { usedAt: now } },
        { session },
      );
      const [reset] = await PasswordReset.create(
        [
          {
            userId: user._id,
            tokenHash: hashToken(token),
            expiresAt: new Date(now.getTime() + 30 * 60_000),
          },
        ],
        { session },
      );
      await queueEmail(
        {
          ...passwordResetEmail(
            `password-reset:${reset!._id}`,
            user.emailNormalized,
            `${env.WEB_ORIGIN}/reset-password?token=${encodeURIComponent(token)}`,
          ),
          expiresAt: new Date(now.getTime() + 30 * 60_000),
        },
        session,
      );
    });
  } finally {
    await session.endSession();
  }
}

export async function resetPassword(token: string, password: string, now = new Date()) {
  const passwordHash = await bcrypt.hash(password, 12);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const reset = await PasswordReset.findOneAndUpdate(
        { tokenHash: hashToken(token), usedAt: { $exists: false }, expiresAt: { $gt: now } },
        { $set: { usedAt: now } },
        { session, returnDocument: "after" },
      );
      if (!reset)
        throw new AppError(410, "TOKEN_INVALID", "Password reset link is invalid or expired.");
      const current = await User.findOne({ _id: reset.userId, deletedAt: { $exists: false } })
        .session(session)
        .lean();
      if (current?.passwordHash && (await bcrypt.compare(password, current.passwordHash)))
        throw new AppError(400, "PASSWORD_REUSED", "Choose a different password.");
      const user = await User.updateOne(
        { _id: reset.userId, deletedAt: { $exists: false } },
        {
          $set: { passwordHash, passwordChangedAt: now, passwordFailures: 0 },
          $unset: { passwordLockedUntil: 1 },
        },
        { session },
      );
      if (!user.matchedCount)
        throw new AppError(410, "TOKEN_INVALID", "Password reset link is invalid or expired.");
      await Session.deleteMany({ userId: reset.userId }, { session });
      await PasswordReset.updateMany(
        { userId: reset.userId, usedAt: { $exists: false } },
        { $set: { usedAt: now } },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
}

export async function deleteParticipantAccount(userId: string, now = new Date()) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const user = await User.findOneAndUpdate(
        { _id: userId, deletedAt: { $exists: false } },
        { $set: { updatedAt: now } },
        { session, returnDocument: "after" },
      );
      if (!user) throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
      const upcoming = await Event.find({ endsAt: { $gte: now } })
        .select("_id")
        .session(session)
        .lean();
      const ids = upcoming.map((event) => event._id);
      if (
        (await Ticket.exists({
          buyerId: userId,
          eventId: { $in: ids },
          checkInStatus: { $ne: "cancelled" },
        }).session(session)) ||
        (await Order.exists({
          buyerId: userId,
          eventId: { $in: ids },
          paymentStatus: { $in: ["pending", "paid"] },
          reservationStatus: { $ne: "released" },
        }).session(session))
      ) {
        throw new AppError(
          409,
          "ACCOUNT_HAS_ACTIVE_TICKETS",
          "Account still has tickets or orders for upcoming events.",
        );
      }
      if (await Organizer.exists({ ownerId: userId }).session(session)) {
        throw new AppError(
          409,
          "ACCOUNT_IS_ORGANIZER",
          "Organizer accounts must be managed by an operator.",
        );
      }
      await User.updateOne(
        { _id: userId },
        {
          $set: {
            name: "Deleted participant",
            emailNormalized: `deleted-${userId}@invalid.local`,
            phone: null,
            deletedAt: now,
          },
          $unset: { passwordHash: 1, googleId: 1, avatarUrl: 1 },
        },
        { session },
      );
      await Session.deleteMany({ userId }, { session });
      await PasswordReset.deleteMany({ userId }, { session });
    });
  } finally {
    await session.endSession();
  }
}
