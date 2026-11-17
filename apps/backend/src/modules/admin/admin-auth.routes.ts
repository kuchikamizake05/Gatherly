import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import { createToken, hashToken } from "../../lib/crypto.js";
import { queueEmail } from "../notifications/email.service.js";
import { AdminAccount, AdminChallenge, AdminSession, AuditLog } from "./admin.models.js";
import { adminCookie, requireAdmin, type AdminRequest } from "./admin.middleware.js";
import { decryptTotpSecret, encryptTotpSecret, verifyTotp } from "./totp.js";

export const adminAuthRouter = Router();
adminAuthRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = z
      .object({
        email: z
          .string()
          .email()
          .toLowerCase()
          .refine((v) => v.endsWith("@gatherly.xyz"), "Work email is required"),
        password: z.string().min(1).max(128),
      })
      .parse(req.body);
    const account = await AdminAccount.findOne({ email, active: true });
    if (account?.lockedUntil && account.lockedUntil > new Date())
      throw new AppError(429, "ACCOUNT_LOCKED", "Account is temporarily locked.");
    if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
      if (account)
        await AdminAccount.updateOne(
          { _id: account._id },
          {
            $inc: { failures: 1 },
            ...(account.failures >= 4
              ? { $set: { lockedUntil: new Date(Date.now() + 600_000) } }
              : {}),
          },
        );
      throw new AppError(401, "UNAUTHENTICATED", "Email or password is incorrect.");
    }
    const challengeId = createToken();
    await AdminChallenge.create({
      accountId: account._id,
      tokenHash: hashToken(challengeId),
      expiresAt: new Date(Date.now() + 300_000),
    });
    res.json({ data: { challengeId } });
  }),
);

for (const method of ["totp", "backup-code"] as const)
  adminAuthRouter.post(
    `/${method}`,
    asyncHandler(async (req, res) => {
      const input = z
        .object({
          challengeId: z.string().min(20),
          code: z.string().trim().min(6).max(128),
          rememberDevice: z.boolean().optional(),
        })
        .parse(req.body);
      const challenge = await AdminChallenge.findOneAndUpdate(
        {
          tokenHash: hashToken(input.challengeId),
          expiresAt: { $gt: new Date() },
          usedAt: { $exists: false },
          attempts: { $lt: 5 },
        },
        { $inc: { attempts: 1 } },
        { returnDocument: "after" },
      );
      const account =
        challenge && (await AdminAccount.findOne({ _id: challenge.accountId, active: true }));
      if (!challenge || !account)
        throw new AppError(401, "CHALLENGE_INVALID", "Challenge is invalid or expired.");
      if (account.lockedUntil && account.lockedUntil > new Date())
        throw new AppError(429, "ACCOUNT_LOCKED", "Account is temporarily locked.");
      let valid = false;
      if (method === "totp") {
        const counter = verifyTotp(decryptTotpSecret(account.totpSecretEncrypted), input.code);
        if (counter !== null)
          valid = Boolean(
            await AdminAccount.findOneAndUpdate(
              {
                _id: account._id,
                $or: [
                  { lastTotpCounter: { $lt: counter } },
                  { lastTotpCounter: { $exists: false } },
                ],
              },
              { $set: { lastTotpCounter: counter } },
            ),
          );
      } else {
        valid = Boolean(
          await AdminAccount.findOneAndUpdate(
            { _id: account._id, backupCodeHashes: hashToken(input.code) },
            { $pull: { backupCodeHashes: hashToken(input.code) } },
          ),
        );
      }
      if (!valid) {
        await AdminAccount.updateOne(
          { _id: account._id },
          {
            $inc: { failures: 1 },
            ...(account.failures >= 4
              ? { $set: { lockedUntil: new Date(Date.now() + 600_000) } }
              : {}),
          },
        );
        throw new AppError(401, "CODE_INVALID", "Authentication code is invalid.");
      }
      const consumed = await AdminChallenge.findOneAndUpdate(
        { _id: challenge._id, usedAt: { $exists: false } },
        { $set: { usedAt: new Date() } },
      );
      if (!consumed) throw new AppError(409, "CHALLENGE_USED", "Challenge has already been used.");
      await AdminAccount.updateOne(
        { _id: account._id },
        { $set: { failures: 0 }, $unset: { lockedUntil: 1 } },
      );
      const token = createToken(),
        csrfToken = createToken();
      const maxAge = input.rememberDevice ? 7 * 86400_000 : 8 * 3600_000;
      await AdminSession.create({
        accountId: account._id,
        tokenHash: hashToken(token),
        csrfToken,
        expiresAt: new Date(Date.now() + maxAge),
      });
      await AuditLog.create({
        actorId: account.id,
        action: `admin.login.${method}`,
        targetId: account.id,
      });
      if (method === "backup-code") {
        const primary = await AdminAccount.findOne({ primary: true, active: true });
        if (primary)
          await queueEmail({
            key: `admin-backup:${challenge.id}`,
            to: primary.email,
            subject: "Kode cadangan admin Gatherly digunakan",
            text: `Kode cadangan digunakan oleh ${account.email}.`,
          });
      }
      res
        .cookie(adminCookie.name, token, { ...adminCookie.options, maxAge })
        .json({ data: { id: account.id, name: account.name, email: account.email, csrfToken } });
    }),
  );
adminAuthRouter.use(requireAdmin);
adminAuthRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const { id, name, email, csrfToken } = (req as AdminRequest).admin!;
    res.json({ data: { id, name, email, csrfToken } });
  }),
);
adminAuthRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await AdminSession.deleteOne({ _id: (req as AdminRequest).admin!.sessionId });
    res.clearCookie(adminCookie.name, adminCookie.options).sendStatus(204);
  }),
);

/** Called only from an operator-controlled seed command, never an HTTP endpoint. */
export async function seedAdmin(input: {
  email: string;
  name: string;
  password: string;
  totpSecret: string;
  backupCodes: string[];
  primary?: boolean;
}) {
  z.string()
    .email()
    .refine((v) => v.endsWith("@gatherly.xyz"))
    .parse(input.email);
  z.string().min(12).max(128).parse(input.password);
  if (await AdminAccount.exists({ email: input.email.toLowerCase() }))
    throw new AppError(409, "ADMIN_EXISTS", "Admin account already exists.");
  return AdminAccount.create({
    email: input.email.toLowerCase(),
    name: input.name,
    passwordHash: await bcrypt.hash(input.password, 12),
    totpSecretEncrypted: encryptTotpSecret(input.totpSecret),
    backupCodeHashes: input.backupCodes.map(hashToken),
    primary: input.primary ?? false,
  });
}
