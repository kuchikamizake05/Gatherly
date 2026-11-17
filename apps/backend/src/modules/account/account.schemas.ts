import { z } from "zod";
import { AppError } from "../../lib/app-error.js";

export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[\d\s()-]{7,25}$/)
      .nullable(),
  })
  .strict();
export const passwordSchema = z
  .object({
    currentPassword: z.string().max(128).optional(),
    newPassword: z.string().min(12).max(128),
  })
  .strict();
export const notificationsSchema = z
  .object({ reminders: z.boolean(), recommendations: z.boolean() })
  .strict();
export const forgotSchema = z.object({ email: z.string().trim().email().max(254) }).strict();
export const resetSchema = z
  .object({ token: z.string().min(32).max(256), password: z.string().min(12).max(128) })
  .strict();

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new AppError(
    400,
    "VALIDATION_ERROR",
    "Please check the submitted fields.",
    Object.fromEntries(
      result.error.issues.map((issue) => [issue.path.join(".") || "body", issue.message]),
    ),
  );
}
