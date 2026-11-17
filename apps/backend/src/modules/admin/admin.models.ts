import { Schema, model } from "mongoose";

export const AdminAccount = model(
  "AdminAccount",
  new Schema(
    {
      email: { type: String, required: true, unique: true, lowercase: true },
      name: { type: String, required: true },
      passwordHash: { type: String, required: true },
      totpSecretEncrypted: { type: String, required: true },
      backupCodeHashes: { type: [String], default: [] },
      active: { type: Boolean, default: true },
      primary: { type: Boolean, default: false },
      failures: { type: Number, default: 0 },
      lockedUntil: Date,
      lastTotpCounter: Number,
    },
    { timestamps: true },
  ),
);
export const AdminSession = model(
  "AdminSession",
  new Schema(
    {
      accountId: { type: Schema.Types.ObjectId, required: true, ref: "AdminAccount" },
      tokenHash: { type: String, required: true, unique: true },
      csrfToken: { type: String, required: true },
      expiresAt: { type: Date, required: true, index: { expires: 0 } },
    },
    { timestamps: true },
  ),
);
export const AdminChallenge = model(
  "AdminChallenge",
  new Schema(
    {
      accountId: { type: Schema.Types.ObjectId, required: true, ref: "AdminAccount" },
      tokenHash: { type: String, required: true, unique: true },
      attempts: { type: Number, default: 0 },
      usedAt: Date,
      expiresAt: { type: Date, required: true, index: { expires: 0 } },
    },
    { timestamps: true },
  ),
);
export const AuditLog = model(
  "AuditLog",
  new Schema(
    {
      actorId: { type: String, required: true, index: true },
      action: { type: String, required: true },
      targetId: { type: String, index: true },
      note: String,
    },
    { timestamps: true },
  ),
);
