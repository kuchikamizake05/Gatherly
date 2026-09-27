import { Router } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { processMidtransNotification } from "./payment-notification.service.js";

export const paymentRouter = Router();

paymentRouter.post(
  "/midtrans/notifications",
  asyncHandler(async (request, response) => {
    const result = await processMidtransNotification(request.body);
    response.status(200).json({ data: { received: true, duplicate: result.duplicate } });
  }),
);
