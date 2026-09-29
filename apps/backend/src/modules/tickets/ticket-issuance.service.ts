import { randomBytes } from "node:crypto";
import mongoose from "mongoose";

import { Order } from "../orders/order.model.js";
import { Ticket } from "./ticket.model.js";

const leaseMs = 30_000;
const retryMs = 60_000;

function ticketCode() {
  return `GTH-T-${randomBytes(6).toString("hex").toUpperCase()}`;
}

function qrToken() {
  return randomBytes(32).toString("base64url");
}

async function reschedule(orderId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Ticket issuance failed.";
  await Order.updateOne(
    { _id: orderId, issuanceStatus: "processing" },
    {
      $inc: { issuanceAttempts: 1 },
      $set: {
        issuanceNextAttemptAt: new Date(Date.now() + retryMs),
        issuanceLastError: message.slice(0, 300),
      },
      $unset: { issuanceLeaseUntil: 1 },
    },
  );
}

async function issueClaimedOrder(orderId: string) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({
        _id: orderId,
        paymentStatus: "paid",
        reservationStatus: "converted",
        issuanceStatus: "processing",
      }).session(session);
      if (!order) return;
      if (order.attendees.length !== order.quantity) {
        throw new Error("Attendee count does not match the order quantity.");
      }

      await Ticket.bulkWrite(
        order.attendees.map((attendee, sequence) => ({
          updateOne: {
            filter: { orderId: order._id, sequence },
            update: {
              $setOnInsert: {
                orderId: order._id,
                eventId: order.eventId,
                buyerId: order.buyerId,
                ticketTypeId: order.ticketTypeId,
                sequence,
                attendeeName: attendee.name,
                ticketCode: ticketCode(),
                qrToken: qrToken(),
                checkInStatus: "unused",
                eventSnapshot: order.eventSnapshot,
                ticketTypeSnapshot: { name: order.ticketTypeSnapshot.name },
              },
            },
            upsert: true,
          },
        })),
        { session, ordered: true },
      );

      const ticketCount = await Ticket.countDocuments({ orderId: order._id }).session(session);
      if (ticketCount !== order.quantity) {
        throw new Error("Issued ticket count does not match the order quantity.");
      }
      order.issuanceStatus = "issued";
      order.issuanceAttempts += 1;
      order.issuanceLeaseUntil = undefined;
      order.issuanceNextAttemptAt = undefined;
      order.issuanceLastError = undefined;
      await order.save({ session });
    });
  } finally {
    await session.endSession();
  }
}

export async function issueDueTickets(limit = 20) {
  let processed = 0;
  for (let index = 0; index < limit; index += 1) {
    const now = new Date();
    const order = await Order.findOneAndUpdate(
      {
        paymentStatus: "paid",
        reservationStatus: "converted",
        issuanceStatus: "processing",
        $and: [
          {
            $or: [
              { issuanceNextAttemptAt: { $exists: false } },
              { issuanceNextAttemptAt: { $lte: now } },
            ],
          },
          {
            $or: [
              { issuanceLeaseUntil: { $exists: false } },
              { issuanceLeaseUntil: { $lte: now } },
            ],
          },
        ],
      },
      { $set: { issuanceLeaseUntil: new Date(now.getTime() + leaseMs) } },
      { sort: { issuanceNextAttemptAt: 1, paidAt: 1 }, returnDocument: "after" },
    );
    if (!order) break;
    processed += 1;
    try {
      await issueClaimedOrder(order._id.toString());
    } catch (error) {
      await reschedule(order._id.toString(), error);
    }
  }
  return processed;
}
