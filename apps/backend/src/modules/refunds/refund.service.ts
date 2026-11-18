import mongoose, { Types, type ClientSession } from "mongoose";
import { AppError } from "../../lib/app-error.js";
import { Event } from "../events/event.models.js";
import { Order } from "../orders/order.model.js";
import { refundDeadline } from "../orders/pricing.js";
import { Ticket } from "../tickets/ticket.model.js";
import { Refund } from "./refund.model.js";
import { Payout } from "../payouts/payout.model.js";
import { env } from "../../config/env.js";
import { getTransactionStatus } from "../payments/midtrans.client.js";
import { queueEmail } from "../notifications/email.service.js";
import {
  refundCompletedEmail,
  refundEmail,
  refundReviewEmail,
} from "../notifications/email-templates.js";
import { publishUpdate } from "../realtime/events.js";

export function validId(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, "NOT_FOUND", "Record not found.");
  return new Types.ObjectId(id);
}
export function refundDto(r: any) {
  return {
    id: r._id.toString(),
    orderId: r.orderId.toString(),
    eventId: r.eventId.toString(),
    ticketIds: r.ticketIds.map(String),
    reason: r.reason,
    kind: r.kind,
    status: r.status,
    amount: r.amount,
    baseAmount: r.baseAmount,
    decisionNote: r.decisionNote ?? null,
    requestedAt: r.createdAt,
    decidedAt: r.decidedAt ?? null,
    refundedAt: r.refundedAt ?? null,
    transferReference: r.transferReference ?? null,
  };
}
async function lockEvent(eventId: Types.ObjectId, session: ClientSession) {
  const event = await Event.findOneAndUpdate(
    { _id: eventId },
    { $inc: { financialVersion: 1 } },
    { session, returnDocument: "after" },
  );
  if (!event) throw new AppError(404, "NOT_FOUND", "Event not found.");
  return event;
}

export async function requestBuyerRefund(
  orderId: string,
  buyerId: string,
  reason: string,
  ticketIds?: string[],
  now = new Date(),
) {
  const session = await mongoose.startSession();
  let result: any;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: validId(orderId), buyerId }).session(session);
      if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
      const event = await lockEvent(order.eventId, session);
      if (event.publicationStatus === "cancelled")
        throw new AppError(
          409,
          "EVENT_CANCELLED",
          "The event cancellation refund is handled separately.",
        );
      if (now > refundDeadline(event.startsAt, event.timezone))
        throw new AppError(
          409,
          "REFUND_DEADLINE",
          "Refund requests must be submitted at least one calendar month before the event.",
        );
      if (order.paymentStatus !== "paid" || order.issuanceStatus !== "issued")
        throw new AppError(409, "NOT_REFUNDABLE", "Only issued paid orders can be refunded.");
      if (await Payout.exists({ eventId: event._id }).session(session))
        throw new AppError(409, "PAYOUT_EXISTS", "This event already has a payout request.");
      const active = await Refund.exists({
        orderId: order._id,
        status: { $nin: ["rejected", "refunded"] },
      }).session(session);
      if (active)
        throw new AppError(
          409,
          "REFUND_EXISTS",
          "A refund request is already being reviewed or processed.",
        );
      const selected = ticketIds?.map(validId);
      const tickets = await Ticket.find({
        orderId: order._id,
        checkInStatus: "unused",
        ...(selected ? { _id: { $in: selected } } : {}),
      }).session(session);
      if (!tickets.length || (selected && tickets.length !== selected.length))
        throw new AppError(
          409,
          "INVALID_TICKETS",
          "Select unused tickets belonging to this order.",
        );
      const amount = order.unitPrice * tickets.length;
      if (amount <= 0)
        throw new AppError(409, "NOT_REFUNDABLE", "Free tickets have no refundable payment.");
      const id = new Types.ObjectId();
      [result] = await Refund.create(
        [
          {
            _id: id,
            orderId: order._id,
            eventId: order.eventId,
            buyerId: order.buyerId,
            ticketIds: tickets.map((t) => t._id),
            kind: "buyer",
            reason,
            amount,
            baseAmount: amount,
            refundKey: `gth-${id}`,
            status: "requested",
          },
        ],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }
  return refundDto(result);
}

