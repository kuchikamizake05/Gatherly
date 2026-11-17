import { Schema, model } from "mongoose";
export const OrganizerApplication = model(
  "OrganizerApplication",
  new Schema(
    {
      number: { type: String, required: true, unique: true },
      organizerName: { type: String, required: true },
      organizerType: {
        type: String,
        enum: ["komunitas", "organisasi_kampus", "perusahaan", "individu"],
        required: true,
      },
      description: { type: String, required: true },
      address: { province: String, city: String, street: String, postalCode: String },
      links: { type: [{ type: { type: String }, url: String, _id: false }], default: [] },
      pic: { name: String, role: String, email: { type: String, lowercase: true }, phone: String },
      username: { type: String, required: true, lowercase: true },
      ktp: { id: String, name: String, type: { type: String }, size: Number },
      legalDocument: { id: String, name: String, type: { type: String }, size: Number },
      status: {
        type: String,
        enum: ["new", "needs_fix", "fix_submitted", "approved", "rejected"],
        default: "new",
        index: true,
      },
      activeEmail: { type: String, unique: true, sparse: true },
      submittedAt: { type: Date, default: Date.now },
      emailVerifiedAt: Date,
      emailVerificationHash: String,
      emailVerificationExpiresAt: Date,
      fixDeadline: Date,
      flags: { type: [{ field: String, note: String, _id: false }], default: [] },
      previousValues: { type: Schema.Types.Mixed },
      rejectionReason: String,
      decidedAt: Date,
      documentsExpireAt: Date,
      editTokenHash: String,
      editTokenExpiresAt: Date,
      version: { type: Number, default: 0 },
    },
    { timestamps: true },
  ),
);
OrganizerApplication.schema.index({ "pic.email": 1, createdAt: -1 });

export const ApplicationCounter = model(
  "ApplicationCounter",
  new Schema({
    month: { type: String, required: true, unique: true },
    sequence: { type: Number, default: 0 },
  }),
);

export const ApplicationDocument = model(
  "ApplicationDocument",
  new Schema(
    {
      storageId: { type: String, required: true, unique: true },
      ownerTokenHash: { type: String, required: true, index: true },
      name: { type: String, required: true },
      type: { type: String, required: true },
      size: { type: Number, required: true },
      applicationId: { type: Schema.Types.ObjectId, ref: "OrganizerApplication" },
    },
    { timestamps: true },
  ),
);
