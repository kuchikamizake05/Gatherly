import { Router } from "express";
import { z } from "zod";

import { AppError } from "../../lib/app-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireCsrf, requireSession, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import {
  checkInTicket,
  findCommitteeTickets,
  getCheckInHistory,
} from "./check-in.service.js";
import {
  checkInHistoryQuerySchema,
  checkInSchema,
  committeeTicketQuerySchema,
} from "./check-in.schemas.js";

function validationError(error: z.ZodError) {
  const fields = Object.fromEntries(
    error.issues.map((issue) => [issue.path.join(".") || "request", issue.message]),
  );
  return new AppError(400, "VALIDATION_ERROR", "Please check the submitted fields.", fields);
}

export const checkInRouter = Router();
checkInRouter.use(requireSession);

checkInRouter.get(
  "/:eventId/tickets",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const query = committeeTicketQuerySchema.safeParse(request.query);
    if (!query.success) throw validationError(query.error);
    response.json(
      await findCommitteeTickets(String(request.params.eventId), request.auth!.user._id, query.data),
    );
  }),
);

checkInRouter.get(
  "/:eventId/check-ins",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const query = checkInHistoryQuerySchema.safeParse(request.query);
    if (!query.success) throw validationError(query.error);
    response.json(
      await getCheckInHistory(String(request.params.eventId), request.auth!.user._id, query.data),
    );
  }),
);

checkInRouter.post(
  "/:eventId/check-ins",
  requireCsrf,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const body = checkInSchema.safeParse(request.body);
    if (!body.success) throw validationError(body.error);
    response.json({
      data: await checkInTicket(
        String(request.params.eventId),
        request.auth!.user._id,
        body.data,
      ),
    });
  }),
);
