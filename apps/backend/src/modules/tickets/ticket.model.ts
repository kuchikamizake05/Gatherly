import { Schema, Types, model } from "mongoose";

export type CheckInStatus = "unused" | "used" | "cancelled";

export interface TicketDocument {
  orderId: Types.ObjectId;
  eventId: Types.ObjectId;
  buyerId: Types.ObjectId;
  ticketTypeId: Types.ObjectId;
  sequence: number;
  attendeeName: string;
  attendeeEmail?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  refundId?: Types.ObjectId;
  ticketCode: string;
  qrToken: string;
  checkInStatus: CheckInStatus;
  checkedInAt?: Date;
  checkedInBy?: Types.ObjectId;
  eventSnapshot: {
    slug?: string;
    poster?: string;
    endsAt?: Date;
    title: string;
    startsAt: Date;
    timezone: string;
    venueName: string;
    address: string;
    city: string;
  };
  ticketTypeSnapshot: { name: string };
  createdAt: Date;
  updatedAt: Date;
}

const ticketSchema = new Schema<TicketDocument>(
  {
    orderId: { type: Schema.Types.ObjectId, required: true, ref: "Order" },
    eventId: { type: Schema.Types.ObjectId, required: true, ref: "Event" },
    buyerId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    ticketTypeId: { type: Schema.Types.ObjectId, required: true, ref: "TicketType" },
    sequence: { type: Number, required: true, min: 0 },
    attendeeName: { type: String, required: true, trim: true },
    attendeeEmail: String,
    cancelledAt: Date,
    cancellationReason: String,
    refundId: Schema.Types.ObjectId,
    ticketCode: { type: String, required: true, unique: true },
    qrToken: { type: String, required: true, unique: true, select: false },
    checkInStatus: {
      type: String,
      enum: ["unused", "used", "cancelled"],
      default: "unused",
      required: true,
    },
    checkedInAt: { type: Date },
    checkedInBy: { type: Schema.Types.ObjectId, ref: "User" },
    eventSnapshot: {
      slug: String,
      poster: String,
      endsAt: Date,
      title: { type: String, required: true },
      startsAt: { type: Date, required: true },
      timezone: { type: String, required: true },
      venueName: { type: String, required: true },
      address: { type: String, required: true },
      city: { type: String, required: true },
    },
    ticketTypeSnapshot: {
      name: { type: String, required: true },
    },
  },
  { timestamps: true },
);

ticketSchema.index({ orderId: 1, sequence: 1 }, { unique: true });
ticketSchema.index({ buyerId: 1, createdAt: -1, _id: -1 });
ticketSchema.index({ eventId: 1, checkInStatus: 1, checkedInAt: -1, _id: -1 });

export const Ticket = model<TicketDocument>("Ticket", ticketSchema);
