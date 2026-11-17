import mongoose from "mongoose";
import { AppError } from "../../lib/app-error.js";
import { env } from "../../config/env.js";
import { Order } from "./order.model.js";
import { TicketType } from "../events/event.models.js";
import { validId } from "../refunds/refund.service.js";
import { getTransactionStatus } from "../payments/midtrans.client.js";
import { applyPaymentStatus, normalizeStatus } from "../payments/payment-notification.service.js";
import { publishUpdate } from "../realtime/events.js";

export async function cancelPendingOrder(id: string, buyerId: string) {
  const order = await Order.findOne({ _id: validId(id), buyerId });
  if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
  if (order.cancelledAt) return;
  if (order.paymentStatus !== "pending" || order.reservationStatus !== "held")
    throw new AppError(409, "NOT_CANCELLABLE", "Only pending orders can be cancelled.");
  if (order.paymentSessionState === "not_started") {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const changed = await Order.findOneAndUpdate(
          {
            _id: order._id,
            paymentStatus: "pending",
            reservationStatus: "held",
            paymentSessionState: "not_started",
          },
          {
            $set: {
              paymentStatus: "failed",
              reservationStatus: "released",
              paymentSessionState: "closed",
              cancelledAt: new Date(),
              cancelledBy: "buyer",
            },
          },
          { session },
        );
        if (!changed)
          throw new AppError(409, "PAYMENT_CHANGED", "The payment changed. Please try again.");
        const stock = await TicketType.updateOne(
          { _id: order.ticketTypeId, reserved: { $gte: order.quantity } },
          { $inc: { reserved: -order.quantity } },
          { session },
        );
        if (stock.modifiedCount !== 1)
          throw new AppError(409, "RECONCILIATION_REQUIRED", "Inventory needs reconciliation.");
      });
    } finally {
      await session.endSession();
    }
  } else {
    // Never release an existing/uncertain provider session before its cancellation is verified.
    try {
      await fetch(
        `https://api.sandbox.midtrans.com/v2/${encodeURIComponent(order.providerOrderId)}/cancel`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${env.MIDTRANS_SERVER_KEY}:`).toString("base64")}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(env.MIDTRANS_REQUEST_TIMEOUT_MS),
        },
      );
    } catch {
      /* Verify the authoritative state below even after an uncertain response. */
    }
    const result = await getTransactionStatus(order.providerOrderId);
    if (result.kind !== "found")
      throw new AppError(
        409,
        "CANCELLATION_PENDING",
        "Cancellation is being verified. The reservation is still held.",
      );
    const state = result.payload.transaction_status;
    if (normalizeStatus(result.payload) === "paid") {
      await applyPaymentStatus(id, "paid", new Date());
      throw new AppError(409, "ALREADY_PAID", "Payment has already succeeded.");
    }
    if (!["cancel", "deny", "expire", "failure"].includes(state))
      throw new AppError(
        409,
        "CANCELLATION_PENDING",
        "Cancellation is not confirmed by the provider.",
      );
    await applyPaymentStatus(id, state === "expire" ? "expired" : "failed", new Date());
    await Order.updateOne(
      { _id: order._id, reservationStatus: "released", paymentStatus: { $ne: "paid" } },
      { $set: { cancelledAt: new Date(), cancelledBy: "buyer" } },
    );
  }
  await publishUpdate({ topic: "order", id, type: "order.cancelled" });
}
