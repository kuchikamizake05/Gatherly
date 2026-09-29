import { Router } from "express";
import { z } from "zod";

import { AppError } from "../../lib/app-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireSession, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import { requireOrganizer } from "../authorization/authorization.middleware.js";
import {
  getOrganizerEventSummary,
  getOrganizerOrderDetail,
  getOrganizerSummary,
  listOrganizerAttendees,
  listOrganizerOrders,
} from "./organizer-report.service.js";
import {
  organizerAttendeeQuerySchema,
  organizerOrderQuerySchema,
  organizerSummaryQuerySchema,
} from "./organizer-report.schemas.js";

function validationError(error: z.ZodError) {
  const fields = Object.fromEntries(
    error.issues.map((issue) => [issue.path.join(".") || "request", issue.message]),
  );
  return new AppError(400, "VALIDATION_ERROR", "Please check the submitted fields.", fields);
}

export const organizerReportRouter = Router();
organizerReportRouter.use(requireSession, requireOrganizer);

organizerReportRouter.get(
  "/summary",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const query = organizerSummaryQuerySchema.safeParse(request.query);
    if (!query.success) throw validationError(query.error);
    response.json({ data: await getOrganizerSummary(request.auth!.organizerId!, query.data) });
  }),
);

organizerReportRouter.get(
  "/events/:eventId/summary",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    response.json({
      data: await getOrganizerEventSummary(
        String(request.params.eventId),
        request.auth!.organizerId!,
      ),
    });
  }),
);

organizerReportRouter.get(
  "/events/:eventId/orders",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const query = organizerOrderQuerySchema.safeParse(request.query);
    if (!query.success) throw validationError(query.error);
    response.json(
      await listOrganizerOrders(
        String(request.params.eventId),
        request.auth!.organizerId!,
        query.data,
      ),
    );
  }),
);

organizerReportRouter.get(
  "/events/:eventId/orders/:orderId",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    response.json({
      data: await getOrganizerOrderDetail(
        String(request.params.eventId),
        String(request.params.orderId),
        request.auth!.organizerId!,
      ),
    });
  }),
);

organizerReportRouter.get(
  "/events/:eventId/attendees",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const query = organizerAttendeeQuerySchema.safeParse(request.query);
    if (!query.success) throw validationError(query.error);
    response.json(
      await listOrganizerAttendees(
        String(request.params.eventId),
        request.auth!.organizerId!,
        query.data,
      ),
    );
  }),
);
