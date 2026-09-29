import { z } from "zod";

const isoDate = z.string().datetime({ offset: true }).transform((value) => new Date(value));
const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
};

export const organizerSummaryQuerySchema = z
  .object({ from: isoDate.optional(), to: isoDate.optional() })
  .refine((value) => !value.from || !value.to || value.from < value.to, {
    message: "from must be earlier than to.",
    path: ["from"],
  });

export const organizerOrderQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  paymentStatus: z.enum(["pending", "paid", "failed", "expired"]).optional(),
  ...pagination,
});

export const organizerAttendeeQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  checkInStatus: z.enum(["unused", "used"]).optional(),
  ...pagination,
});

export type OrganizerSummaryQuery = z.infer<typeof organizerSummaryQuerySchema>;
export type OrganizerOrderQuery = z.infer<typeof organizerOrderQuerySchema>;
export type OrganizerAttendeeQuery = z.infer<typeof organizerAttendeeQuerySchema>;
