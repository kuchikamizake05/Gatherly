import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import {
  requireSession,
  requireCsrf,
  validateAllowedOrigin,
  type AuthenticatedRequest,
} from "../auth/auth.middleware.js";
import { parseInput } from "../account/account.schemas.js";
import { Event } from "../events/event.models.js";
import { SavedEvent } from "./saved-event.model.js";
import { saveEvent, savedEventList, publicOrganizerProfile } from "./saved-event.service.js";

export const savedEventRouter = Router();
savedEventRouter.use(requireSession);
savedEventRouter.get(
  "/saved-events",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const { page, limit } = parseInput(
      z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      }),
      request.query,
    );
    response.json(await savedEventList(request.auth!.user._id, page, limit));
  }),
);
savedEventRouter.put(
  "/saved-events/:slug",
  validateAllowedOrigin,
  requireCsrf,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    await saveEvent(request.auth!.user._id, String(request.params.slug));
    response.status(204).send();
  }),
);
savedEventRouter.delete(
  "/saved-events/:slug",
  validateAllowedOrigin,
  requireCsrf,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const event = await Event.findOne({ slug: String(request.params.slug) }).lean();
    if (event) await SavedEvent.deleteOne({ userId: request.auth!.user._id, eventId: event._id });
    response.status(204).send();
  }),
);

export const publicOrganizerRouter = Router();
publicOrganizerRouter.get(
  "/:username/profile",
  asyncHandler(async (request, response) => {
    response.json({ data: await publicOrganizerProfile(String(request.params.username)) });
  }),
);
