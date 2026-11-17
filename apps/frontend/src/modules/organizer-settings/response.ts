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
    accountNumber: z.string().regex(/^\d{10,16}$/),
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
      eventDate: z.string().datetime({ offset: true }),
      net: z.number().nonnegative(),
      status: z.enum([
        "waiting_event",
        "available",
        "requested",
        "transferred",
      ]),
      requestedAt: z.string().nullable().optional(),
      transferredAt: z
        .string()
        .datetime({ offset: true })
        .nullable()
        .optional(),
      transferReference: z.string().nullable().optional(),
    }),
  ),
});