/**
 * Pengembalian dana yang dimulai organizer dari detail pesanan. Organizer adalah penjual, jadi
 * pengembalian langsung disetujui tanpa tinjauan admin. Tiket yang dipilih dibatalkan seketika,
 * lalu worker meneruskan refund ke Midtrans (atau menandainya transfer manual untuk admin).
 * Nominal mengikuti harga tiket; biaya layanan tidak dikembalikan, sama dengan aturan pembeli.
 */
export async function requestOrganizerRefund(
  eventId: string,
  orderId: string,
  organizerId: string,
  input: { mode: "full" | "partial"; ticketIds?: string[]; reason: string },
) {
  const session = await mongoose.startSession();
  let result: any;
  let buyerEmail = "";
  let orderCode = "";
  let eventTitle = "";
  try {
    await session.withTransaction(async () => {
      const owned = await Event.exists({ _id: validId(eventId), organizerId: validId(organizerId) }).session(
        session,
      );
      if (!owned) throw new AppError(404, "NOT_FOUND", "Event not found.");
      const order = await Order.findOne({ _id: validId(orderId), eventId: owned._id }).session(session);
      if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
      const event = await lockEvent(order.eventId, session);
      if (event.publicationStatus === "cancelled")
        throw new AppError(
          409,
          "EVENT_CANCELLED",
          "The event cancellation refund is handled separately.",
        );
      if (order.paymentStatus !== "paid" || order.issuanceStatus !== "issued")
        throw new AppError(409, "NOT_REFUNDABLE", "Only issued paid orders can be refunded.");
      if (await Payout.exists({ eventId: event._id }).session(session))
        throw new AppError(409, "PAYOUT_EXISTS", "This event already has a payout request.");
      if (
        await Refund.exists({
          orderId: order._id,
          status: { $nin: ["rejected", "refunded"] },
        }).session(session)
      )
        throw new AppError(
          409,
          "REFUND_EXISTS",
          "A refund request is already being reviewed or processed.",
        );
      const selected = input.mode === "partial" ? (input.ticketIds ?? []).map(validId) : undefined;
      if (selected && !selected.length)
        throw new AppError(409, "INVALID_TICKETS", "Select unused tickets belonging to this order.");
      const tickets = await Ticket.find({
        orderId: order._id,
        checkInStatus: "unused",
        ...(selected ? { _id: { $in: selected } } : {}),
      }).session(session);
      if (!tickets.length || (selected && tickets.length !== selected.length))
        throw new AppError(
          409,
          "INVALID_TICKETS",
          "Select unused tickets belonging to this order.",
        );
      const amount = order.unitPrice * tickets.length;
      if (amount <= 0)
        throw new AppError(409, "NOT_REFUNDABLE", "Free tickets have no refundable payment.");
      const id = new Types.ObjectId();
      const now = new Date();
      [result] = await Refund.create(
        [
          {
            _id: id,
            orderId: order._id,
            eventId: order.eventId,
            buyerId: order.buyerId,
            ticketIds: tickets.map((t) => t._id),
            kind: "organizer",
            reason: input.reason,
            amount,
            baseAmount: amount,
            refundKey: `gth-${id}`,
            status: "approved",
            decidedAt: now,
            decisionNote: input.reason,
            nextAttemptAt: now,
          },
        ],
        { session },
      );
      const updated = await Ticket.updateMany(
        { _id: { $in: tickets.map((t) => t._id) }, checkInStatus: "unused" },
        {
          $set: {
            refundId: id,
            checkInStatus: "cancelled",
            cancelledAt: now,
            cancellationReason: input.reason,
          },
        },
        { session },
      );
      if (updated.modifiedCount !== tickets.length)
        throw new AppError(409, "INVALID_TICKETS", "A selected ticket is no longer refundable.");
      buyerEmail = order.buyerSnapshot.email;
      orderCode = order.orderCode;
      eventTitle = event.title;
      await queueEmail(
        refundEmail({
          key: `refund-organizer-${id}`,
          to: buyerEmail,
          orderCode,
          eventTitle,
          amount,
          tickets: tickets.length,
          reason: input.reason,
        }),
        session,
      );
    });
  } finally {
    await session.endSession();
  }
  await publishUpdate({ topic: "order", id: String(result.orderId), type: "refund.updated" });
  return refundDto(result);
}

