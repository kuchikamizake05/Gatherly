import mongoose, { Types } from "mongoose";

import { AppError } from "../../lib/app-error.js";
import { CommitteeAssignment } from "../committee/committee-assignment.model.js";
import { Event } from "../events/event.models.js";
import { Order } from "../orders/order.model.js";
import { Ticket } from "../tickets/ticket.model.js";
import type { CheckInInput } from "./check-in.schemas.js";

const checkInLeadMs = 30 * 60 * 1000;

function assertEventId(eventId: string) {
  if (!Types.ObjectId.isValid(eventId)) {
    throw new AppError(404, "NOT_FOUND", "Event not found.");
  }
  return new Types.ObjectId(eventId);
}

export async function assertCommitteeAssignment(eventId: string, userId: string) {
  const parsedEventId = assertEventId(eventId);
  const assignment = await CommitteeAssignment.exists({ eventId: parsedEventId, userId });
  if (!assignment) throw new AppError(403, "FORBIDDEN", "Committee access is required.");
  return parsedEventId;
}

function credentialFilter(input: CheckInInput) {
  if (input.qrPayload) return { qrToken: input.qrPayload.slice("gatherly:v1:".length) };
  return { ticketCode: input.ticketCode };
}

function successDto(ticket: {
  _id: Types.ObjectId;
  attendeeName: string;
  ticketTypeSnapshot: { name: string };
  checkInStatus: "unused" | "used";
  checkedInAt?: Date;
}) {
  return {
    ticketId: ticket._id.toString(),
    attendeeName: ticket.attendeeName,
    ticketTypeName: ticket.ticketTypeSnapshot.name,
    checkInStatus: ticket.checkInStatus,
    checkedInAt: ticket.checkedInAt,
  };
}

export async function checkInTicket(
  eventId: string,
  userId: string,
  input: CheckInInput,
  now = new Date(),
) {
  const parsedEventId = assertEventId(eventId);
  const session = await mongoose.startSession();
  let result: ReturnType<typeof successDto> | undefined;
  try {
    await session.withTransaction(async () => {
      const event = await Event.findById(parsedEventId).session(session);
      if (!event) throw new AppError(404, "NOT_FOUND", "Event not found.");

      const assignment = await CommitteeAssignment.updateOne(
        { eventId: parsedEventId, userId },
        { $inc: { checkInVersion: 1 } },
        { session },
      );
      if (assignment.modifiedCount !== 1) {
        throw new AppError(403, "FORBIDDEN", "Committee access is required.");
      }

      const opensAt = new Date(event.startsAt.getTime() - checkInLeadMs);
      if (now < opensAt || now > event.endsAt) {
        throw new AppError(409, "CHECKIN_CLOSED", "Check-in is closed for this event.");
      }

      const ticket = await Ticket.findOne(credentialFilter(input)).session(session);
      if (!ticket) throw new AppError(404, "INVALID_TICKET", "Ticket is invalid.");
      if (!ticket.eventId.equals(parsedEventId)) {
        throw new AppError(409, "WRONG_EVENT", "Ticket belongs to another event.");
      }

      const validOrder = await Order.exists({
        _id: ticket.orderId,
        eventId: parsedEventId,
        paymentStatus: "paid",
        issuanceStatus: "issued",
      }).session(session);
      if (!validOrder) throw new AppError(404, "INVALID_TICKET", "Ticket is invalid.");

      const checkedIn = await Ticket.findOneAndUpdate(
        { _id: ticket._id, eventId: parsedEventId, checkInStatus: "unused" },
        {
          $set: {
            checkInStatus: "used",
            checkedInAt: now,
            checkedInBy: new Types.ObjectId(userId),
          },
        },
        { session, returnDocument: "after" },
      );
      if (!checkedIn) {
        const usedTicket = await Ticket.findById(ticket._id).session(session);
        throw new AppError(
          409,
          "TICKET_ALREADY_USED",
          "Ticket has already been used.",
          {},
          { checkedInAt: usedTicket?.checkedInAt ?? null },
        );
      }
      result = successDto(checkedIn);
    });
  } finally {
    await session.endSession();
  }
  if (!result) throw new AppError(503, "SERVICE_UNAVAILABLE", "Check-in could not be completed.");
  return result;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function findCommitteeTickets(
  eventId: string,
  userId: string,
  query: { q?: string; page: number; limit: number },
) {
  const parsedEventId = await assertCommitteeAssignment(eventId, userId);
  const filter: Record<string, unknown> = { eventId: parsedEventId };
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [
      { attendeeName: pattern },
      { ticketCode: pattern },
      { "ticketTypeSnapshot.name": pattern },
      { checkInStatus: pattern },
    ];
  }
  const [tickets, total] = await Promise.all([
    Ticket.find(filter)
      .sort({ attendeeName: 1, _id: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    Ticket.countDocuments(filter),
  ]);
  return {
    data: tickets.map((ticket) => ({
      ticketId: ticket._id.toString(),
      ticketCode: ticket.ticketCode,
      attendeeName: ticket.attendeeName,
      ticketTypeName: ticket.ticketTypeSnapshot.name,
      checkInStatus: ticket.checkInStatus,
      checkedInAt: ticket.checkedInAt ?? null,
    })),
    meta: { page: query.page, limit: query.limit, total },
  };
}

export async function getCheckInHistory(
  eventId: string,
  userId: string,
  query: { page: number; limit: number },
) {
  const parsedEventId = await assertCommitteeAssignment(eventId, userId);
  const filter = { eventId: parsedEventId, checkInStatus: "used" as const };
  const [tickets, total, paid] = await Promise.all([
    Ticket.find(filter)
      .populate("checkedInBy", "name")
      .sort({ checkedInAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    Ticket.countDocuments(filter),
    Order.aggregate<{ paidTickets: number }>([
      { $match: { eventId: parsedEventId, paymentStatus: "paid" } },
      { $group: { _id: null, paidTickets: { $sum: "$quantity" } } },
    ]),
  ]);
  return {
    data: tickets.map((ticket) => {
      const actor = ticket.checkedInBy as unknown as { _id: Types.ObjectId; name: string } | undefined;
      return {
        ticketId: ticket._id.toString(),
        ticketCode: ticket.ticketCode,
        attendeeName: ticket.attendeeName,
        ticketTypeName: ticket.ticketTypeSnapshot.name,
        checkedInAt: ticket.checkedInAt,
        checkedInBy: actor ? { id: actor._id.toString(), name: actor.name } : null,
      };
    }),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      paidTickets: paid[0]?.paidTickets ?? 0,
      generatedAt: new Date(),
    },
  };
}
