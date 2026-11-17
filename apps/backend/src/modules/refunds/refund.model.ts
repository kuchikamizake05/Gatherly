import { Schema, Types, model } from "mongoose";

export type RefundState =
  | "requested"
  | "approved"
  | "processing"
  | "manual_required"
  | "refunded"
  | "rejected";
export interface RefundDocument {
  orderId: Types.ObjectId;
  eventId: Types.ObjectId;
  buyerId: Types.ObjectId;
  ticketIds: Types.ObjectId[];
  reason: string;
  kind: "buyer" | "event_cancelled";
  status: RefundState;
  amount: number;
  baseAmount: number;
  refundKey: string;
  decidedBy?: Types.ObjectId;
  decisionNote?: string;
  decidedAt?: Date;
  refundedAt?: Date;
  transferReference?: string;
  leaseUntil?: Date;
  nextAttemptAt: Date;
  attempts: number;
  firstAttemptAt?: Date;
  providerAcknowledgedAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<RefundDocument>(
  {
    orderId: { type: Schema.Types.ObjectId, required: true, ref: "Order", index: true },
    eventId: { type: Schema.Types.ObjectId, required: true, ref: "Event", index: true },
    buyerId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    ticketIds: [{ type: Schema.Types.ObjectId, ref: "Ticket" }],
    reason: { type: String, required: true },
    kind: { type: String, enum: ["buyer", "event_cancelled"], required: true },
    status: {
      type: String,
      enum: ["requested", "approved", "processing", "manual_required", "refunded", "rejected"],
      required: true,
      default: "requested",
    },
    amount: { type: Number, required: true, min: 0 },
    baseAmount: { type: Number, required: true, min: 0 },
    refundKey: { type: String, required: true, unique: true },
    decidedBy: Schema.Types.ObjectId,
    decisionNote: String,
    decidedAt: Date,
    refundedAt: Date,
    transferReference: String,
    leaseUntil: Date,
    nextAttemptAt: { type: Date, default: Date.now, required: true },
    attempts: { type: Number, default: 0 },
    firstAttemptAt: Date,
    providerAcknowledgedAt: Date,
    lastError: String,
  },
  { timestamps: true },
);
schema.index({ status: 1, nextAttemptAt: 1, leaseUntil: 1 });
export const Refund = model<RefundDocument>("Refund", schema);
