import nodemailer from "nodemailer";

import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";

export interface OtpMail {
  to: string;
  code: string;
  purpose: "register" | "login";
}

export type OtpMailer = (mail: OtpMail) => Promise<void>;

export const sendOtpEmail: OtpMailer = async ({ to, code, purpose }) => {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_FROM) {
    throw new AppError(503, "EMAIL_UNAVAILABLE", "Email delivery is unavailable.");
  }
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  const action = purpose === "register" ? "verify your Gatherly account" : "complete your Gatherly login";
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: "Your Gatherly verification code",
    text: `Use ${code} to ${action}. This code expires in 10 minutes.`,
  });
};
