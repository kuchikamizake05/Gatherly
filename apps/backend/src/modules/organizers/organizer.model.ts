import { Schema, Types, model } from "mongoose";

export interface OrganizerDocument {
  ownerId: Types.ObjectId;
  name: string;
  description: string;
  contactEmail: string;
  username?: string;
  city: string;
  logoUrl?: string;
  links: Array<{ type: string; url: string }>;
  status: "active" | "never_logged_in" | "frozen";
  frozenReason?: string;
  applicationNumber?: string;
  pic?: { name: string; role: string; email: string; phone: string };
  createdAt: Date;
  updatedAt: Date;
}

const organizerSchema = new Schema<OrganizerDocument>(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true, unique: true, ref: "User" },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    contactEmail: { type: String, required: true, trim: true },
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    city: { type: String, default: "" },
    logoUrl: String,
    links: { type: [{ type: { type: String }, url: String, _id: false }], default: [] },
    status: { type: String, enum: ["active", "never_logged_in", "frozen"], default: "active" },
    frozenReason: String,
    applicationNumber: String,
    pic: { name: String, role: String, email: String, phone: String },
  },
  { timestamps: true },
);

export const Organizer = model<OrganizerDocument>("Organizer", organizerSchema);
