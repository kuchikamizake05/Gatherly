import type { NextFunction, Request, Response } from "express";
import { WorkspaceAccount, WorkspaceSession } from "./workspace.models.js";
import { Organizer } from "../organizers/organizer.model.js";
import { User } from "../auth/auth.models.js";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";
import { hashToken } from "../../lib/crypto.js";
import { AppError } from "../../lib/app-error.js";
import { env } from "../../config/env.js";

export const workspaceCookie = {
  name: "gatherly_workspace",
  options: {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 7 * 86400_000,
  },
};
export type WorkspaceRequest = AuthenticatedRequest & {
  workspace?: {
    account: InstanceType<typeof WorkspaceAccount>;
    session: InstanceType<typeof WorkspaceSession>;
    organizer: InstanceType<typeof Organizer>;
  };
};

export async function authenticateWorkspaceCookie(request: Request): Promise<boolean> {
  const req = request as WorkspaceRequest;
  const token = req.cookies?.[workspaceCookie.name];
  if (typeof token !== "string") return false;
  const session = await WorkspaceSession.findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });
  if (!session) return false;
  const account = await WorkspaceAccount.findOne({ _id: session.accountId, active: true });
  if (!account) return false;
  const organizer = await Organizer.findById(account.organizerId);
  const user = await User.findById(account.userId).lean();
  if (!organizer || !user) return false;
  req.workspace = { account, session, organizer };
  req.auth = {
    user: { ...user, _id: user._id.toString() },
    sessionId: session.id,
    csrfToken: session.csrfToken,
    organizerId: organizer.id,
  };
  return true;
}

export async function requireWorkspace(request: Request, _res: Response, next: NextFunction) {
  try {
    if (!(await authenticateWorkspaceCookie(request)))
      throw new AppError(401, "UNAUTHENTICATED", "Workspace authentication is required.");
    const req = request as WorkspaceRequest;
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      requireWorkspaceCsrf(req);
      if (req.workspace!.organizer.status === "frozen" && !req.path.startsWith("/auth/"))
        throw new AppError(403, "ORGANIZER_FROZEN", "Organizer writes are disabled.");
    }
    next();
  } catch (error) {
    next(error);
  }
}

export function requireWorkspaceCsrf(request: Request): boolean {
  const req = request as WorkspaceRequest;
  if (!req.workspace) return false;
  if (req.get("X-CSRF-Token") !== req.workspace.session.csrfToken)
    throw new AppError(403, "CSRF_INVALID", "A valid CSRF token is required.");
  return true;
}

export function workspaceMe(req: WorkspaceRequest) {
  const { account, session, organizer } = req.workspace!;
  return {
    role: account.role,
    username: account.username,
    name: account.name,
    mustChangePassword: account.mustChangePassword,
    organizer: {
      id: organizer.id,
      name: organizer.name,
      username: organizer.username ?? account.username,
      frozen: organizer.status === "frozen",
      frozenReason: organizer.frozenReason,
    },
    csrfToken: session.csrfToken,
  };
}
