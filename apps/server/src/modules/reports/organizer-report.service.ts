import { Types } from "mongoose";

import { AppError } from "../../lib/app-error.js";
import { Event, TicketType } from "../events/event.models.js";
import { Order, type OrderDocument } from "../orders/order.model.js";
import { Ticket } from "../tickets/ticket.model.js";
import type {
  OrganizerAttendeeQuery,
  OrganizerOrderQuery,
  OrganizerSummaryQuery,
} from "./organizer-report.schemas.js";

function objectId(value: string, message: string) {
  if (!Types.ObjectId.isValid(value)) throw new AppError(404, "NOT_FOUND", message);
  return new Types.ObjectId(value);
}

async function ownedEvent(eventId: string, organizerId: string) {
  const event = await Event.findOne({
    _id: objectId(eventId, "Event not found."),
    organizerId: new Types.ObjectId(organizerId),
  }).lean();
  if (!event) throw new AppError(404, "NOT_FOUND", "Event not found.");
  return event;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function orderListDto(order: OrderDocument & { _id: Types.ObjectId }) {
  return {
    id: order._id.toString(),
    orderCode: order.orderCode,
    buyer: order.buyerSnapshot,
    ticketType: order.ticketTypeSnapshot,
    quantity: order.quantity,
    totalAmount: order.totalAmount,
    currency: order.currency,
    paymentStatus: order.paymentStatus,
    reservationStatus: order.reservationStatus,
    issuanceStatus: order.issuanceStatus,
    createdAt: order.createdAt,
    expiresAt: order.expiresAt,
    paidAt: order.paidAt ?? null,
  };
}

export async function getOrganizerSummary(
  organizerId: string,
  query: OrganizerSummaryQuery,
) {
  const organizerObjectId = new Types.ObjectId(organizerId);
  const eventIds = await Event.distinct("_id", { organizerId: organizerObjectId });
  const paidAt: Record<string, Date> = {};
  if (query.from) paidAt.$gte = query.from;
  if (query.to) paidAt.$lt = query.to;
  const orderMatch: Record<string, unknown> = {
    eventId: { $in: eventIds },
    paymentStatus: "paid",
  };
  if (Object.keys(paidAt).length > 0) orderMatch.paidAt = paidAt;

  const [publishedEvents, sales] = await Promise.all([
    Event.countDocuments({ organizerId: organizerObjectId, publicationStatus: "published" }),
    Order.aggregate<{ paidTickets: number; grossPaidSales: number }>([
      { $match: orderMatch },
      {
        $group: {
          _id: null,
          paidTickets: { $sum: "$quantity" },
          grossPaidSales: { $sum: "$totalAmount" },
        },
      },
    ]),
  ]);
  return {
    publishedEvents,
    paidTickets: sales[0]?.paidTickets ?? 0,
    grossPaidSales: sales[0]?.grossPaidSales ?? 0,
    period: { from: query.from ?? null, to: query.to ?? null, basis: "paidAt" as const },
    generatedAt: new Date(),
  };
}

export async function getOrganizerEventSummary(eventId: string, organizerId: string) {
  const event = await ownedEvent(eventId, organizerId);
  const [inventory, checkedIn, sales] = await Promise.all([
    TicketType.aggregate<{ capacity: number; reserved: number; sold: number }>([
      { $match: { eventId: event._id } },
      {
        $group: {
          _id: null,
          capacity: { $sum: "$capacity" },
          reserved: { $sum: "$reserved" },
          sold: { $sum: "$sold" },
        },
      },
    ]),
    Ticket.countDocuments({ eventId: event._id, checkInStatus: "used" }),
    Order.aggregate<{ grossPaidSales: number }>([
      { $match: { eventId: event._id, paymentStatus: "paid" } },
      { $group: { _id: null, grossPaidSales: { $sum: "$totalAmount" } } },
    ]),
  ]);
  const totals = inventory[0] ?? { capacity: 0, reserved: 0, sold: 0 };
  return {
    capacity: totals.capacity,
    reserved: totals.reserved,
    sold: totals.sold,
    available: totals.capacity - totals.reserved - totals.sold,
    checkedIn,
    grossPaidSales: sales[0]?.grossPaidSales ?? 0,
    generatedAt: new Date(),
  };
}

export async function listOrganizerOrders(
  eventId: string,
  organizerId: string,
  query: OrganizerOrderQuery,
) {
  const event = await ownedEvent(eventId, organizerId);
  const filter: Record<string, unknown> = { eventId: event._id };
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ orderCode: pattern }, { "buyerSnapshot.name": pattern }];
  }
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    Order.countDocuments(filter),
  ]);
  return {
    data: orders.map(orderListDto),
    meta: { page: query.page, limit: query.limit, total },
  };
}

export async function getOrganizerOrderDetail(
  eventId: string,
  orderId: string,
  organizerId: string,
) {
  const event = await ownedEvent(eventId, organizerId);
  const order = await Order.findOne({
    _id: objectId(orderId, "Order not found."),
    eventId: event._id,
  });
  if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
  const tickets = await Ticket.find({ orderId: order._id }).sort({ sequence: 1 });
  return {
    ...orderListDto(order),
    event: order.eventSnapshot,
    attendees: order.attendees,
    unitPrice: order.unitPrice,
    timeline: [...order.paymentTimeline]
      .sort((left, right) => left.at.getTime() - right.at.getTime())
      .map(({ status, at }) => ({ status, at })),
    tickets: tickets.map((ticket) => ({
      id: ticket._id.toString(),
      ticketCode: ticket.ticketCode,
      attendeeName: ticket.attendeeName,
      checkInStatus: ticket.checkInStatus,
      checkedInAt: ticket.checkedInAt ?? null,
    })),
  };
}

export async function listOrganizerAttendees(
  eventId: string,
  organizerId: string,
  query: OrganizerAttendeeQuery,
) {
  const event = await ownedEvent(eventId, organizerId);
  const filter: Record<string, unknown> = { eventId: event._id };
  if (query.checkInStatus) filter.checkInStatus = query.checkInStatus;
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [
      { attendeeName: pattern },
      { ticketCode: pattern },
      { "ticketTypeSnapshot.name": pattern },
    ];
  }
  const [tickets, total] = await Promise.all([
    Ticket.find(filter)
      .populate("checkedInBy", "name")
      .sort({ attendeeName: 1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Ticket.countDocuments(filter),
  ]);
  return {
    data: tickets.map((ticket) => {
      const actor = ticket.checkedInBy as unknown as { _id: Types.ObjectId; name: string } | undefined;
      return {
        ticketId: ticket._id.toString(),
        ticketCode: ticket.ticketCode,
        attendeeName: ticket.attendeeName,
        ticketTypeName: ticket.ticketTypeSnapshot.name,
        checkInStatus: ticket.checkInStatus,
        checkedInAt: ticket.checkedInAt ?? null,
        checkedInBy: actor ? { id: actor._id.toString(), name: actor.name } : null,
      };
    }),
    meta: { page: query.page, limit: query.limit, total },
  };
}