export async function decideRefund(id: string, adminId: string, approve: boolean, note: string) {
  const session = await mongoose.startSession();
  let result: any;
  try {
    await session.withTransaction(async () => {
      const refund = await Refund.findById(validId(id)).session(session);
      if (!refund) throw new AppError(404, "NOT_FOUND", "Refund not found.");
      await lockEvent(refund.eventId, session);
      if (refund.status !== "requested")
        throw new AppError(409, "ALREADY_REVIEWED", "This refund has already been reviewed.");
      if (approve) {
        if (await Payout.exists({ eventId: refund.eventId }).session(session))
          throw new AppError(409, "PAYOUT_EXISTS", "A payout is already requested for this event.");
        const updated = await Ticket.updateMany(
          { _id: { $in: refund.ticketIds }, checkInStatus: "unused", refundId: { $exists: false } },
          {
            $set: {
              refundId: refund._id,
              checkInStatus: "cancelled",
              cancelledAt: new Date(),
              cancellationReason: refund.reason,
            },
          },
          { session },
        );
        if (updated.modifiedCount !== refund.ticketIds.length)
          throw new AppError(409, "INVALID_TICKETS", "A selected ticket is no longer refundable.");
      }
      refund.status = approve ? "approved" : "rejected";
      refund.decidedBy = validId(adminId);
      refund.decidedAt = new Date();
      refund.decisionNote = note;
      refund.nextAttemptAt = new Date();
      await refund.save({ session });
      result = refund;
      const order = await Order.findById(refund.orderId).session(session);
      if (order)
        await queueEmail(
          refundReviewEmail(
            `refund-review-${refund._id}`,
            order.buyerSnapshot.email,
            order.orderCode,
            approve,
            note,
          ),
          session,
        );
    });
  } finally {
    await session.endSession();
  }
  await publishUpdate({ topic: "order", id: String(result.orderId), type: "refund.updated" });
  return refundDto(result);
}

export async function requestEventCancellation(
  eventId: string,
  organizerId: string,
  confirmTitle: string,
  reason: string,
) {
  const event = await Event.findOne({ _id: validId(eventId), organizerId });
  if (!event) throw new AppError(404, "NOT_FOUND", "Event not found.");
  if (confirmTitle !== event.title)
    throw new AppError(400, "CONFIRMATION_MISMATCH", "The event title must match.");
  if (event.publicationStatus === "cancelled" || event.cancellationStatus === "requested")
    throw new AppError(409, "CANCELLATION_EXISTS", "Cancellation already exists.");
  if (event.endsAt <= new Date())
    throw new AppError(409, "EVENT_ENDED", "A completed event cannot be cancelled.");
  const updated = await Event.findOneAndUpdate(
    {
      _id: event._id,
      checkoutVersion: event.checkoutVersion,
      cancellationStatus: { $ne: "requested" },
      publicationStatus: { $ne: "cancelled" },
    },
    {
      $set: {
        cancellationStatus: "requested",
        cancellationReason: reason,
        cancellationRequestedAt: new Date(),
      },
      $inc: { checkoutVersion: 1, financialVersion: 1 },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw new AppError(409, "CONFLICT", "The event changed. Please try again.");
  return { id: updated._id.toString(), status: updated.cancellationStatus };
}

export async function decideEventCancellation(
  eventId: string,
  adminId: string,
  approve: boolean,
  note: string,
) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const event = await lockEvent(validId(eventId), session);
      if (event.cancellationStatus !== "requested")
        throw new AppError(409, "NOT_REQUESTED", "No cancellation awaits review.");
      if (await Payout.exists({ eventId: event._id }).session(session))
        throw new AppError(
          409,
          "PAYOUT_EXISTS",
          "Cancellation needs reconciliation because a payout already exists.",
        );
      event.cancellationStatus = approve ? "approved" : "rejected";
      event.cancellationDecidedAt = new Date();
      event.cancellationDecidedBy = validId(adminId);
      event.cancellationDecisionNote = note;
      if (approve) {
        event.publicationStatus = "cancelled";
        event.salesClosed = true;
      }
      event.checkoutVersion += 1;
      await event.save({ session });
    });
  } finally {
    await session.endSession();
  }
  // Durable state above makes interrupted fan-out recoverable by processDueRefunds.
  if (approve) await prepareCancelledEventRefunds(eventId);
  await publishUpdate({ topic: "event", id: eventId, type: "event.cancellation.updated" });
  return { id: eventId, status: approve ? "approved" : "rejected" };
}

