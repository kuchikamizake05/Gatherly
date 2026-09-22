import type { NextFunction, Response } from "express";
import { Types } from "mongoose";

import { AppError } from "../../lib/app-error.js";
import { CommitteeAssignment } from "../committee/committee-assignment.model.js";
import { Organizer } from "../organizers/organizer.model.js";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";

export async function requireOrganizer(
  request: AuthenticatedRequest,
  _response: Response,
  next: NextFunction,
) {
  try {
    const organizer = await Organizer.findOne({ ownerId: request.auth!.user._id }).lean();
    if (!organizer) {
      throw new AppError(403, "FORBIDDEN", "An organizer profile is required.");
    }
    request.auth!.organizerId = organizer._id.toString();
    next();
  } catch (error) {
    next(error);
  }
}

export function requireCommitteeAssignment(eventId: string) {
  return async (request: AuthenticatedRequest, _response: Response, next: NextFunction) => {
    try {
      if (!Types.ObjectId.isValid(eventId)) {
        throw new AppError(404, "NOT_FOUND", "Event not found.");
      }
      const assignment = await CommitteeAssignment.exists({
        eventId: new Types.ObjectId(eventId),
        userId: request.auth!.user._id,
      });
      if (!assignment) {
        throw new AppError(403, "FORBIDDEN", "Committee access is required.");
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
