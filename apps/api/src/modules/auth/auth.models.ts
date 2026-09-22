import { Schema, Types, model } from "mongoose";

export interface UserDocument {
  name: string;
  emailNormalized: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true },
    emailNormalized: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

export const User = model<UserDocument>("User", userSchema);

export interface SessionDocument {
  tokenHash: string;
  csrfTokenHash: string;
  userId: Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<SessionDocument>(
  {
    tokenHash: { type: String, required: true, unique: true },
    csrfTokenHash: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
);

export const Session = model<SessionDocument>("Session", sessionSchema);
