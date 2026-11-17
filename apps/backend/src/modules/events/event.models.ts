import { Schema, Types, model } from "mongoose";

export type PublicationStatus = "draft" | "published" | "cancelled";

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
  locationType: "offline" | "online";
  terms: string[];
  performerLabel: string;
  performers: Array<{
    name: string;
    note: string;
    time: string;
    photoAssetId?: string;
    photoUrl?: string;
  }>;
  showRemaining: boolean;
  checkInOpensAt?: Date;
  checkInClosesAt?: Date;
  financialVersion: number;
  cancellationStatus?: "requested" | "approved" | "rejected";
  cancellationReason?: string;
  cancellationRequestedAt?: Date;
  cancellationDecidedAt?: Date;
  cancellationDecidedBy?: Types.ObjectId;
  cancellationDecisionNote?: string;
  checkoutVersion: number;
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
    publicationStatus: {
      type: String,
      enum: ["draft", "published", "cancelled"],
      default: "draft",
      index: true,
    },
    salesClosed: { type: Boolean, default: false },
    locationType: { type: String, enum: ["offline", "online"], default: "offline" },
    terms: { type: [String], default: [] },
    performerLabel: { type: String, default: "Performers" },
    performers: {
      type: [
        {
          name: String,
          note: String,
          time: String,
          photoAssetId: String,
          photoUrl: String,
          _id: false,
        },
      ],
      default: [],
    },
    showRemaining: { type: Boolean, default: true },
    checkInOpensAt: Date,
    checkInClosesAt: Date,
    financialVersion: { type: Number, default: 0 },
    cancellationStatus: { type: String, enum: ["requested", "approved", "rejected"] },
    cancellationReason: String,
    cancellationRequestedAt: Date,
    cancellationDecidedAt: Date,
    cancellationDecidedBy: Schema.Types.ObjectId,
    cancellationDecisionNote: String,
    checkoutVersion: { type: Number, default: 0, min: 0, required: true },
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
  salesStopped: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ticketTypeSchema = new Schema<TicketTypeDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, required: true, ref: "Event", index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    price: { type: Number, required: true, min: 0 },
    capacity: { type: Number, required: true, min: 1 },
    reserved: { type: Number, required: true, default: 0, min: 0 },
    sold: { type: Number, required: true, default: 0, min: 0 },
    salesStartsAt: { type: Date, required: true },
    salesEndsAt: { type: Date, required: true },
    salesStopped: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const TicketType = model<TicketTypeDocument>("TicketType", ticketTypeSchema);
