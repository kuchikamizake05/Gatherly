import { Schema, Types, model } from "mongoose";
export type ReportReason = "fraud" | "wrong_info" | "inappropriate" | "other";
interface EventReportDocument {
  eventId: Types.ObjectId;
  organizerId: Types.ObjectId;
  reporterId: Types.ObjectId;
  eventTitle: string;
  organizerName: string;
  reason: ReportReason;
  note: string;
  status: "new" | "done";
  resolutionNote?: string;
  closedBy?: string;
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
const schema = new Schema<EventReportDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, required: true, ref: "Event", index: true },
    organizerId: { type: Schema.Types.ObjectId, required: true, ref: "Organizer", index: true },
    reporterId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    eventTitle: { type: String, required: true },
    organizerName: { type: String, required: true },
    reason: {
      type: String,
      enum: ["fraud", "wrong_info", "inappropriate", "other"],
      required: true,
    },
    note: { type: String, maxlength: 1000, default: "" },
    status: { type: String, enum: ["new", "done"], default: "new", required: true },
    resolutionNote: { type: String, maxlength: 2000 },
    closedBy: { type: String },
    closedAt: { type: Date },
  },
  { timestamps: true },
);
schema.index({ status: 1, createdAt: -1 });
schema.index(
  { reporterId: 1, eventId: 1 },
  { unique: true, partialFilterExpression: { status: "new" } },
);
export const EventReport = model<EventReportDocument>("EventReport", schema);
