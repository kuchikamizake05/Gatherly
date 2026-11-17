import { Schema, Types, model } from "mongoose";

export interface PasswordResetDocument {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

const schema = new Schema<PasswordResetDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: { type: Date },
  },
  { timestamps: true },
);

export const PasswordReset = model<PasswordResetDocument>("PasswordReset", schema);
