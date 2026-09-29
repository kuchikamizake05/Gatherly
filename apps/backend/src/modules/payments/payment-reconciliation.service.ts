import { Order } from "../orders/order.model.js";
import {
  getTransactionStatus,
  type StatusTransport,
} from "./midtrans.client.js";
import type { TransactionStatusPayload } from "./payment.schemas.js";
import { applyPaymentStatus, normalizeStatus } from "./payment-notification.service.js";

const leaseMs = 30_000;
const retryMs = 60_000;

function amountInRupiah(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match || (match[2] && Number(match[2]) !== 0)) return null;
  const amount = Number(match[1]);
  return Number.isSafeInteger(amount) ? amount : null;
}

function providerTime(payload: TransactionStatusPayload) {
  const raw = payload.settlement_time ?? payload.transaction_time;
  if (!raw) return new Date();
  const parsed = new Date(`${raw.replace(" ", "T")}+07:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function reschedule(orderId: string, delay = retryMs) {
  await Order.updateOne(
    { _id: orderId },
    { $set: { nextReconcileAt: new Date(Date.now() + delay) }, $unset: { leaseUntil: 1 } },
  );
}

export async function reconcileDuePayments(
  transport: StatusTransport = getTransactionStatus,
  limit = 20,
) {
  let processed = 0;
  for (let index = 0; index < limit; index += 1) {
    const now = new Date();
    const order = await Order.findOneAndUpdate(
      {
        paymentStatus: "pending",
        reservationStatus: "held",
        nextReconcileAt: { $lte: now },
        $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }],
      },
      { $set: { leaseUntil: new Date(now.getTime() + leaseMs) } },
      { sort: { nextReconcileAt: 1 }, returnDocument: "after" },
    );
    if (!order) break;
    processed += 1;

    if (
      order.expiresAt <= now &&
      order.paymentSessionState === "not_started" &&
      order.paymentSessionAttempts === 0
    ) {
      await applyPaymentStatus(order._id.toString(), "expired", now);
      continue;
    }

    const result = await transport(order.providerOrderId);
    if (result.kind === "unavailable") {
      await reschedule(order._id.toString());
      continue;
    }
    if (result.kind === "not_found") {
      if (order.expiresAt > now) {
        await reschedule(order._id.toString());
      } else if (order.reconcileMisses >= 1) {
        await applyPaymentStatus(order._id.toString(), "expired", now);
      } else {
        await Order.updateOne(
          { _id: order._id },
          {
            $inc: { reconcileMisses: 1 },
            $set: { paymentSessionState: "closed", nextReconcileAt: new Date(now.getTime() + 30_000) },
            $unset: { leaseUntil: 1 },
          },
        );
      }
      continue;
    }

    const payload = result.payload;
    if (
      payload.order_id !== order.providerOrderId ||
      amountInRupiah(payload.gross_amount) !== order.totalAmount ||
      (payload.currency && payload.currency !== "IDR")
    ) {
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            reconciliationRequired: true,
            reconciliationReason: "provider_status_mismatch",
            nextReconcileAt: new Date(now.getTime() + retryMs),
          },
          $unset: { leaseUntil: 1 },
        },
      );
      continue;
    }

    const normalized = normalizeStatus(payload);
    if (normalized === "pending") {
      await reschedule(order._id.toString());
    } else if (normalized === "review") {
      await applyPaymentStatus(order._id.toString(), normalized, providerTime(payload));
      await reschedule(order._id.toString());
    } else {
      await applyPaymentStatus(order._id.toString(), normalized, providerTime(payload));
    }
  }
  return processed;
}
