import nodemailer from "nodemailer";

import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { otpEmail } from "../notifications/email-templates.js";

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
  const mail = otpEmail(code, purpose);
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });
};
