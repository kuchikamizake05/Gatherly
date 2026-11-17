import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";

import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { createToken, hashToken } from "../../lib/crypto.js";
import { requestOrigin, safeReturnTo } from "../../lib/origins.js";
import { CommitteeAssignment } from "../committee/committee-assignment.model.js";
import { Organizer } from "../organizers/organizer.model.js";
import {
  requireCsrf,
  requireSession,
  sessionCookie,
  type AuthenticatedRequest,
  validateAllowedOrigin,
} from "./auth.middleware.js";
import { Session, type UserDocument } from "./auth.models.js";
import {
  beginLogin,
  beginRegistration,
  consumeOAuthContext,
  createOAuthState,
  createSession,
  resendOtp,
  userResponse,
  verifyLogin,
  verifyRegistration,
} from "./auth.service.js";
import { googleAuthConfigured, passport } from "./google-auth.js";

const credentialsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
});
const loginSchema = credentialsSchema.pick({ email: true, password: true });
const verifySchema = z.object({
  challengeId: z.string().regex(/^[a-f\d]{24}$/i),
  code: z.string().regex(/^\d{6}$/),
});
const resendSchema = verifySchema.pick({ challengeId: true });

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: { code: "RATE_LIMITED", message: "Too many attempts. Please try again later." },
  },
});

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  const fields = Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join(".") || "body", issue.message]),
  );
  throw new AppError(400, "VALIDATION_ERROR", "Please check the submitted fields.", fields);
}

/** The frontend login page shows the Google error banner for `error=google`. */
function oauthFailure(origin: string, returnTo = "/") {
  const query = new URLSearchParams({ error: "google" });
  if (returnTo !== "/") query.set("returnTo", returnTo);
  return `${origin}/login?${query.toString()}`;
}

function googleCallbackUrl(origin: string) {
  return `${origin}/api/v1/auth/google/callback`;
}

const oauthStateCookie = {
  name: "gatherly_oauth_state",
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    path: "/api/v1/auth/google/callback",
    maxAge: 10 * 60_000,
  },
};

export const authRouter = Router();

authRouter.post(
  "/register",
  validateAllowedOrigin,
  authLimiter,
  asyncHandler(async (request, response) => {
    const input = parseBody(credentialsSchema, request.body);
    response.status(202).json({ data: await beginRegistration(input) });
  }),
);

authRouter.post(
  "/register/verify",
  validateAllowedOrigin,
  authLimiter,
  asyncHandler(async (request, response) => {
    const input = parseBody(verifySchema, request.body);
    const result = await verifyRegistration(input.challengeId, input.code);
    response.cookie(sessionCookie.name, result.sessionToken, sessionCookie.options);
    response.status(201).json({ data: { user: result.user, csrfToken: result.csrfToken } });
  }),
);

authRouter.post(
  "/login",
  validateAllowedOrigin,
  authLimiter,
  asyncHandler(async (request, response) => {
    const input = parseBody(loginSchema, request.body);
    response.status(202).json({ data: await beginLogin(input) });
  }),
);

authRouter.post(
  "/login/verify",
  validateAllowedOrigin,
  authLimiter,
  asyncHandler(async (request, response) => {
    const input = parseBody(verifySchema, request.body);
    const result = await verifyLogin(input.challengeId, input.code);
    response.cookie(sessionCookie.name, result.sessionToken, sessionCookie.options);
    response.status(200).json({ data: { user: result.user, csrfToken: result.csrfToken } });
  }),
);

authRouter.post(
  "/otp/resend",
  validateAllowedOrigin,
  authLimiter,
  asyncHandler(async (request, response) => {
    const input = parseBody(resendSchema, request.body);
    response.status(200).json({ data: await resendOtp(input.challengeId) });
  }),
);

authRouter.get(
  "/google",
  authLimiter,
  asyncHandler(async (request, response, next) => {
    if (!googleAuthConfigured)
      throw new AppError(503, "SERVICE_UNAVAILABLE", "Google login is unavailable.");
    const origin = requestOrigin(request);
    const returnTo = safeReturnTo(request.query.returnTo);
    const state = await createOAuthState(new Date(), { origin, returnTo });
    response.cookie(oauthStateCookie.name, state, oauthStateCookie.options);
    passport.authenticate("google", {
      scope: ["profile", "email"],
      session: false,
      state,
      callbackURL: googleCallbackUrl(origin),
    } as passport.AuthenticateOptions)(request, response, next);
  }),
);

authRouter.get(
  "/google/callback",
  asyncHandler(async (request, response, next) => {
    const state = typeof request.query.state === "string" ? request.query.state : "";
    const cookieState = request.cookies[oauthStateCookie.name];
    const context =
      typeof cookieState === "string" ? await consumeOAuthContext(state, cookieState) : null;
    response.clearCookie(oauthStateCookie.name, oauthStateCookie.options);
    if (!context) {
      response.redirect(oauthFailure(requestOrigin(request)));
      return;
    }
    const origin = context.origin ?? requestOrigin(request);
    const returnTo = safeReturnTo(context.returnTo);
    passport.authenticate(
      "google",
      { session: false, callbackURL: googleCallbackUrl(origin) } as passport.AuthenticateOptions,
      (error: unknown, user: UserDocument & { _id: string }) => {
        if (error || !user) {
          response.redirect(oauthFailure(origin, returnTo));
          return;
        }
        createSession(user._id.toString())
          .then((result) => {
            response.cookie(sessionCookie.name, result.sessionToken, sessionCookie.options);
            response.redirect(`${origin}${returnTo}`);
          })
          .catch(next);
      },
    )(request, response, next);
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
    const [organizer, committeeAssignment] = await Promise.all([
      Organizer.findOne({ ownerId: request.auth!.user._id }).lean(),
      CommitteeAssignment.exists({ userId: request.auth!.user._id }),
    ]);
    response.status(200).json({
      data: {
        user: userResponse(request.auth!.user),
        organizerId: organizer?._id.toString() ?? null,
        hasCommitteeAssignments: Boolean(committeeAssignment),
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
    response.clearCookie(sessionCookie.name, sessionCookie.options);
    response.status(204).send();
  }),
);
