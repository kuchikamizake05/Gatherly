import type { NextFunction, Request, Response } from "express";

import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { hashToken } from "../../lib/crypto.js";
import { Session, User, type UserDocument } from "./auth.models.js";
import {
  authenticateWorkspaceCookie,
  requireWorkspaceCsrf,
} from "../workspace/workspace.middleware.js";

const sessionCookieName = "gatherly_session";

export interface AuthenticatedRequest extends Request {
  auth?: {
    user: UserDocument & { _id: string };
    sessionId: string;
    csrfToken: string;
    organizerId?: string;
  };
}

export async function requireSession(
  request: AuthenticatedRequest,
  _response: Response,
  next: NextFunction,
) {
  try {
    if (
      /^\/api\/v1\/(organizer(?:\/|$)|committee(?:\/|$)|realtime(?:\/|$))/.test(
        request.originalUrl ?? request.url ?? "",
      ) &&
      request.cookies.gatherly_workspace &&
      (await authenticateWorkspaceCookie(request))
    ) {
      next();
      return;
    }
    const rawToken = request.cookies[sessionCookieName];
    if (typeof rawToken !== "string") {
      throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
    }

    const session = await Session.findOne({
      tokenHash: hashToken(rawToken),
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!session) {
      throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
    }

    const user = await User.findById(session.userId).lean();
    if (!user || user.deletedAt) {
      await Session.deleteOne({ _id: session._id });
      throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
    }

    request.auth = {
      user: { ...user, _id: user._id.toString() },
      sessionId: session._id.toString(),
      csrfToken: "",
    };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireCsrf(
  request: AuthenticatedRequest,
  _response: Response,
  next: NextFunction,
) {
  if (request.cookies.gatherly_workspace) {
    try {
      if (requireWorkspaceCsrf(request)) {
        next();
        return;
      }
    } catch (error) {
      next(error);
      return;
    }
  }
  const auth = request.auth;
  const csrfToken = request.get("X-CSRF-Token");
  if (!csrfToken || !auth) {
    next(new AppError(403, "CSRF_INVALID", "A valid CSRF token is required."));
    return;
  }

  Session.exists({
    _id: auth.sessionId,
    csrfTokenHash: hashToken(csrfToken),
    expiresAt: { $gt: new Date() },
  })
    .then((sessionExists) => {
      if (!sessionExists) {
        next(new AppError(403, "CSRF_INVALID", "A valid CSRF token is required."));
        return;
      }
      auth.csrfToken = csrfToken;
      next();
    })
    .catch(next);
}

export function validateAllowedOrigin(request: Request, _response: Response, next: NextFunction) {
  const origin = request.get("Origin");
  if (
    origin &&
    !(env.WEB_ORIGINS ?? env.WEB_ORIGIN)
      .split(",")
      .map((s) => s.trim())
      .includes(origin)
  ) {
    next(new AppError(403, "FORBIDDEN", "Request origin is not allowed."));
    return;
  }
  next();
}

export const sessionCookie = {
  name: sessionCookieName,
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    path: "/",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
    maxAge: env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  },
};
