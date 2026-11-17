import type { NextFunction, Request, Response } from "express";
import { hashToken } from "../../lib/crypto.js";
import { AppError } from "../../lib/app-error.js";
import { AdminAccount, AdminSession } from "./admin.models.js";
import { env } from "../../config/env.js";

export type AdminRequest = Request & {
  admin?: { id: string; name: string; email: string; sessionId: string; csrfToken: string };
};
export const adminCookie = {
  name: "gatherly_admin",
  options: {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  },
};
export async function requireAdmin(request: Request, _res: Response, next: NextFunction) {
  try {
    const token = request.cookies?.[adminCookie.name];
    if (typeof token !== "string")
      throw new AppError(401, "UNAUTHENTICATED", "Admin authentication is required.");
    const session = await AdminSession.findOne({
      tokenHash: hashToken(token),
      expiresAt: { $gt: new Date() },
    });
    const admin = session && (await AdminAccount.findOne({ _id: session.accountId, active: true }));
    if (!session || !admin)
      throw new AppError(401, "UNAUTHENTICATED", "Admin authentication is required.");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.get("X-CSRF-Token") !== session.csrfToken
    )
      throw new AppError(403, "CSRF_INVALID", "A valid CSRF token is required.");
    (request as AdminRequest).admin = {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      sessionId: session.id,
      csrfToken: session.csrfToken,
    };
    next();
  } catch (error) {
    next(error);
  }
}
