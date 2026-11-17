import { z } from "zod";
import { ApiError } from "./client";

export function readResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new ApiError(
    502,
    "INVALID_RESPONSE",
    "Data dari layanan belum lengkap atau belum dapat ditampilkan. Silakan coba lagi beberapa saat lagi.",
    undefined,
    {
      fields: result.error.issues.map((issue) => issue.path.join(".")),
    },
  );
}

export const dataResponse = <T>(schema: z.ZodType<T>) =>
  z.object({ data: schema });
export const pageResponse = <T>(schema: z.ZodType<T>) =>
  z.object({
    data: z.array(schema),
    meta: z
      .object({
        page: z.number().int().positive(),
        // Backend mengirim limit 0 untuk daftar kosong (misalnya organizer yang belum punya acara).
        limit: z.number().int().nonnegative(),
        total: z.number().int().nonnegative(),
      })
      .passthrough(),
  });
