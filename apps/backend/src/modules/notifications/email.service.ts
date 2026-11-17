import nodemailer from "nodemailer";
import { Schema, model, type ClientSession } from "mongoose";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";

export type EmailInput = {
  key: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: string; contentType: string }[];
  expiresAt?: Date;
};
const schema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    text: { type: String, required: true },
    html: String,
    attachments: [
      {
        filename: String,
        content: { type: String, select: false },
        contentType: String,
        _id: false,
      },
    ],
    state: { type: String, enum: ["queued", "sending", "sent", "failed"], default: "queued" },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    leaseUntil: Date,
    leaseToken: String,
    expiresAt: Date,
    sentAt: Date,
    lastError: String,
  },
  { timestamps: true },
);
export const EmailJob = model("EmailJob", schema);
export async function queueEmail(input: EmailInput, session?: ClientSession) {
  await EmailJob.updateOne({ key: input.key }, { $setOnInsert: input }, { upsert: true, session });
}
export async function deliverEmailJobs(limit = 20) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_FROM) return 0;
  const mailer = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  let count = 0;
  for (let i = 0; i < limit; i++) {
    const now = new Date();
    const leaseToken = randomUUID();
    const job = await EmailJob.findOneAndUpdate(
      {
        state: { $in: ["queued", "sending"] },
        nextAttemptAt: { $lte: now },
        $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }],
      },
      {
        $set: { state: "sending", leaseUntil: new Date(Date.now() + 120_000), leaseToken },
        $inc: { attempts: 1 },
      },
      { returnDocument: "after" },
    ).select("+attachments.content");
    if (!job) break;
    try {
      if (job.expiresAt && job.expiresAt <= now) {
        await EmailJob.updateOne(
          { _id: job._id, leaseToken },
          {
            $set: { state: "failed", lastError: "expired" },
            $unset: { leaseUntil: 1, leaseToken: 1 },
          },
        );
        continue;
      }
      await mailer.sendMail({
        from: env.SMTP_FROM,
        to: job.to,
        subject: job.subject,
        text: job.text,
        html: job.html ?? undefined,
        messageId: `<${job.id}@gatherly>`,
        attachments: job.attachments.map((a) => ({
          filename: a.filename ?? undefined,
          content: Buffer.from(a.content ?? "", "base64"),
          contentType: a.contentType ?? undefined,
        })),
      });
      await EmailJob.updateOne(
        { _id: job._id, leaseToken },
        {
          $set: { state: "sent", sentAt: new Date() },
          $unset: { leaseUntil: 1, leaseToken: 1, attachments: 1 },
        },
      );
      count++;
    } catch {
      await EmailJob.updateOne(
        { _id: job._id, leaseToken },
        {
          $set: {
            state: job.attempts >= 10 ? "failed" : "queued",
            lastError: "delivery_failed",
            nextAttemptAt: new Date(Date.now() + Math.min(3600_000, 2 ** job.attempts * 10_000)),
          },
          $unset: { leaseUntil: 1, leaseToken: 1 },
        },
      );
    }
  }
  return count;
}
