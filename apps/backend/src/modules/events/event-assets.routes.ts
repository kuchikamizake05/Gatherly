import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import { requireSession, requireCsrf, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import { requireOrganizer } from "../authorization/authorization.middleware.js";
import { multipartUpload } from "../storage/storage.middleware.js";
import { storeUpload } from "../storage/storage.service.js";
export const organizerAssetsRouter = Router();
organizerAssetsRouter.use(requireSession, requireOrganizer);
organizerAssetsRouter.post(
  "/posters",
  requireCsrf,
  multipartUpload,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.file || !req.file.mimetype.startsWith("image/"))
      throw new AppError(400, "INVALID_FILE_TYPE", "Select a poster image.");
    const asset = await storeUpload(req.file, {
      ownerId: req.auth!.user._id,
      purpose: "event-image",
      private: false,
    });
    res.status(201).json({ data: { assetId: asset.id, url: `/api/v1/media/${asset.id}` } });
  }),
);
