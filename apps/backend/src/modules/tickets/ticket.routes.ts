import { Router } from "express";
import { Types } from "mongoose";

import { AppError } from "../../lib/app-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireSession, requireCsrf, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import { notifyOrderTickets, resendBatchKey } from "../notifications/tickets.js";
import { Order } from "../orders/order.model.js";
import { paginationSchema } from "../orders/order.schemas.js";
import { Ticket } from "./ticket.model.js";
import { ticketDetailDto, ticketListDto } from "./ticket.service.js";

export const ticketRouter = Router();
ticketRouter.get(
  "/shared/:token",
  asyncHandler(async (req, res) => {
    const token = String(req.params.token);
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new AppError(404, "NOT_FOUND", "Ticket not found.");
    const ticket = await Ticket.findOne({ qrToken: token }).select("+qrToken");
    if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.json({ data: ticketDetailDto(ticket) });
  }),
);
ticketRouter.use(requireSession);

export const ticketDeliveryRouter = Router();
ticketDeliveryRouter.post(
  "/:orderId/tickets/resend",
  requireSession,
  requireCsrf,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!Types.ObjectId.isValid(String(req.params.orderId)))
      throw new AppError(404, "NOT_FOUND", "Order not found.");
    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.orderId,
        buyerId: req.auth!.user._id,
        issuanceStatus: "issued",
        $or: [
          { lastTicketResendAt: { $exists: false } },
          { lastTicketResendAt: { $lt: new Date(Date.now() - 60_000) } },
        ],
      },
      { $set: { lastTicketResendAt: new Date() } },
      { strict: false, returnDocument: "after" },
    );
    if (!order)
      throw new AppError(
        409,
        "RESEND_UNAVAILABLE",
        "Tickets cannot be resent yet. Wait 60 seconds and retry.",
      );
    await notifyOrderTickets(order.id, resendBatchKey());
    res.status(204).end();
  }),
);

ticketRouter.get(
  "/",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const parsed = paginationSchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Please check the submitted fields.", {
        pagination: "Page and limit must be valid positive integers.",
      });
    }
    const { page, limit } = parsed.data;
    const filter = { buyerId: request.auth!.user._id };
    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Ticket.countDocuments(filter),
    ]);
    response.json({ data: tickets.map(ticketListDto), meta: { page, limit, total } });
  }),
);

ticketRouter.get(
  "/:ticketId",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const ticketId = String(request.params.ticketId);
    if (!Types.ObjectId.isValid(ticketId)) {
      throw new AppError(404, "NOT_FOUND", "Ticket not found.");
    }
    const ticket = await Ticket.findOne({
      _id: ticketId,
      buyerId: request.auth!.user._id,
    }).select("+qrToken");
    if (!ticket) throw new AppError(404, "NOT_FOUND", "Ticket not found.");
    response.json({ data: ticketDetailDto(ticket) });
  }),
);
