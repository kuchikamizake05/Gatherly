import { Schema, Types, model } from "mongoose";

export interface UserDocument {
  name: string;
  emailNormalized: string;
  passwordHash?: string;
  googleId?: string;
  emailVerifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true },
    emailNormalized: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    emailVerifiedAt: { type: Date },
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

export type AuthChallengePurpose = "register" | "login";

export interface AuthChallengeDocument {
  purpose: AuthChallengePurpose;
  emailNormalized: string;
  userId?: Types.ObjectId;
  name?: string;
  passwordHash?: string;
  codeHash: string;
  expiresAt: Date;
  resendAt: Date;
  attempts: number;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const authChallengeSchema = new Schema<AuthChallengeDocument>(
  {
    purpose: { type: String, enum: ["register", "login"], required: true },
    emailNormalized: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    name: { type: String, trim: true },
    passwordHash: { type: String },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    resendAt: { type: Date, required: true },
    attempts: { type: Number, required: true, default: 0, min: 0 },
    usedAt: { type: Date },
  },
  { timestamps: true },
);

authChallengeSchema.index({ emailNormalized: 1, purpose: 1, createdAt: -1 });

export const AuthChallenge = model<AuthChallengeDocument>("AuthChallenge", authChallengeSchema);

export interface OAuthStateDocument {
  stateHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const oauthStateSchema = new Schema<OAuthStateDocument>(
  {
    stateHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: { type: Date },
  },
  { timestamps: true },
);

export const OAuthState = model<OAuthStateDocument>("OAuthState", oauthStateSchema);
