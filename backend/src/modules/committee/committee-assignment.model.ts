import { Schema, Types, model } from "mongoose";

export interface CommitteeAssignmentDocument {
  eventId: Types.ObjectId;
  userId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const committeeAssignmentSchema = new Schema<CommitteeAssignmentDocument>(
  {
    eventId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true, ref: "User" },
    assignedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  },
  { timestamps: true },
);

committeeAssignmentSchema.index({ eventId: 1, userId: 1 }, { unique: true });

export const CommitteeAssignment = model<CommitteeAssignmentDocument>(
  "CommitteeAssignment",
  committeeAssignmentSchema,
);
