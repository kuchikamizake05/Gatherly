import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../lib/app-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireSession, requireCsrf, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import { requireAdmin } from "../admin/admin.middleware.js";
import { Refund } from "./refund.model.js";
import { Event } from "../events/event.models.js";
import {
  requestBuyerRefund,
  decideRefund,
  refundDto,
  validId,
  decideEventCancellation,
  completeManualRefund,
} from "./refund.service.js";

const requestSchema = z.object({
  reason: z.string().trim().min(10).max(1000),
  ticketIds: z
    .array(z.string().regex(/^[a-f\d]{24}$/i))
    .min(1)
    .max(4)
    .optional(),
});
const decision = z.object({ approve: z.boolean(), note: z.string().trim().min(3).max(1000) });
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) throw new AppError(400, "VALIDATION_ERROR", "Please check the submitted fields.");
  return r.data;
}
export const buyerRefundRouter = Router();
buyerRefundRouter.use(requireSession);
buyerRefundRouter.get(
  "/",
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const refunds = await Refund.find({ buyerId: req.auth!.user._id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ data: refunds.map(refundDto) });
  }),
);
buyerRefundRouter.post(
  "/orders/:orderId",
  requireCsrf,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const body = parse(requestSchema, req.body);
    res
      .status(201)
      .json({
        data: await requestBuyerRefund(
          String(req.params.orderId),
          req.auth!.user._id,
          body.reason,
          body.ticketIds,
        ),
      });
  }),
);
export const adminFinanceRouter = Router();
adminFinanceRouter.use(requireAdmin);
adminFinanceRouter.get(
  "/refunds",
  asyncHandler(async (req, res) => {
    const status = req.query.status
      ? parse(
          z.enum([
            "requested",
            "approved",
            "processing",
            "manual_required",
            "refunded",
            "rejected",
          ]),
          req.query.status,
        )
      : undefined;
    const refunds = await Refund.find(status ? { status } : {})
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({
      data: refunds.map(refundDto),
      meta: { page: 1, limit: 100, total: refunds.length },
    });
  }),
);
adminFinanceRouter.post(
  "/refunds/:id/decision",
  asyncHandler(async (req: any, res) => {
    const body = parse(decision, req.body);
    res.json({
      data: await decideRefund(String(req.params.id), req.admin.id, body.approve, body.note),
    });
  }),
);
adminFinanceRouter.post(
  "/refunds/:id/transferred",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        transferReference: z.string().trim().min(3).max(200),
        transferredAt: z.coerce
          .date()
          .refine((d) => d <= new Date(), "Transfer cannot be in the future"),
      }),
      req.body,
    );
    await completeManualRefund(String(req.params.id), body.transferReference, body.transferredAt);
    res.status(204).send();
  }),
);
adminFinanceRouter.get(
  "/cancellations",
  asyncHandler(async (_req, res) => {
    const events = await Event.find({ cancellationStatus: "requested" })
      .sort({ cancellationRequestedAt: 1 })
      .lean();
    res.json({
      data: events.map((e) => ({
        id: e._id.toString(),
        title: e.title,
        organizerId: e.organizerId.toString(),
        reason: e.cancellationReason,
        requestedAt: e.cancellationRequestedAt,
      })),
    });
  }),
);
adminFinanceRouter.post(
  "/cancellations/:id/decision",
  asyncHandler(async (req: any, res) => {
    const body = parse(decision, req.body);
    validId(String(req.params.id));
    res.json({
      data: await decideEventCancellation(
        String(req.params.id),
        req.admin.id,
        body.approve,
        body.note,
      ),
    });
  }),
);
