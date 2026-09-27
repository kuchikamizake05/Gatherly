import { Types, type HydratedDocument } from "mongoose";

import type { TicketDocument } from "./ticket.model.js";

type TicketLike = HydratedDocument<TicketDocument> | TicketDocument & { _id: Types.ObjectId };

export function ticketListDto(ticket: TicketLike) {
  return {
    id: ticket._id.toString(),
    orderId: ticket.orderId.toString(),
    event: ticket.eventSnapshot,
    ticketType: ticket.ticketTypeSnapshot,
    attendeeName: ticket.attendeeName,
    ticketCode: ticket.ticketCode,
    checkInStatus: ticket.checkInStatus,
    checkedInAt: ticket.checkedInAt ?? null,
  };
}

export function ticketDetailDto(ticket: TicketLike & { qrToken: string }) {
  return {
    ...ticketListDto(ticket),
    qrPayload: `gatherly:v1:${ticket.qrToken}`,
  };
}
