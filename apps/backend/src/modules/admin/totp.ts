import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { AppError } from "../../lib/app-error.js";

function encryptionKey() {
  const secret = process.env.ADMIN_ENCRYPTION_KEY ?? process.env.OTP_SECRET;
  if (!secret || secret.length < 32)
    throw new AppError(503, "ADMIN_UNAVAILABLE", "Admin encryption key is not configured.");
  return createHash("sha256").update(secret).digest();
}
export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function decryptTotpSecret(value: string): string {
  const buffer = Buffer.from(value, "base64");
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), buffer.subarray(0, 12));
  cipher.setAuthTag(buffer.subarray(12, 28));
  return Buffer.concat([cipher.update(buffer.subarray(28)), cipher.final()]).toString("utf8");
}
export function decodeBase32(value: string): Buffer {
  let bits = "";
  for (const char of value.toUpperCase().replace(/=+$/, "")) {
    const index = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(char);
    if (index < 0) throw new Error("Invalid base32 TOTP secret");
    bits += index.toString(2).padStart(5, "0");
  }
  return Buffer.from(
    Array.from({ length: Math.floor(bits.length / 8) }, (_, i) =>
      parseInt(bits.slice(i * 8, i * 8 + 8), 2),
    ),
  );
}
export function totpAt(secret: string, counter: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}
export function verifyTotp(secret: string, code: string, now = new Date()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const counter = Math.floor(now.getTime() / 30_000);
  for (const delta of [-1, 0, 1]) {
    const step = counter + delta;
    if (step >= 0 && timingSafeEqual(Buffer.from(totpAt(secret, step)), Buffer.from(code)))
      return step;
  }
  return null;
}
