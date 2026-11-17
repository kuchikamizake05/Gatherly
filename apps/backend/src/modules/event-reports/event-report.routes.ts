import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import {
  requireSession,
  requireCsrf,
  validateAllowedOrigin,
  type AuthenticatedRequest,
} from "../auth/auth.middleware.js";
import { requireAdmin, type AdminRequest } from "../admin/admin.middleware.js";
import { parseInput } from "../account/account.schemas.js";
import {
  submitEventReport,
  listEventReports,
  getEventReport,
  closeEventReport,
} from "./event-report.service.js";

export const participantReportRouter = Router();
participantReportRouter.post(
  "/:slug/reports",
  requireSession,
  validateAllowedOrigin,
  requireCsrf,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    await submitEventReport(String(request.params.slug), request.auth!.user._id, request.body);
    response.status(201).json({ data: { submitted: true } });
  }),
);
export const adminEventReportRouter = Router();
adminEventReportRouter.use(requireAdmin);
adminEventReportRouter.get(
  "/reports",
  asyncHandler(async (request, response) => {
    const input = parseInput(
      z.object({
        tab: z.enum(["new", "done"]).default("new"),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      }),
      request.query,
    );
    response.json(await listEventReports(input.tab ?? "new", input.page ?? 1, input.limit ?? 20));
  }),
);
adminEventReportRouter.get(
  "/reports/:id",
  asyncHandler(async (request, response) => {
    response.json({ data: await getEventReport(String(request.params.id)) });
  }),
);
adminEventReportRouter.post(
  "/reports/:id/close",
  validateAllowedOrigin,
  asyncHandler(async (request: AdminRequest, response) => {
    const input = parseInput(
      z.object({ note: z.string().trim().min(1).max(2000) }).strict(),
      request.body,
    );
    await closeEventReport(String(request.params.id), request.admin!.id, input.note);
    response.status(204).send();
  }),
);
