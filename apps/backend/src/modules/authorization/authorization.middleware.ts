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
    const workspace = (
      request as unknown as {
        workspace?: { account: { mustChangePassword: boolean; role: string } };
      }
    ).workspace;
    if (workspace?.account.mustChangePassword)
      throw new AppError(403, "PASSWORD_CHANGE_REQUIRED", "Change the temporary password first.");
    if (workspace && workspace.account.role !== "organizer")
      throw new AppError(403, "FORBIDDEN", "Organizer access is required.");
    if (organizer.status === "frozen" && !["GET", "HEAD", "OPTIONS"].includes(request.method))
      throw new AppError(403, "ORGANIZER_FROZEN", "Organizer writes are disabled.");
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
