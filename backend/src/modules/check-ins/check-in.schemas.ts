import { z } from "zod";

const qrPayload = z.string().regex(
  /^gatherly:v1:[A-Za-z0-9_-]{43}$/,
  "QR payload has an invalid format.",
);

export const checkInSchema = z
  .object({
    qrPayload: qrPayload.optional(),
    ticketCode: z.string().trim().min(1).max(40).optional(),
  })
  .strict()
  .refine((value) => Number(Boolean(value.qrPayload)) + Number(Boolean(value.ticketCode)) === 1, {
    message: "Provide exactly one QR payload or ticket code.",
    path: ["credential"],
  });

export const committeeTicketQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const checkInHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CheckInInput = z.infer<typeof checkInSchema>;
