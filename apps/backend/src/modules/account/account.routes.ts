import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../lib/app-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import {
  requireSession,
  requireCsrf,
  validateAllowedOrigin,
  sessionCookie,
  type AuthenticatedRequest,
} from "../auth/auth.middleware.js";
import { User, Session } from "../auth/auth.models.js";
import { multipartUpload } from "../storage/storage.middleware.js";
import { publicAssetUrl, StorageAsset, storeUpload } from "../storage/storage.service.js";
import {
  accountView,
  changeParticipantPassword,
  deleteParticipantAccount,
  forgotPassword,
  resetPassword,
} from "./account.service.js";
import {
  parseInput,
  profileSchema,
  passwordSchema,
  notificationsSchema,
  forgotSchema,
  resetSchema,
} from "./account.schemas.js";

export const accountRouter = Router();
accountRouter.use(requireSession);
accountRouter.get(
  "/",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    response.json({ data: await accountView(request.auth!.user._id) });
  }),
);
accountRouter.use(validateAllowedOrigin, requireCsrf);
accountRouter.patch(
  "/",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const input = parseInput(profileSchema, request.body);
    await User.updateOne(
      { _id: request.auth!.user._id, deletedAt: { $exists: false } },
      { $set: input },
    );
    response.json({ data: await accountView(request.auth!.user._id) });
  }),
);
accountRouter.post(
  "/avatar",
  multipartUpload,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const file = (
      request as AuthenticatedRequest & {
        file?: { buffer: Buffer; originalname: string; mimetype: string; size: number };
      }
    ).file;
    if (
      !file ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype) ||
      file.size > 1_048_576
    ) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Choose a JPG, PNG, or WebP image no larger than 1 MB.",
      );
    }
    const stored = await storeUpload(file, {
      ownerId: request.auth!.user._id,
      purpose: "avatar",
      private: false,
    });
    const avatarUrl = await publicAssetUrl(stored.id);
    await User.updateOne({ _id: request.auth!.user._id }, { $set: { avatarUrl } });
    await StorageAsset.updateOne({ _id: stored.id }, { $set: { attachedAt: new Date() } });
    response.json({ data: { avatarUrl } });
  }),
);
accountRouter.post(
  "/password",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    await changeParticipantPassword(
      request.auth!.user._id,
      request.auth!.sessionId,
      parseInput(passwordSchema, request.body),
    );
    response.status(204).send();
  }),
);
accountRouter.delete(
  "/google",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const changed = await User.updateOne(
      {
        _id: request.auth!.user._id,
        passwordHash: { $type: "string" },
        deletedAt: { $exists: false },
      },
      { $unset: { googleId: 1 } },
    );
    if (!changed.matchedCount)
      throw new AppError(409, "PASSWORD_REQUIRED", "Create a password before unlinking Google.");
    response.status(204).send();
  }),
);
accountRouter.post(
  "/sessions/revoke-others",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const result = await Session.deleteMany({
      userId: request.auth!.user._id,
      _id: { $ne: request.auth!.sessionId },
    });
    response.json({ data: { signedOut: result.deletedCount } });
  }),
);
accountRouter.patch(
  "/notifications",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const input = parseInput(notificationsSchema, request.body);
    await User.updateOne({ _id: request.auth!.user._id }, { $set: { notifications: input } });
    response.status(204).send();
  }),
);
accountRouter.post(
  "/delete",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const { confirmation } = parseInput(
      z.object({ confirmation: z.string().trim() }).strict(),
      request.body,
    );
    if (confirmation.toLowerCase() !== "hapus" && confirmation.toLowerCase() !== "hapus akun")
      throw new AppError(400, "VALIDATION_ERROR", "Type hapus akun to confirm account deletion.");
    await deleteParticipantAccount(request.auth!.user._id);
    response.clearCookie(sessionCookie.name, sessionCookie.options);
    response.status(204).send();
  }),
);

// Mount at /api/v1/auth before the normal auth router. Root supplies database-backed rate limiting.
export const participantPasswordRouter = Router();
participantPasswordRouter.use(validateAllowedOrigin);
participantPasswordRouter.post(
  "/password/forgot",
  asyncHandler(async (request, response) => {
    await forgotPassword(parseInput(forgotSchema, request.body).email);
    response.status(204).send();
  }),
);
participantPasswordRouter.post(
  "/password/reset",
  asyncHandler(async (request, response) => {
    const input = parseInput(resetSchema, request.body);
    await resetPassword(input.token, input.password);
    response.status(204).send();
  }),
);
