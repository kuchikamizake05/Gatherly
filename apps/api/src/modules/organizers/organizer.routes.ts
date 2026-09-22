import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";

import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import { requireCsrf, requireSession, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import { Organizer } from "./organizer.model.js";

const organizerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(1).max(2_000),
  contactEmail: z.string().trim().email().max(254),
});

function organizerResponse(organizer: { _id: Types.ObjectId; name: string; description: string; contactEmail: string }) {
  return {
    id: organizer._id.toString(),
    name: organizer.name,
    description: organizer.description,
    contactEmail: organizer.contactEmail,
  };
}

export const organizerRouter = Router();

organizerRouter.post(
  "/",
  requireSession,
  requireCsrf,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const parsed = organizerSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Please check the submitted fields.");
    }
    const existingOrganizer = await Organizer.exists({ ownerId: request.auth!.user._id });
    if (existingOrganizer) {
      throw new AppError(409, "CONFLICT", "An organizer profile already exists.");
    }
    const organizer = await Organizer.create({
      ...parsed.data,
      contactEmail: parsed.data.contactEmail.toLowerCase(),
      ownerId: request.auth!.user._id,
    });
    response.status(201).json({ data: organizerResponse(organizer) });
  }),
);

organizerRouter.get(
  "/me",
  requireSession,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const organizer = await Organizer.findOne({ ownerId: request.auth!.user._id }).lean();
    if (!organizer) {
      throw new AppError(404, "NOT_FOUND", "Organizer profile not found.");
    }
    response.status(200).json({ data: organizerResponse(organizer) });
  }),
);
