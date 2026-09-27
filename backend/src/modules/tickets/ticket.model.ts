import { Schema, Types, model } from "mongoose";

export type CheckInStatus = "unused" | "used";

export interface TicketDocument {
  orderId: Types.ObjectId;
  eventId: Types.ObjectId;
  buyerId: Types.ObjectId;
  ticketTypeId: Types.ObjectId;
  sequence: number;
  attendeeName: string;
  ticketCode: string;
  qrToken: string;
  checkInStatus: CheckInStatus;
  checkedInAt?: Date;
  eventSnapshot: {
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
    ticketCode: { type: String, required: true, unique: true },
    qrToken: { type: String, required: true, unique: true, select: false },
    checkInStatus: {
      type: String,
      enum: ["unused", "used"],
      default: "unused",
      required: true,
    },
    checkedInAt: { type: Date },
    eventSnapshot: {
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
ticketSchema.index({ eventId: 1, checkInStatus: 1 });

export const Ticket = model<TicketDocument>("Ticket", ticketSchema);
