import { Schema, Types, model } from "mongoose";

export type PaymentStatus = "pending" | "paid" | "failed" | "expired";
export type ReservationStatus = "held" | "converted" | "released";
export type IssuanceStatus = "not_ready" | "processing" | "issued";
export type PaymentSessionState = "not_started" | "creating" | "ready" | "uncertain" | "closed";

export interface OrderDocument {
  buyerId: Types.ObjectId;
  eventId: Types.ObjectId;
  ticketTypeId: Types.ObjectId;
  orderCode: string;
  providerOrderId: string;
  quantity: number;
  attendees: Array<{ name: string }>;
  unitPrice: number;
  totalAmount: number;
  currency: "IDR";
  eventSnapshot: {
    title: string;
    startsAt: Date;
    timezone: string;
    venueName: string;
    address: string;
    city: string;
  };
  ticketTypeSnapshot: { name: string; unitPrice: number };
  buyerSnapshot: { name: string; email: string };
  paymentStatus: PaymentStatus;
  reservationStatus: ReservationStatus;
  issuanceStatus: IssuanceStatus;
  paymentSessionState: PaymentSessionState;
  snapToken?: string;
  redirectUrl?: string;
  paymentSessionAttempts: number;
  paymentSessionLastError?: string;
  expiresAt: Date;
  idempotencyKey: string;
  requestHash: string;
  paymentTimeline: Array<{ status: string; at: Date }>;
  nextReconcileAt: Date;
  leaseUntil?: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<OrderDocument>(
  {
    buyerId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    eventId: { type: Schema.Types.ObjectId, required: true, ref: "Event" },
    ticketTypeId: { type: Schema.Types.ObjectId, required: true, ref: "TicketType" },
    orderCode: { type: String, required: true, unique: true },
    providerOrderId: { type: String, required: true, unique: true },
    quantity: { type: Number, required: true, min: 1, max: 4 },
    attendees: {
      type: [{ name: { type: String, required: true, trim: true }, _id: false }],
      required: true,
    },
    unitPrice: { type: Number, required: true, min: 1 },
    totalAmount: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ["IDR"], default: "IDR", required: true },
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
      unitPrice: { type: Number, required: true },
    },
    buyerSnapshot: {
      name: { type: String, required: true },
      email: { type: String, required: true },
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "expired"],
      default: "pending",
      required: true,
    },
    reservationStatus: {
      type: String,
      enum: ["held", "converted", "released"],
      default: "held",
      required: true,
    },
    issuanceStatus: {
      type: String,
      enum: ["not_ready", "processing", "issued"],
      default: "not_ready",
      required: true,
    },
    paymentSessionState: {
      type: String,
      enum: ["not_started", "creating", "ready", "uncertain", "closed"],
      default: "not_started",
      required: true,
    },
    snapToken: { type: String },
    redirectUrl: { type: String },
    paymentSessionAttempts: { type: Number, default: 0, min: 0, required: true },
    paymentSessionLastError: { type: String },
    expiresAt: { type: Date, required: true },
    idempotencyKey: { type: String, required: true },
    requestHash: { type: String, required: true },
    paymentTimeline: {
      type: [{ status: { type: String, required: true }, at: { type: Date, required: true }, _id: false }],
      default: [],
    },
    nextReconcileAt: { type: Date, required: true },
    leaseUntil: { type: Date },
    paidAt: { type: Date },
  },
  { timestamps: true },
);

orderSchema.index({ buyerId: 1, idempotencyKey: 1 }, { unique: true });
orderSchema.index({ buyerId: 1, createdAt: -1, _id: -1 });
orderSchema.index({ paymentStatus: 1, nextReconcileAt: 1 });
orderSchema.index({ eventId: 1, paymentStatus: 1, paidAt: 1 });

export const Order = model<OrderDocument>("Order", orderSchema);
