import { Router } from "express";
import { Types } from "mongoose";

import { AppError } from "../../lib/app-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireSession, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import { paginationSchema } from "../orders/order.schemas.js";
import { Ticket } from "./ticket.model.js";
import { ticketDetailDto, ticketListDto } from "./ticket.service.js";

export const ticketRouter = Router();
ticketRouter.use(requireSession);

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
      Ticket.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
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
