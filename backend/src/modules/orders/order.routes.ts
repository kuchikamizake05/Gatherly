import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";

import { AppError } from "../../lib/app-error.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { requireCsrf, requireSession, type AuthenticatedRequest } from "../auth/auth.middleware.js";
import { Order } from "./order.model.js";
import { createOrder, orderDto } from "./order.service.js";
import { createOrderSchema, idempotencyKeySchema, paginationSchema } from "./order.schemas.js";

function validationError(error: z.ZodError) {
  const fields = Object.fromEntries(
    error.issues.map((issue) => [issue.path.join(".") || "request", issue.message]),
  );
  return new AppError(400, "VALIDATION_ERROR", "Please check the submitted fields.", fields);
}

export const orderRouter = Router();
orderRouter.use(requireSession);

orderRouter.post(
  "/",
  requireCsrf,
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const body = createOrderSchema.safeParse(request.body);
    const key = idempotencyKeySchema.safeParse(request.get("Idempotency-Key"));
    if (!body.success) throw validationError(body.error);
    if (!key.success) {
      throw new AppError(400, "VALIDATION_ERROR", "A valid Idempotency-Key is required.", {
        idempotencyKey: "Idempotency-Key must be a UUID.",
      });
    }

    const result = await createOrder(request.auth!.user._id, key.data, body.data);
    response.status(result.created ? 201 : 200).json({ data: orderDto(result.order) });
  }),
);

orderRouter.get(
  "/",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const parsed = paginationSchema.safeParse(request.query);
    if (!parsed.success) throw validationError(parsed.error);
    const { page, limit } = parsed.data;
    const filter = { buyerId: request.auth!.user._id };
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
      Order.countDocuments(filter),
    ]);
    response.json({ data: orders.map(orderDto), meta: { page, limit, total } });
  }),
);

orderRouter.get(
  "/:id",
  asyncHandler(async (request: AuthenticatedRequest, response) => {
    const orderId = String(request.params.id);
    if (!Types.ObjectId.isValid(orderId)) {
      throw new AppError(404, "NOT_FOUND", "Order not found.");
    }
    const order = await Order.findOne({ _id: orderId, buyerId: request.auth!.user._id });
    if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
    response.json({ data: orderDto(order) });
  }),
);
