import { Schema, Types, model } from "mongoose";
export interface ScanLogDocument {
  eventId: Types.ObjectId;
  actorId: Types.ObjectId;
  ticketId?: Types.ObjectId;
  ticketCode?: string;
  attendeeName?: string;
  ticketTypeName?: string;
  method: "scan" | "manual";
  accepted: boolean;
  code: string;
  createdAt: Date;
}
export const ScanLog = model<ScanLogDocument>(
  "ScanLog",
  new Schema<ScanLogDocument>(
    {
      eventId: { type: Schema.Types.ObjectId, required: true, index: true },
      actorId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
      ticketId: Schema.Types.ObjectId,
      ticketCode: String,
      attendeeName: String,
      ticketTypeName: String,
      method: { type: String, enum: ["scan", "manual"], required: true },
      accepted: { type: Boolean, required: true },
      code: { type: String, required: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
  ),
);
