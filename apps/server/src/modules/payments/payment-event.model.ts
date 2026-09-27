import { Schema, model } from "mongoose";

export type NormalizedPaymentStatus = "paid" | "pending" | "failed" | "expired" | "review";

export interface PaymentEventDocument {
  providerOrderId: string;
  providerTransactionId?: string;
  fingerprint: string;
  providerStatus: string;
  normalizedStatus: NormalizedPaymentStatus;
  processingStatus: "received" | "processed" | "retry";
  receivedAt: Date;
  processedAt?: Date;
  errorCode?: string;
}

const paymentEventSchema = new Schema<PaymentEventDocument>(
  {
    providerOrderId: { type: String, required: true, index: true },
    providerTransactionId: { type: String },
    fingerprint: { type: String, required: true, unique: true },
    providerStatus: { type: String, required: true },
    normalizedStatus: {
      type: String,
      enum: ["paid", "pending", "failed", "expired", "review"],
      required: true,
    },
    processingStatus: {
      type: String,
      enum: ["received", "processed", "retry"],
      default: "received",
      required: true,
      index: true,
    },
    receivedAt: { type: Date, default: Date.now, required: true },
    processedAt: { type: Date },
    errorCode: { type: String },
  },
  { timestamps: false },
);

paymentEventSchema.index({ processingStatus: 1, receivedAt: 1 });

export const PaymentEvent = model<PaymentEventDocument>("PaymentEvent", paymentEventSchema);
