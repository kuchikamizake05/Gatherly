import { Schema, model } from "mongoose";

const accountSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["organizer", "committee"], required: true },
    userId: { type: Schema.Types.ObjectId, required: true, unique: true, ref: "User" },
    organizerId: { type: Schema.Types.ObjectId, required: true, ref: "Organizer", index: true },
    email: { type: String, lowercase: true },
    passwordHash: { type: String, required: true },
    mustChangePassword: { type: Boolean, default: true },
    temporaryExpiresAt: Date,
    active: { type: Boolean, default: true },
    lastLoginAt: Date,
    failures: { type: Number, default: 0 },
    lockedUntil: Date,
    resetTokenHash: String,
    resetExpiresAt: Date,
  },
  { timestamps: true },
);
export const WorkspaceAccount = model("WorkspaceAccount", accountSchema);

const sessionSchema = new Schema(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "WorkspaceAccount",
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true },
    csrfToken: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);
export const WorkspaceSession = model("WorkspaceSession", sessionSchema);
