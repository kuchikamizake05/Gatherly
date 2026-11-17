import { Schema, model, Types } from "mongoose";
import { Router } from "express";
import { createToken, hashToken } from "../../lib/crypto.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import { requireSession, requireCsrf, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import { Session, User } from "../auth/auth.models.js";
import { WorkspaceAccount, WorkspaceSession } from "../workspace/workspace.models.js";
const schema = new Schema({
  tokenHash: { type: String, unique: true, required: true },
  sessionId: { type: String, required: true },
  workspace: Boolean,
  expiresAt: { type: Date, index: { expires: 0 }, required: true },
});
export const SocketGrant = model("SocketGrant", schema);
export const realtimeRouter = Router();
realtimeRouter.post(
  "/ticket",
  requireSession,
  requireCsrf,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const token = createToken();
    await SocketGrant.create({
      tokenHash: hashToken(token),
      sessionId: req.auth!.sessionId,
      workspace: !!(req as unknown as { workspace?: unknown }).workspace,
      expiresAt: new Date(Date.now() + 30_000),
    });
    res.setHeader("Cache-Control", "no-store");
    res.json({ data: { token } });
  }),
);
export async function socketIdentity(sessionId: string, workspace: boolean) {
  if (!Types.ObjectId.isValid(sessionId))
    throw new AppError(401, "UNAUTHENTICATED", "Session expired.");
  if (workspace) {
    const session = await WorkspaceSession.findOne({
      _id: sessionId,
      expiresAt: { $gt: new Date() },
    });
    const account = session
      ? await WorkspaceAccount.findOne({ _id: session.accountId, active: true })
      : null;
    if (!account) throw new AppError(401, "UNAUTHENTICATED", "Session expired.");
    return account.userId.toString();
  }
  const session = await Session.findOne({ _id: sessionId, expiresAt: { $gt: new Date() } });
  const user = session
    ? await User.findOne({ _id: session.userId, deletedAt: { $exists: false } })
    : null;
  if (!user) throw new AppError(401, "UNAUTHENTICATED", "Session expired.");
  return user.id;
}
