import { Schema, Types, model } from "mongoose";

export interface BankAccountDocument {
  organizerId: Types.ObjectId;
  bank: string;
  accountNumber: string;
  holderName: string;
}
export const BankAccount = model<BankAccountDocument>(
  "BankAccount",
  new Schema<BankAccountDocument>(
    {
      organizerId: { type: Schema.Types.ObjectId, required: true, unique: true, ref: "Organizer" },
      bank: { type: String, required: true },
      accountNumber: { type: String, required: true },
      holderName: { type: String, required: true },
    },
    { timestamps: true },
  ),
);

export interface PayoutDocument {
  organizerId: Types.ObjectId;
  eventId: Types.ObjectId;
  amount: number;
  bank: string;
  accountNumber: string;
  holderName: string;
  status: "requested" | "transferred";
  requestedAt: Date;
  transferredAt?: Date;
  transferReference?: string;
  transferredBy?: Types.ObjectId;
}
export const Payout = model<PayoutDocument>(
  "Payout",
  new Schema<PayoutDocument>(
    {
      organizerId: { type: Schema.Types.ObjectId, required: true, ref: "Organizer" },
      eventId: { type: Schema.Types.ObjectId, required: true, unique: true, ref: "Event" },
      amount: { type: Number, required: true, min: 1 },
      bank: { type: String, required: true },
      accountNumber: { type: String, required: true },
      holderName: { type: String, required: true },
      status: { type: String, enum: ["requested", "transferred"], default: "requested" },
      requestedAt: { type: Date, default: Date.now },
      transferredAt: Date,
      transferReference: String,
      transferredBy: Schema.Types.ObjectId,
    },
    { timestamps: true },
  ),
);
