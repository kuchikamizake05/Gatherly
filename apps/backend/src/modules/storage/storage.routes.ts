import { Router } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import { StorageAsset, signedDocumentUrl } from "./storage.service.js";
export const mediaRouter = Router();
mediaRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id)) throw new AppError(404, "NOT_FOUND", "Media not found.");
    const asset = await StorageAsset.findOne({ _id: id, private: false });
    if (!asset) throw new AppError(404, "NOT_FOUND", "Media not found.");
    res.setHeader("Cache-Control", "private, max-age=60");
    res.redirect(await signedDocumentUrl(id));
  }),
);