export async function prepareCancelledEventRefunds(eventId: string) {
  const orders = await Order.find({ eventId: validId(eventId), paymentStatus: "paid" }).select(
    "_id",
  );
  for (const row of orders) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const order = await Order.findById(row._id).session(session);
        if (!order) return;
        const event = await lockEvent(order.eventId, session);
        if (event.publicationStatus !== "cancelled") return;
        if (
          await Refund.exists({
            orderId: order._id,
            status: { $in: ["approved", "processing", "manual_required"] },
          }).session(session)
        )
          return;
        await Refund.updateMany(
          { orderId: order._id, status: "requested" },
          {
            $set: {
              status: "rejected",
              decisionNote: "Replaced by full event cancellation refund.",
              decidedAt: new Date(),
            },
          },
          { session },
        );
        const amount = order.totalAmount - (order.refundedAmount ?? 0);
        if (amount <= 0) {
          await Ticket.updateMany(
            { orderId: order._id, checkInStatus: { $ne: "cancelled" } },
            {
              $set: {
                checkInStatus: "cancelled",
                cancelledAt: new Date(),
                cancellationReason: event.cancellationReason ?? "Event cancelled",
              },
            },
            { session },
          );
          return;
        }
        const tickets = await Ticket.find({
          orderId: order._id,
          checkInStatus: { $ne: "cancelled" },
        }).session(session);
        const id = new Types.ObjectId();
        await Refund.create(
          [
            {
              _id: id,
              orderId: order._id,
              eventId: order.eventId,
              buyerId: order.buyerId,
              ticketIds: tickets.map((t) => t._id),
              reason: event.cancellationReason ?? "Event cancelled",
              kind: "event_cancelled",
              status: "approved",
              amount,
              baseAmount: Math.max(
                0,
                (order.subtotalAmount ?? order.unitPrice * order.quantity) -
                  (order.refundedBaseAmount ?? 0),
              ),
              refundKey: `gth-${id}`,
              decidedBy: event.cancellationDecidedBy,
              decidedAt: event.cancellationDecidedAt,
            },
          ],
          { session },
        );
        await Ticket.updateMany(
          { orderId: order._id, checkInStatus: { $ne: "cancelled" } },
          {
            $set: {
              checkInStatus: "cancelled",
              refundId: id,
              cancelledAt: new Date(),
              cancellationReason: event.cancellationReason,
            },
          },
          { session },
        );
      });
    } finally {
      await session.endSession();
    }
  }
}

async function completeRefund(id: string, reference?: string, transferredAt = new Date()) {
  const session = await mongoose.startSession();
  let orderId = "";
  try {
    await session.withTransaction(async () => {
      const refund = await Refund.findById(id).session(session);
      if (!refund || refund.status === "refunded") return;
      if (!["processing", "manual_required", "approved"].includes(refund.status))
        throw new AppError(409, "INVALID_STATE", "Refund has not been approved.");
      await lockEvent(refund.eventId, session);
      const order = await Order.findById(refund.orderId).session(session);
      if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
      order.refundedAmount = (order.refundedAmount ?? 0) + refund.amount;
      order.refundedBaseAmount = (order.refundedBaseAmount ?? 0) + refund.baseAmount;
      if (order.refundedAmount > order.totalAmount)
        throw new AppError(409, "REFUND_OVERFLOW", "Refund exceeds the payment amount.");
      order.refundStatus =
        order.refundedBaseAmount >= (order.subtotalAmount ?? order.unitPrice * order.quantity)
          ? "full"
          : "partial";
      order.paymentTimeline.push({ status: "refunded", at: transferredAt });
      await order.save({ session });
      refund.status = "refunded";
      refund.refundedAt = transferredAt;
      refund.transferReference = reference;
      refund.leaseUntil = undefined;
      await refund.save({ session });
      await queueEmail(
        refundCompletedEmail(
          `refund-completed-${id}`,
          order.buyerSnapshot.email,
          order.orderCode,
          refund.amount,
          reference,
        ),
        session,
      );
      orderId = order._id.toString();
    });
  } finally {
    await session.endSession();
  }
  if (orderId) await publishUpdate({ topic: "order", id: orderId, type: "refund.completed" });
}

