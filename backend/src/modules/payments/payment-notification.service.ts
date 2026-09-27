import { createHash, timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";

import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { TicketType } from "../events/event.models.js";
import { Order } from "../orders/order.model.js";
import { PaymentEvent, type NormalizedPaymentStatus } from "./payment-event.model.js";

export const notificationSchema = z.object({
  order_id: z.string().min(1).max(50),
  status_code: z.string().min(1).max(10),
  gross_amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  signature_key: z.string().regex(/^[a-f\d]{128}$/i),
  transaction_status: z.string().min(1).max(50),
  transaction_id: z.string().min(1).max(100).optional(),
  fraud_status: z.string().max(30).optional(),
  currency: z.string().max(10).optional(),
  transaction_time: z.string().max(40).optional(),
  settlement_time: z.string().max(40).optional(),
}).passthrough();

export type MidtransNotification = z.infer<typeof notificationSchema>;

export function midtransSignature(payload: Pick<MidtransNotification, "order_id" | "status_code" | "gross_amount">) {
  return createHash("sha512")
    .update(`${payload.order_id}${payload.status_code}${payload.gross_amount}${env.MIDTRANS_SERVER_KEY}`)
    .digest("hex");
}

function validSignature(payload: MidtransNotification) {
  const expected = Buffer.from(midtransSignature(payload), "hex");
  const received = Buffer.from(payload.signature_key, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function amountInRupiah(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match || (match[2] && Number(match[2]) !== 0)) return null;
  const amount = Number(match[1]);
  return Number.isSafeInteger(amount) ? amount : null;
}

export function normalizeStatus(payload: {
  status_code: string;
  transaction_status: string;
  fraud_status?: string;
}): NormalizedPaymentStatus {
  const status = payload.transaction_status.toLowerCase();
  if (
    payload.status_code === "200" &&
    (status === "settlement" ||
      (status === "capture" && (!payload.fraud_status || payload.fraud_status.toLowerCase() === "accept")))
  ) return "paid";
  if (status === "pending") return "pending";
  if (status === "expire") return "expired";
  if (status === "deny" || status === "cancel") return "failed";
  return "review";
}

function verifiedTime(payload: MidtransNotification, fallback: Date) {
  const raw = payload.settlement_time ?? payload.transaction_time;
  if (!raw) return fallback;
  const parsed = new Date(`${raw.replace(" ", "T")}+07:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function fingerprint(payload: MidtransNotification) {
  return createHash("sha256").update(JSON.stringify({
    orderId: payload.order_id,
    transactionId: payload.transaction_id ?? null,
    status: payload.transaction_status,
    statusCode: payload.status_code,
    grossAmount: payload.gross_amount,
    fraudStatus: payload.fraud_status ?? null,
    transactionTime: payload.transaction_time ?? null,
    settlementTime: payload.settlement_time ?? null,
  })).digest("hex");
}

export async function applyPaymentStatus(
  orderId: string,
  normalizedStatus: NormalizedPaymentStatus,
  occurredAt: Date,
  paymentEventId?: string,
) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session);
      if (!order) throw new AppError(400, "INVALID_NOTIFICATION", "Payment notification is invalid.");
      let transition: string | undefined;

      if (normalizedStatus === "paid") {
        if (order.paymentStatus !== "paid" && order.reservationStatus === "held") {
          const inventory = await TicketType.updateOne(
            { _id: order.ticketTypeId, reserved: { $gte: order.quantity } },
            { $inc: { reserved: -order.quantity, sold: order.quantity } },
            { session },
          );
          if (inventory.modifiedCount === 1) {
            order.paymentStatus = "paid";
            order.reservationStatus = "converted";
            order.issuanceStatus = "processing";
            order.paymentSessionState = "closed";
            order.paidAt ??= occurredAt;
            transition = "paid";
          } else {
            order.paymentStatus = "paid";
            order.reconciliationRequired = true;
            order.reconciliationReason = "inventory_mismatch_on_paid";
          }
        } else if (order.paymentStatus !== "paid" && order.reservationStatus === "released") {
          order.paymentStatus = "paid";
          order.issuanceStatus = "not_ready";
          order.paymentSessionState = "closed";
          order.paidAt ??= occurredAt;
          order.reconciliationRequired = true;
          order.reconciliationReason = "paid_after_release";
          transition = "paid";
        }
      } else if (normalizedStatus === "failed" || normalizedStatus === "expired") {
        if (order.paymentStatus !== "paid" && order.reservationStatus === "held") {
          const inventory = await TicketType.updateOne(
            { _id: order.ticketTypeId, reserved: { $gte: order.quantity } },
            { $inc: { reserved: -order.quantity } },
            { session },
          );
          if (inventory.modifiedCount !== 1) {
            order.reconciliationRequired = true;
            order.reconciliationReason = "inventory_mismatch_on_release";
          } else {
            order.paymentStatus = normalizedStatus;
            order.reservationStatus = "released";
            order.paymentSessionState = "closed";
            transition = normalizedStatus;
          }
        }
      } else if (normalizedStatus === "review") {
        order.reconciliationRequired = true;
        order.reconciliationReason = "unsupported_provider_status";
      }

      if (transition && !order.paymentTimeline.some((item) => item.status === transition)) {
        order.paymentTimeline.push({ status: transition, at: occurredAt });
      }
      order.leaseUntil = undefined;
      await order.save({ session });

      if (paymentEventId) {
        await PaymentEvent.updateOne(
          { _id: paymentEventId },
          { $set: { processingStatus: "processed", processedAt: new Date() }, $unset: { errorCode: 1 } },
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }
}

export async function processMidtransNotification(input: unknown) {
  const parsed = notificationSchema.safeParse(input);
  if (!parsed.success || !validSignature(parsed.data)) {
    throw new AppError(400, "INVALID_NOTIFICATION", "Payment notification is invalid.");
  }
  const payload = parsed.data;
  const order = await Order.findOne({ providerOrderId: payload.order_id });
  const amount = amountInRupiah(payload.gross_amount);
  if (!order || amount !== order.totalAmount || (payload.currency && payload.currency !== "IDR")) {
    throw new AppError(400, "INVALID_NOTIFICATION", "Payment notification is invalid.");
  }

  const normalizedStatus = normalizeStatus(payload);
  const eventFingerprint = fingerprint(payload);
  let event = await PaymentEvent.findOne({ fingerprint: eventFingerprint });
  if (!event) {
    try {
      event = await PaymentEvent.create({
        providerOrderId: payload.order_id,
        providerTransactionId: payload.transaction_id,
        fingerprint: eventFingerprint,
        providerStatus: payload.transaction_status,
        normalizedStatus,
        processingStatus: "received",
        receivedAt: new Date(),
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
        event = await PaymentEvent.findOne({ fingerprint: eventFingerprint });
      } else throw error;
    }
  }
  if (!event) throw new AppError(503, "SERVICE_UNAVAILABLE", "Notification processing is unavailable.");
  if (event.processingStatus === "processed") return { duplicate: true };

  try {
    await applyPaymentStatus(order._id.toString(), normalizedStatus, verifiedTime(payload, new Date()), event._id.toString());
  } catch (error) {
    await PaymentEvent.updateOne(
      { _id: event._id },
      { $set: { processingStatus: "retry", errorCode: "processing_failed" } },
    );
    throw error;
  }
  return { duplicate: false };
}
