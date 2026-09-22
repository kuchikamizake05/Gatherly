import { Schema, Types, model } from "mongoose";

export type PublicationStatus = "draft" | "published";

export interface EventDocument {
  organizerId: Types.ObjectId;
  slug: string;
  title: string;
  description: string;
  category: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  venueName: string;
  address: string;
  city: string;
  posterAssetId?: string;
  publicationStatus: PublicationStatus;
  salesClosed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<EventDocument>(
  {
    organizerId: { type: Schema.Types.ObjectId, required: true, ref: "Organizer", index: true },
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    timezone: { type: String, required: true },
    venueName: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    posterAssetId: { type: String },
    publicationStatus: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    salesClosed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

eventSchema.index({ organizerId: 1, publicationStatus: 1, startsAt: -1 });

export const Event = model<EventDocument>("Event", eventSchema);

export interface TicketTypeDocument {
  eventId: Types.ObjectId;
  name: string;
  description: string;
  price: number;
  capacity: number;
  reserved: number;
  sold: number;
  salesStartsAt: Date;
  salesEndsAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ticketTypeSchema = new Schema<TicketTypeDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, required: true, ref: "Event", index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 1 },
    capacity: { type: Number, required: true, min: 1 },
    reserved: { type: Number, required: true, default: 0, min: 0 },
    sold: { type: Number, required: true, default: 0, min: 0 },
    salesStartsAt: { type: Date, required: true },
    salesEndsAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const TicketType = model<TicketTypeDocument>("TicketType", ticketTypeSchema);
