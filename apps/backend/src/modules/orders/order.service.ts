import { randomBytes, randomUUID } from "node:crypto";
import mongoose, { Types, type HydratedDocument } from "mongoose";

import { AppError } from "../../lib/app-error.js";
import { hashToken } from "../../lib/crypto.js";
import { Event } from "../events/event.models.js";
import { TicketType } from "../events/event.models.js";
import { User } from "../auth/auth.models.js";
import { orderPricing } from "./pricing.js";
import { Organizer } from "../organizers/organizer.model.js";
import { Order, type OrderDocument } from "./order.model.js";
import type { CreateOrderInput } from "./order.schemas.js";

const reservationDurationMs = 15 * 60 * 1000;

function requestHash(input: CreateOrderInput) {
  return hashToken(
    JSON.stringify({
      ticketTypeId: input.ticketTypeId,
      quantity: input.quantity,
      contactPhone: input.contactPhone,
      attendees: input.attendees.map(({ name, email, phone, birthDate }) => ({
        name: name.trim(),
        ...(email ? { email: email.toLowerCase() } : {}),
        ...(phone ? { phone } : {}),
        ...(birthDate ? { birthDate } : {}),
      })),
    }),
  );
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
        const organizer = await Organizer.findById(event.organizerId).session(session).lean();
        if ((organizer as unknown as { status?: string })?.status === "frozen")
          throw new AppError(409, "SALES_CLOSED", "Organizer sales are suspended.");
        if (event.salesClosed || event.cancellationStatus === "approved" || event.endsAt <= now) {
          throw new AppError(409, "SALES_CLOSED", "Ticket sales are closed.");
        }
        if (
          ticketType.salesStopped ||
          ticketType.salesStartsAt > now ||
          ticketType.salesEndsAt <= now
        ) {
          throw new AppError(409, "SALES_CLOSED", "This ticket type is not currently on sale.");
        }

        const buyer = await User.findById(buyerId).session(session);
        if (!buyer || (buyer as unknown as { deletedAt?: Date }).deletedAt) {
          throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
        }

        await User.updateOne({ _id: buyer._id }, { $set: { updatedAt: now } }, { session });
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
              contactPhone: input.contactPhone,
              attendees: input.attendees.map(({ name, email, phone, birthDate }) => ({
                name: name.trim(),
                ...(email ? { email: email.toLowerCase() } : {}),
                ...(phone ? { phone } : {}),
                ...(birthDate ? { birthDate } : {}),
              })),
              unitPrice: ticketType.price,
              ...orderPricing(ticketType.price, input.quantity),
              currency: "IDR",
              eventSnapshot: {
                slug: event.slug,
                poster: event.posterAssetId,
                endsAt: event.endsAt,
                title: event.title,
                startsAt: event.startsAt,
                timezone: event.timezone,
                venueName: event.venueName,
                address: event.address,
                city: event.city,
              },
              ticketTypeSnapshot: { name: ticketType.name, unitPrice: ticketType.price },
              buyerSnapshot: { name: buyer.name, email: buyer.emailNormalized },
              paymentStatus: ticketType.price === 0 ? "paid" : "pending",
              reservationStatus: ticketType.price === 0 ? "converted" : "held",
              issuanceStatus: ticketType.price === 0 ? "processing" : "not_ready",
              paymentSessionState: ticketType.price === 0 ? "closed" : "not_started",
              ...(ticketType.price === 0 ? { paidAt: now, issuanceNextAttemptAt: now } : {}),
              expiresAt,
              idempotencyKey,
              requestHash: hash,
              paymentTimeline: [],
              nextReconcileAt: expiresAt,
            },
          ],
          { session },
        );
        if (ticketType.price === 0)
          await TicketType.updateOne(
            { _id: ticketType._id },
            { $inc: { reserved: -input.quantity, sold: input.quantity } },
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

export function orderDto(
  order: HydratedDocument<OrderDocument> | (OrderDocument & { _id: Types.ObjectId }),
  ticketIds: string[] = [],
) {
  const now = new Date();
  return {
    id: order._id.toString(),
    orderCode: order.orderCode,
    event: order.eventSnapshot,
    ticketType: order.ticketTypeSnapshot,
    quantity: order.quantity,
    attendees: order.attendees,
    subtotalAmount: order.subtotalAmount ?? order.unitPrice * order.quantity,
    serviceFeeAmount: order.serviceFeeAmount ?? 0,
    refundedAmount: order.refundedAmount ?? 0,
    refundStatus: order.refundStatus ?? "none",
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
    ticketIds,
    createdAt: order.createdAt,
    paidAt: order.paidAt ?? null,
    buyer: order.buyerSnapshot,
    paymentMethod: order.paymentMethod ?? null,
    contactPhone: order.contactPhone ?? null,
    cancelledAt: order.cancelledAt ?? null,
    cancelledBy: order.cancelledBy ?? null,
  };
}
