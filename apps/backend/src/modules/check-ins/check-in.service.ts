import mongoose, { Types } from "mongoose";

import { AppError } from "../../lib/app-error.js";
import { CommitteeAssignment } from "../committee/committee-assignment.model.js";
import { Event } from "../events/event.models.js";
import { Order } from "../orders/order.model.js";
import { Organizer } from "../organizers/organizer.model.js";
import { ScanLog } from "./scan-log.model.js";
import { publishUpdate } from "../realtime/events.js";
import { Ticket } from "../tickets/ticket.model.js";
import type { CheckInInput } from "./check-in.schemas.js";

const checkInLeadMs = 2 * 60 * 60 * 1000;

function assertEventId(eventId: string) {
  if (!Types.ObjectId.isValid(eventId)) {
    throw new AppError(404, "NOT_FOUND", "Event not found.");
  }
  return new Types.ObjectId(eventId);
}

export async function assertCommitteeAssignment(eventId: string, userId: string) {
  const parsedEventId = assertEventId(eventId);
  const assignment = await CommitteeAssignment.exists({ eventId: parsedEventId, userId });
  if (!assignment) {
    const event = await Event.findById(parsedEventId).lean();
    const owner = event && (await Organizer.exists({ _id: event.organizerId, ownerId: userId }));
    if (!owner) throw new AppError(403, "FORBIDDEN", "Committee access is required.");
  }
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
  checkInStatus: "unused" | "used" | "cancelled";
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
        const owner = await Organizer.exists({ _id: event.organizerId, ownerId: userId }).session(
          session,
        );
        if (!owner) throw new AppError(403, "FORBIDDEN", "Committee access is required.");
      }

      await Event.updateOne({ _id: event._id }, { $inc: { checkoutVersion: 1 } }, { session });
      const opensAt = event.checkInOpensAt ?? new Date(event.startsAt.getTime() - checkInLeadMs);
      const closesAt = event.checkInClosesAt ?? event.endsAt;
      if (event.publicationStatus === "cancelled" || now < opensAt || now > closesAt) {
        throw new AppError(409, "CHECKIN_CLOSED", "Check-in is closed for this event.");
      }

      const ticket = await Ticket.findOne(credentialFilter(input)).session(session);
      if (!ticket) throw new AppError(404, "INVALID_TICKET", "Ticket is invalid.");
      if (!ticket.eventId.equals(parsedEventId)) {
        throw new AppError(409, "WRONG_EVENT", "Ticket belongs to another event.");
      }

      if (ticket.checkInStatus === "cancelled")
        throw new AppError(409, "TICKET_CANCELLED", "Ticket has been cancelled.");
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
      await ScanLog.create(
        [
          {
            eventId: parsedEventId,
            actorId: new Types.ObjectId(userId),
            ticketId: checkedIn._id,
            ticketCode: checkedIn.ticketCode,
            attendeeName: checkedIn.attendeeName,
            ticketTypeName: checkedIn.ticketTypeSnapshot.name,
            method: input.qrPayload ? "scan" : "manual",
            accepted: true,
            code: "CHECKED_IN",
          },
        ],
        { session },
      );
      result = successDto(checkedIn);
    });
  } finally {
    await session.endSession();
  }
  if (!result) throw new AppError(503, "SERVICE_UNAVAILABLE", "Check-in could not be completed.");
  await publishUpdate({ topic: "event", id: eventId, type: "checkin.updated" });
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
      { attendeeEmail: pattern },
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
  query: { page: number; limit: number; rejectedOnly?: boolean },
) {
  const parsedEventId = await assertCommitteeAssignment(eventId, userId);
  if (query.rejectedOnly) {
    const filter = { eventId: parsedEventId, accepted: false };
    const [logs, total, paidTickets] = await Promise.all([
      ScanLog.find(filter)
        .populate("actorId", "name")
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      ScanLog.countDocuments(filter),
      Ticket.countDocuments({ eventId: parsedEventId, checkInStatus: { $ne: "cancelled" } }),
    ]);
    return {
      data: logs.map((r: any) => ({
        ticketId: r.ticketId?.toString() ?? r._id.toString(),
        ticketCode: r.ticketCode ?? "",
        attendeeName: r.attendeeName ?? "",
        ticketTypeName: r.ticketTypeName ?? "",
        checkedInAt: r.createdAt,
        checkedInBy: r.actorId ? { id: r.actorId._id.toString(), name: r.actorId.name } : null,
        method: r.method,
        accepted: false,
        code: r.code,
      })),
      meta: { page: query.page, limit: query.limit, total, paidTickets, generatedAt: new Date() },
    };
  }
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
      const actor = ticket.checkedInBy as unknown as
        | { _id: Types.ObjectId; name: string }
        | undefined;
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

export async function listAssignedEvents(userId: string) {
  const assignments = await CommitteeAssignment.find({ userId }).select("eventId").lean();
  const organizer = await Organizer.findOne({ ownerId: userId }).lean();
  const events = await Event.find({
    $or: [
      { _id: { $in: assignments.map((a) => a.eventId) } },
      ...(organizer ? [{ organizerId: organizer._id }] : []),
    ],
    publicationStatus: "published",
  })
    .sort({ startsAt: 1 })
    .lean();
  const data = [];
  for (const event of events) {
    const [checkedIn, paidTickets] = await Promise.all([
      Ticket.countDocuments({ eventId: event._id, checkInStatus: "used" }),
      Ticket.countDocuments({ eventId: event._id, checkInStatus: { $ne: "cancelled" } }),
    ]);
    data.push({
      id: event._id.toString(),
      title: event.title,
      startsAt: event.startsAt,
      venueName: event.venueName,
      poster: event.posterAssetId ?? null,
      checkedIn,
      paidTickets,
      scanOpensAt: event.checkInOpensAt ?? new Date(event.startsAt.getTime() - checkInLeadMs),
      scanClosesAt: event.checkInClosesAt ?? event.endsAt,
    });
  }
  return { data, meta: { page: 1, limit: data.length, total: data.length } };
}
