import { z } from "zod";
export const profileResponse = z.object({
  logoUrl: z.string().nullable(),
  name: z.string(),
  username: z.string().min(1),
  city: z.string(),
  description: z.string(),
  links: z.array(z.object({ type: z.string(), url: z.string() })),
});
export const bankResponse = z
  .object({
    bank: z.string().min(1),
    // Backend mengirim nomor tersamar (••••1234), bukan nomor lengkap.
    accountNumber: z.string().min(1),
    holderName: z.string().min(1),
  })
  .nullable();
export const payoutsResponse = z.object({
  available: z.number().nonnegative(),
  processing: z.number().nonnegative(),
  transferred: z.number().nonnegative(),
  rows: z.array(
    z.object({
      eventId: z.string().min(1),
      eventTitle: z.string(),
      eventDate: z.string(),
      // Nilai kosong atau tidak valid dari backend dianggap 0 supaya halaman tetap tampil.
      net: z
        .number()
        .nullable()
        .catch(0)
        .transform((v) => Math.max(0, v ?? 0)),
      status: z.enum([
        "waiting_event",
        "available",
        "requested",
        "transferred",
      ]),
      requestedAt: z.string().nullable().optional(),
      transferredAt: z.string().nullable().optional(),
      transferReference: z.string().nullable().optional(),
    }),
  ),
});
