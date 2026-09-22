import bcrypt from "bcryptjs";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { Types } from "mongoose";
import { z } from "zod";

import { AppError } from "../../lib/app-error.js";
import { createToken, hashToken } from "../../lib/crypto.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { Session, User } from "./auth.models.js";
import {
  requireCsrf,
  requireSession,
  sessionCookie,
  type AuthenticatedRequest,
  validateAllowedOrigin,
} from "./auth.middleware.js";
import { env } from "../../config/env.js";

const credentialsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
});

const loginSchema = credentialsSchema.pick({ email: true, password: true });

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many login attempts. Please try again later.",
    },
  },
});

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (result.success) {
    return result.data;
  }

  const fields = Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join(".") || "body", issue.message]),
  );
  throw new AppError(400, "VALIDATION_ERROR", "Please check the submitted fields.", fields);
}

function userResponse(user: { _id: { toString(): string }; name: string; emailNormalized: string }) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.emailNormalized,
  };
}

async function createSession(userId: string) {
  const sessionToken = createToken();
  const csrfToken = createToken();
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await Session.create({
    tokenHash: hashToken(sessionToken),
    csrfTokenHash: hashToken(csrfToken),
    userId: new Types.ObjectId(userId),
    expiresAt,
  });

  return { sessionToken, csrfToken };
}

export const authRouter = Router();

authRouter.post(
  "/register",
  validateAllowedOrigin,
  asyncHandler(async (request, response) => {
    const { name, email, password } = parseBody(credentialsSchema, request.body);
    const emailNormalized = email.toLowerCase();
    const existingUser = await User.exists({ emailNormalized });
    if (existingUser) {
      throw new AppError(409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists.");
    }

    const user = await User.create({
      name,
      emailNormalized,
      passwordHash: await bcrypt.hash(password, 12),
    });

    response.status(201).json({ data: userResponse(user) });
  }),
);

authRouter.post(
  "/login",
  validateAllowedOrigin,
  loginLimiter,
  asyncHandler(async (request, response) => {
    const { email, password } = parseBody(loginSchema, request.body);
    const user = await User.findOne({ emailNormalized: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, "UNAUTHENTICATED", "Email or password is incorrect.");
    }

    const { sessionToken, csrfToken } = await createSession(user._id.toString());
    response.cookie(sessionCookie.name, sessionToken, sessionCookie.options);
    response.status(200).json({ data: { user: userResponse(user), csrfToken } });
  }),
);

authRouter.get(
  "/me",
  requireSession,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const csrfToken = createToken();
    await Session.updateOne(
      { _id: request.auth!.sessionId },
      { $set: { csrfTokenHash: hashToken(csrfToken) } },
    );

    response.status(200).json({
      data: {
        user: userResponse(request.auth!.user),
        organizerId: null,
        hasCommitteeAssignments: false,
        csrfToken,
      },
    });
  }),
);

authRouter.post(
  "/logout",
  requireSession,
  requireCsrf,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    await Session.deleteOne({ _id: request.auth!.sessionId });
    response.clearCookie(sessionCookie.name, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
    });
    response.status(204).send();
  }),
);
