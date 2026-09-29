import { createHmac, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose, { Types } from "mongoose";

import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { createToken, hashToken } from "../../lib/crypto.js";
import { AuthChallenge, OAuthState, Session, User } from "./auth.models.js";
import { sendOtpEmail, type OtpMailer } from "./auth-mailer.js";

const otpLifetimeMs = 10 * 60_000;
const resendCooldownMs = 60_000;
const oauthStateLifetimeMs = 10 * 60_000;
const maxAttempts = 5;
const dummyPasswordHash = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.ouN9q0AqNk.MW4f7VfM4eWcLZb3S9Pi";

function otpSecret(secret?: string) {
  const value = secret ?? env.OTP_SECRET;
  if (!value) throw new AppError(503, "SERVICE_UNAVAILABLE", "Authentication is unavailable.");
  return value;
}

function otpCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function otpHash(challengeId: string, code: string, secret?: string) {
  return createHmac("sha256", otpSecret(secret)).update(`${challengeId}:${code}`).digest("hex");
}

export function userResponse(user: { _id: { toString(): string }; name: string; emailNormalized: string }) {
  return { id: user._id.toString(), name: user.name, email: user.emailNormalized };
}

export async function createSession(userId: string, databaseSession?: mongoose.ClientSession) {
  const sessionToken = createToken();
  const csrfToken = createToken();
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const [session] = await Session.create(
    [{ tokenHash: hashToken(sessionToken), csrfTokenHash: hashToken(csrfToken), userId, expiresAt }],
    databaseSession ? { session: databaseSession } : undefined,
  );
  return { sessionToken, csrfToken, sessionId: session!._id.toString() };
}

async function createChallenge(
  values: {
    purpose: "register" | "login";
    emailNormalized: string;
    userId?: Types.ObjectId;
    name?: string;
    passwordHash?: string;
  },
  mailer: OtpMailer,
  now: Date,
  secret?: string,
) {
  const _id = new Types.ObjectId();
  const code = otpCode();
  const expiresAt = new Date(now.getTime() + otpLifetimeMs);
  const resendAt = new Date(now.getTime() + resendCooldownMs);
  await AuthChallenge.updateMany(
    { emailNormalized: values.emailNormalized, purpose: values.purpose, usedAt: { $exists: false } },
    { $set: { usedAt: now } },
  );
  const challenge = await AuthChallenge.create({
    _id,
    ...values,
    codeHash: otpHash(_id.toString(), code, secret),
    expiresAt,
    resendAt,
    attempts: 0,
  });
  try {
    await mailer({ to: values.emailNormalized, code, purpose: values.purpose });
  } catch (error) {
    await AuthChallenge.deleteOne({ _id: challenge._id });
    if (error instanceof AppError) throw error;
    throw new AppError(503, "EMAIL_UNAVAILABLE", "Email delivery is unavailable.");
  }
  return { challengeId: challenge._id.toString(), expiresAt, resendAt };
}

export async function beginRegistration(
  input: { name: string; email: string; password: string },
  options: { mailer?: OtpMailer; now?: Date; secret?: string } = {},
) {
  const emailNormalized = input.email.trim().toLowerCase();
  if (await User.exists({ emailNormalized })) {
    throw new AppError(409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists.");
  }
  return createChallenge(
    {
      purpose: "register",
      emailNormalized,
      name: input.name.trim(),
      passwordHash: await bcrypt.hash(input.password, 12),
    },
    options.mailer ?? sendOtpEmail,
    options.now ?? new Date(),
    options.secret,
  );
}

export async function beginLogin(
  input: { email: string; password: string },
  options: { mailer?: OtpMailer; now?: Date; secret?: string } = {},
) {
  const emailNormalized = input.email.trim().toLowerCase();
  const user = await User.findOne({ emailNormalized });
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? dummyPasswordHash);
  if (!user || !user.passwordHash || !valid) {
    throw new AppError(401, "UNAUTHENTICATED", "Email or password is incorrect.");
  }
  return createChallenge(
    { purpose: "login", emailNormalized, userId: user._id },
    options.mailer ?? sendOtpEmail,
    options.now ?? new Date(),
    options.secret,
  );
}

async function getChallenge(challengeId: string, purpose: "register" | "login", now: Date) {
  if (!Types.ObjectId.isValid(challengeId)) {
    throw new AppError(400, "VALIDATION_ERROR", "Challenge ID is invalid.");
  }
  const challenge = await AuthChallenge.findOne({ _id: challengeId, purpose });
  if (!challenge) throw new AppError(401, "UNAUTHENTICATED", "Verification challenge is invalid.");
  if (challenge.usedAt) throw new AppError(409, "OTP_ALREADY_USED", "Verification code was already used.");
  if (challenge.expiresAt <= now) throw new AppError(409, "OTP_EXPIRED", "Verification code has expired.");
  if (challenge.attempts >= maxAttempts) throw new AppError(409, "OTP_LOCKED", "Verification challenge is locked.");
  return challenge;
}

async function assertCode(
  challengeId: string,
  purpose: "register" | "login",
  code: string,
  now: Date,
  secret?: string,
) {
  const challenge = await getChallenge(challengeId, purpose, now);
  if (challenge.codeHash !== otpHash(challengeId, code, secret)) {
    const updated = await AuthChallenge.findOneAndUpdate(
      { _id: challenge._id, usedAt: { $exists: false }, attempts: { $lt: maxAttempts } },
      { $inc: { attempts: 1 } },
      { returnDocument: "after" },
    );
    if ((updated?.attempts ?? maxAttempts) >= maxAttempts) {
      throw new AppError(409, "OTP_LOCKED", "Verification challenge is locked.");
    }
    throw new AppError(409, "OTP_INVALID", "Verification code is invalid.");
  }
  return challenge;
}

export async function verifyRegistration(
  challengeId: string,
  code: string,
  options: { now?: Date; secret?: string } = {},
) {
  const now = options.now ?? new Date();
  const challenge = await assertCode(challengeId, "register", code, now, options.secret);
  const databaseSession = await mongoose.startSession();
  let result: { user: ReturnType<typeof userResponse>; sessionToken: string; csrfToken: string } | undefined;
  try {
    await databaseSession.withTransaction(async () => {
      const consumed = await AuthChallenge.findOneAndUpdate(
        { _id: challenge._id, usedAt: { $exists: false }, expiresAt: { $gt: now }, attempts: { $lt: maxAttempts } },
        { $set: { usedAt: now } },
        { session: databaseSession, returnDocument: "after" },
      );
      if (!consumed) throw new AppError(409, "OTP_ALREADY_USED", "Verification code was already used.");
      if (!consumed.name || !consumed.passwordHash) throw new Error("Registration challenge is incomplete.");
      if (await User.exists({ emailNormalized: consumed.emailNormalized }).session(databaseSession)) {
        throw new AppError(409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists.");
      }
      const [user] = await User.create(
        [{ name: consumed.name, emailNormalized: consumed.emailNormalized, passwordHash: consumed.passwordHash, emailVerifiedAt: now }],
        { session: databaseSession },
      );
      const authSession = await createSession(user!._id.toString(), databaseSession);
      result = { user: userResponse(user!), sessionToken: authSession.sessionToken, csrfToken: authSession.csrfToken };
    });
  } finally {
    await databaseSession.endSession();
  }
  if (!result) throw new AppError(503, "SERVICE_UNAVAILABLE", "Registration could not be completed.");
  return result;
}

export async function verifyLogin(
  challengeId: string,
  code: string,
  options: { now?: Date; secret?: string } = {},
) {
  const now = options.now ?? new Date();
  const challenge = await assertCode(challengeId, "login", code, now, options.secret);
  const databaseSession = await mongoose.startSession();
  let result: { user: ReturnType<typeof userResponse>; sessionToken: string; csrfToken: string } | undefined;
  try {
    await databaseSession.withTransaction(async () => {
      const consumed = await AuthChallenge.findOneAndUpdate(
        { _id: challenge._id, usedAt: { $exists: false }, expiresAt: { $gt: now }, attempts: { $lt: maxAttempts } },
        { $set: { usedAt: now } },
        { session: databaseSession, returnDocument: "after" },
      );
      if (!consumed?.userId) throw new AppError(409, "OTP_ALREADY_USED", "Verification code was already used.");
      const user = await User.findById(consumed.userId).session(databaseSession);
      if (!user) throw new AppError(401, "UNAUTHENTICATED", "Verification challenge is invalid.");
      user.emailVerifiedAt ??= now;
      await user.save({ session: databaseSession });
      const authSession = await createSession(user._id.toString(), databaseSession);
      result = { user: userResponse(user), sessionToken: authSession.sessionToken, csrfToken: authSession.csrfToken };
    });
  } finally {
    await databaseSession.endSession();
  }
  if (!result) throw new AppError(503, "SERVICE_UNAVAILABLE", "Login could not be completed.");
  return result;
}

export async function resendOtp(
  challengeId: string,
  options: { mailer?: OtpMailer; now?: Date; secret?: string } = {},
) {
  const now = options.now ?? new Date();
  if (!Types.ObjectId.isValid(challengeId)) throw new AppError(400, "VALIDATION_ERROR", "Challenge ID is invalid.");
  const challenge = await AuthChallenge.findById(challengeId);
  if (!challenge || challenge.usedAt) throw new AppError(409, "OTP_ALREADY_USED", "Verification challenge is unavailable.");
  if (challenge.expiresAt <= now) throw new AppError(409, "OTP_EXPIRED", "Verification code has expired.");
  if (challenge.attempts >= maxAttempts) throw new AppError(409, "OTP_LOCKED", "Verification challenge is locked.");
  if (challenge.resendAt > now) throw new AppError(429, "RATE_LIMITED", "Please wait before requesting another code.");
  const code = otpCode();
  const expiresAt = new Date(now.getTime() + otpLifetimeMs);
  const resendAt = new Date(now.getTime() + resendCooldownMs);
  const codeHash = otpHash(challengeId, code, options.secret);
  const updated = await AuthChallenge.findOneAndUpdate(
    {
      _id: challenge._id,
      usedAt: { $exists: false },
      expiresAt: { $gt: now },
      resendAt: { $lte: now },
      attempts: { $lt: maxAttempts },
    },
    { $set: { codeHash, expiresAt, resendAt, attempts: 0 } },
  );
  if (!updated) throw new AppError(429, "RATE_LIMITED", "Please wait before requesting another code.");
  try {
    await (options.mailer ?? sendOtpEmail)({ to: challenge.emailNormalized, code, purpose: challenge.purpose });
  } catch (error) {
    await AuthChallenge.updateOne(
      { _id: challenge._id, codeHash, usedAt: { $exists: false } },
      {
        $set: {
          codeHash: challenge.codeHash,
          expiresAt: challenge.expiresAt,
          resendAt: challenge.resendAt,
          attempts: challenge.attempts,
        },
      },
    );
    if (error instanceof AppError) throw error;
    throw new AppError(503, "EMAIL_UNAVAILABLE", "Email delivery is unavailable.");
  }
  return { expiresAt, resendAt };
}

export async function createOAuthState(now = new Date()) {
  const state = createToken();
  await OAuthState.create({ stateHash: hashToken(state), expiresAt: new Date(now.getTime() + oauthStateLifetimeMs) });
  return state;
}

export async function consumeOAuthState(state: string, cookieState: string, now = new Date()) {
  if (!state || state !== cookieState) return false;
  const consumed = await OAuthState.findOneAndUpdate(
    { stateHash: hashToken(state), usedAt: { $exists: false }, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
  );
  return Boolean(consumed);
}

export async function resolveGoogleUser(profile: { id: string; displayName: string; email: string; emailVerified: boolean }) {
  if (!profile.emailVerified) throw new AppError(401, "UNAUTHENTICATED", "Google email is not verified.");
  const emailNormalized = profile.email.trim().toLowerCase();
  const byGoogleId = await User.findOne({ googleId: profile.id });
  if (byGoogleId) return byGoogleId;
  const byEmail = await User.findOne({ emailNormalized });
  if (byEmail) {
    byEmail.googleId = profile.id;
    byEmail.emailVerifiedAt ??= new Date();
    await byEmail.save();
    return byEmail;
  }
  return User.create({
    name: profile.displayName.trim() || emailNormalized.split("@")[0],
    emailNormalized,
    googleId: profile.id,
    emailVerifiedAt: new Date(),
  });
}