export async function completeManualRefund(id: string, reference: string, transferredAt: Date) {
  const refund = await Refund.findById(validId(id));
  if (!refund || refund.status !== "manual_required")
    throw new AppError(409, "NOT_MANUAL", "Only manual refunds can be marked transferred.");
  await completeRefund(id, reference, transferredAt);
}

export async function processDueRefunds(limit = 10) {
  const cancelled = await Event.find({ publicationStatus: "cancelled" }).select("_id");
  for (const event of cancelled) await prepareCancelledEventRefunds(event._id.toString());
  let processed = 0;
  for (let i = 0; i < limit; i++) {
    const now = new Date();
    const refund = await Refund.findOneAndUpdate(
      {
        status: { $in: ["approved", "processing"] },
        nextAttemptAt: { $lte: now },
        $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }],
      },
      {
        $set: {
          leaseUntil: new Date(now.getTime() + 60_000),
          status: "processing",
          nextAttemptAt: new Date(now.getTime() + 60_000),
        },
        $inc: { attempts: 1 },
      },
      { returnDocument: "after" },
    );
    if (!refund) break;
    processed++;
    try {
      const order = await Order.findById(refund.orderId);
      if (!order) throw new Error("Missing order");
      const status = await getTransactionStatus(order.providerOrderId);
      if (status.kind !== "found") throw new Error("Provider status unavailable");
      const entries = Array.isArray(status.payload.refunds)
        ? (status.payload.refunds as Array<{
            refund_key?: string;
            refund_amount?: string;
            bank_confirmed_at?: string;
          }>)
        : [];
      const prior = entries.find((r) => r.refund_key === refund.refundKey);
      if (prior) {
        if (Number(prior.refund_amount) !== refund.amount)
          throw new Error("Provider refund amount mismatch");
        if (prior.bank_confirmed_at) {
          await completeRefund(refund._id.toString(), refund.refundKey);
          continue;
        }
        refund.providerAcknowledgedAt ??= now;
        refund.leaseUntil = undefined;
        await refund.save();
        continue;
      }
      const type = String(status.payload.payment_type ?? "");
      const supported = [
        "credit_card",
        "gopay",
        "shopeepay",
        "dana",
        "ovo",
        "qris",
        "kredivo",
        "akulaku",
      ].includes(type);
      if (
        !supported ||
        (["shopeepay", "ovo"].includes(type) && refund.amount !== order.totalAmount)
      ) {
        refund.status = "manual_required";
        refund.lastError = "Provider does not support this refund method/amount.";
        refund.leaseUntil = undefined;
        await refund.save();
        continue;
      }
      if (
        refund.firstAttemptAt &&
        now.getTime() - refund.firstAttemptAt.getTime() >= 7 * 86400_000
      ) {
        refund.status = "manual_required";
        refund.lastError = "Idempotency window ended. Reconcile provider before manual transfer.";
        refund.leaseUntil = undefined;
        await refund.save();
        continue;
      }
      if (String(status.payload.transaction_status) !== "settlement")
        throw new Error("Payment is not settled yet");
      refund.firstAttemptAt ??= now;
      await refund.save();
      const response = await fetch(
        `https://api.sandbox.midtrans.com/v2/${encodeURIComponent(order.providerOrderId)}/refund`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${env.MIDTRANS_SERVER_KEY}:`).toString("base64")}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            refund_key: refund.refundKey,
            amount: refund.amount,
            reason: refund.reason.slice(0, 255),
          }),
          signal: AbortSignal.timeout(env.MIDTRANS_REQUEST_TIMEOUT_MS),
        },
      );
      if (!response.ok) throw new Error(`Provider refund HTTP ${response.status}`);
      const body = (await response.json()) as { status_code?: string; refund_key?: string };
      if (!String(body.status_code ?? "").startsWith("2"))
        throw new Error("Provider did not accept refund");
      refund.providerAcknowledgedAt = now;
      refund.leaseUntil = undefined;
      refund.lastError = undefined;
      await refund.save();
    } catch {
      await Refund.updateOne(
        { _id: refund._id, status: "processing" },
        {
          $set: {
            nextAttemptAt: new Date(Date.now() + 60_000),
            lastError: "Refund verification will be retried.",
          },
          $unset: { leaseUntil: 1 },
        },
      );
    }
  }
  return processed;
}
