import { Schema, Types, model } from "mongoose";
interface SavedEventDocument {
  userId: Types.ObjectId;
  eventId: Types.ObjectId;
  createdAt: Date;
}
const schema = new Schema<SavedEventDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
    eventId: { type: Schema.Types.ObjectId, required: true, ref: "Event" },
  },
  { timestamps: true },
);
schema.index({ userId: 1, eventId: 1 }, { unique: true });
export const SavedEvent = model<SavedEventDocument>("SavedEvent", schema);
