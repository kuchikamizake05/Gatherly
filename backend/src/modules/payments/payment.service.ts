import { Types } from "mongoose";

import { AppError } from "../../lib/app-error.js";
import { Order, type OrderDocument } from "../orders/order.model.js";
import { createSnapTransaction, type SnapTransport } from "./midtrans.client.js";
import type { SnapRequest } from "./payment.schemas.js";

const providerMinimumRemainingMs = 20_000;
const creationLeaseMs = 30_000;

export type PaymentSessionResult =
  | { status: "ready"; snapToken: string; redirectUrl: string; expiresAt: Date }
  | { status: "creating" | "uncertain" };

function formatJakartaTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")} ${value("hour")}:${value("minute")}:${value("second")} +0700`;
}

export function snapPayload(order: OrderDocument & { _id: Types.ObjectId }): SnapRequest {
  return {
    transaction_details: {
      order_id: order.providerOrderId,
      gross_amount: order.totalAmount,
    },
    item_details: [
      {
        id: order.ticketTypeId.toString(),
        price: order.unitPrice,
        quantity: order.quantity,
        name: order.ticketTypeSnapshot.name.slice(0, 50),
      },
    ],
    customer_details: {
      first_name: order.buyerSnapshot.name,
      email: order.buyerSnapshot.email,
    },
    expiry: {
      start_time: formatJakartaTime(order.createdAt),
      unit: "minutes",
      duration: 15,
    },
  };
}

function readyResult(order: OrderDocument): PaymentSessionResult {
  if (!order.snapToken || !order.redirectUrl) {
    return { status: "uncertain" };
  }
  return {
    status: "ready",
    snapToken: order.snapToken,
    redirectUrl: order.redirectUrl,
    expiresAt: order.expiresAt,
  };
}

export async function createPaymentSession(
  orderId: string,
  buyerId: string,
  transport: SnapTransport = createSnapTransaction,
): Promise<PaymentSessionResult> {
  if (!Types.ObjectId.isValid(orderId)) {
    throw new AppError(404, "NOT_FOUND", "Order not found.");
  }

  const order = await Order.findOne({ _id: orderId, buyerId });
  if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
  const now = new Date();
  const terminal =
    order.paymentStatus !== "pending" ||
    order.reservationStatus !== "held" ||
    order.expiresAt.getTime() - now.getTime() <= providerMinimumRemainingMs;
  if (terminal || order.paymentSessionState === "closed") {
    await Order.updateOne(
      { _id: order._id },
      { $set: { paymentSessionState: "closed" }, $unset: { leaseUntil: 1 } },
    );
    throw new AppError(409, "ORDER_NOT_PAYABLE", "This order can no longer be paid.");
  }
  if (order.paymentSessionState === "ready") return readyResult(order);
  if (order.paymentSessionState === "creating" || order.paymentSessionState === "uncertain") {
    return { status: order.paymentSessionState };
  }

  const payable =
    order.paymentSessionState === "not_started" &&
    order.paymentStatus === "pending" &&
    order.reservationStatus === "held" &&
    order.expiresAt.getTime() - now.getTime() > providerMinimumRemainingMs;
  if (!payable) {
    await Order.updateOne(
      { _id: order._id, paymentSessionState: order.paymentSessionState },
      { $set: { paymentSessionState: "closed" }, $unset: { leaseUntil: 1 } },
    );
    throw new AppError(409, "ORDER_NOT_PAYABLE", "This order can no longer be paid.");
  }

  const claimed = await Order.findOneAndUpdate(
    {
      _id: order._id,
      buyerId,
      paymentSessionState: "not_started",
      paymentStatus: "pending",
      reservationStatus: "held",
      expiresAt: { $gt: new Date(now.getTime() + providerMinimumRemainingMs) },
    },
    {
      $set: {
        paymentSessionState: "creating",
        leaseUntil: new Date(now.getTime() + creationLeaseMs),
        nextReconcileAt: new Date(now.getTime() + creationLeaseMs),
      },
      $unset: { paymentSessionLastError: 1 },
      $inc: { paymentSessionAttempts: 1 },
    },
    { returnDocument: "after" },
  );
  if (!claimed) {
    const current = await Order.findOne({ _id: order._id, buyerId });
    if (!current) throw new AppError(404, "NOT_FOUND", "Order not found.");
    if (current.paymentSessionState === "ready") return readyResult(current);
    if (current.paymentSessionState === "creating" || current.paymentSessionState === "uncertain") {
      return { status: current.paymentSessionState };
    }
    throw new AppError(409, "ORDER_NOT_PAYABLE", "This order can no longer be paid.");
  }

  const providerResult = await transport(snapPayload(claimed));
  if (providerResult.kind === "success") {
    const ready = await Order.findOneAndUpdate(
      { _id: claimed._id, paymentSessionState: "creating" },
      {
        $set: {
          paymentSessionState: "ready",
          snapToken: providerResult.token,
          redirectUrl: providerResult.redirectUrl,
        },
        $unset: { leaseUntil: 1, paymentSessionLastError: 1 },
      },
      { returnDocument: "after" },
    );
    return ready ? readyResult(ready) : { status: "uncertain" };
  }

  if (providerResult.kind === "rejected") {
    await Order.updateOne(
      { _id: claimed._id, paymentSessionState: "creating" },
      {
        $set: { paymentSessionState: "not_started", paymentSessionLastError: `http_${providerResult.status}` },
        $unset: { leaseUntil: 1 },
      },
    );
    throw new AppError(502, "PROVIDER_REJECTED", "The payment provider rejected the session request.");
  }

  const errorCode = providerResult.kind === "rate_limited" ? "rate_limited" : providerResult.reason;
  await Order.updateOne(
    { _id: claimed._id, paymentSessionState: "creating" },
    {
      $set: {
        paymentSessionState: "uncertain",
        paymentSessionLastError: errorCode,
        nextReconcileAt: new Date(),
      },
      $unset: { leaseUntil: 1 },
    },
  );
  if (providerResult.kind === "rate_limited") {
    throw new AppError(503, "PROVIDER_UNAVAILABLE", "The payment provider is temporarily unavailable.");
  }
  return { status: "uncertain" };
}
