import { randomBytes, randomUUID } from "node:crypto";
import mongoose, { Types, type HydratedDocument } from "mongoose";

import { AppError } from "../../lib/app-error.js";
import { hashToken } from "../../lib/crypto.js";
import { Event } from "../events/event.models.js";
import { TicketType } from "../events/event.models.js";
import { User } from "../auth/auth.models.js";
import { Order, type OrderDocument } from "./order.model.js";
import type { CreateOrderInput } from "./order.schemas.js";

const reservationDurationMs = 15 * 60 * 1000;

function requestHash(input: CreateOrderInput) {
  return hashToken(JSON.stringify({
    ticketTypeId: input.ticketTypeId,
    quantity: input.quantity,
    attendees: input.attendees.map(({ name }) => ({ name: name.trim() })),
  }));
}

function isDuplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

function isTransientTransactionError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "hasErrorLabel" in error &&
    typeof error.hasErrorLabel === "function" &&
    (error.hasErrorLabel("TransientTransactionError") ||
      error.hasErrorLabel("UnknownTransactionCommitResult"))
  );
}

function assertMatchingRequest(order: OrderDocument, hash: string) {
  if (order.requestHash !== hash) {
    throw new AppError(
      409,
      "IDEMPOTENCY_CONFLICT",
      "This idempotency key was already used with a different request.",
    );
  }
}

export async function createOrder(
  buyerId: string,
  idempotencyKey: string,
  input: CreateOrderInput,
): Promise<{ order: HydratedDocument<OrderDocument>; created: boolean }> {
  const hash = requestHash(input);
  const existing = await Order.findOne({ buyerId, idempotencyKey });
  if (existing) {
    assertMatchingRequest(existing, hash);
    return { order: existing, created: false };
  }

  const session = await mongoose.startSession();
  let createdOrder: HydratedDocument<OrderDocument> | undefined;

  try {
    await session.withTransaction(
      async () => {
        const now = new Date();
        const ticketType = await TicketType.findById(input.ticketTypeId).session(session);
        if (!ticketType) {
          throw new AppError(404, "NOT_FOUND", "Ticket type not found.");
        }

        const event = await Event.findById(ticketType.eventId).session(session);
        if (!event) {
          throw new AppError(404, "NOT_FOUND", "Event not found.");
        }
        if (event.publicationStatus !== "published") {
          throw new AppError(404, "NOT_FOUND", "Event not found.");
        }
        if (event.salesClosed || event.endsAt <= now) {
          throw new AppError(409, "SALES_CLOSED", "Ticket sales are closed.");
        }
        if (ticketType.salesStartsAt > now || ticketType.salesEndsAt <= now) {
          throw new AppError(409, "SALES_CLOSED", "This ticket type is not currently on sale.");
        }

        const buyer = await User.findById(buyerId).session(session);
        if (!buyer) {
          throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
        }

        const eventTouch = await Event.updateOne(
          { _id: event._id, checkoutVersion: event.checkoutVersion },
          { $inc: { checkoutVersion: 1 } },
          { session },
        );
        if (eventTouch.modifiedCount !== 1) {
          throw new Error("Event changed during checkout.");
        }

        const inventoryUpdate = await TicketType.updateOne(
          {
            _id: ticketType._id,
            $expr: {
              $gte: [
                { $subtract: ["$capacity", { $add: ["$reserved", "$sold"] }] },
                input.quantity,
              ],
            },
          },
          { $inc: { reserved: input.quantity } },
          { session },
        );
        if (inventoryUpdate.modifiedCount !== 1) {
          throw new AppError(409, "SOLD_OUT", "There are not enough tickets available.");
        }

        const expiresAt = new Date(now.getTime() + reservationDurationMs);
        const [order] = await Order.create(
          [
            {
              buyerId: new Types.ObjectId(buyerId),
              eventId: event._id,
              ticketTypeId: ticketType._id,
              orderCode: `GTH-${randomBytes(5).toString("hex").toUpperCase()}`,
              providerOrderId: `gatherly-${randomUUID()}`,
              quantity: input.quantity,
              attendees: input.attendees.map(({ name }) => ({ name: name.trim() })),
              unitPrice: ticketType.price,
              totalAmount: ticketType.price * input.quantity,
              currency: "IDR",
              eventSnapshot: {
                title: event.title,
                startsAt: event.startsAt,
                timezone: event.timezone,
                venueName: event.venueName,
                address: event.address,
                city: event.city,
              },
              ticketTypeSnapshot: { name: ticketType.name, unitPrice: ticketType.price },
              buyerSnapshot: { name: buyer.name, email: buyer.emailNormalized },
              paymentStatus: "pending",
              reservationStatus: "held",
              issuanceStatus: "not_ready",
              paymentSessionState: "not_started",
              expiresAt,
              idempotencyKey,
              requestHash: hash,
              paymentTimeline: [],
              nextReconcileAt: expiresAt,
            },
          ],
          { session },
        );
        createdOrder = order;
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
    );
  } catch (error) {
    if (isDuplicateKey(error)) {
      const racedOrder = await Order.findOne({ buyerId, idempotencyKey });
      if (racedOrder) {
        assertMatchingRequest(racedOrder, hash);
        return { order: racedOrder, created: false };
      }
    }
    if (isTransientTransactionError(error)) {
      throw new AppError(503, "SERVICE_UNAVAILABLE", "The reservation could not be completed.");
    }
    throw error;
  } finally {
    await session.endSession();
  }

  if (!createdOrder) {
    throw new AppError(503, "SERVICE_UNAVAILABLE", "The reservation could not be completed.");
  }
  return { order: createdOrder, created: true };
}

export function orderDto(order: HydratedDocument<OrderDocument> | OrderDocument & { _id: Types.ObjectId }) {
  const now = new Date();
  return {
    id: order._id.toString(),
    orderCode: order.orderCode,
    event: order.eventSnapshot,
    ticketType: order.ticketTypeSnapshot,
    quantity: order.quantity,
    attendees: order.attendees,
    totalAmount: order.totalAmount,
    currency: order.currency,
    paymentStatus: order.paymentStatus,
    reservationStatus: order.reservationStatus,
    issuanceStatus: order.issuanceStatus,
    expiresAt: order.expiresAt,
    serverTime: now,
    isVerifying: order.paymentSessionState === "uncertain",
    canResumePayment:
      order.paymentStatus === "pending" &&
      order.reservationStatus === "held" &&
      (order.paymentSessionState === "not_started" || order.paymentSessionState === "ready") &&
      order.expiresAt > now,
    ticketIds: [],
  };
}
