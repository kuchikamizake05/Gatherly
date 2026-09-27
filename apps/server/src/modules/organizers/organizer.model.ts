import { Schema, Types, model } from "mongoose";

export interface OrganizerDocument {
  ownerId: Types.ObjectId;
  name: string;
  description: string;
  contactEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const organizerSchema = new Schema<OrganizerDocument>(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true, unique: true, ref: "User" },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    contactEmail: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

export const Organizer = model<OrganizerDocument>("Organizer", organizerSchema);
