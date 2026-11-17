import { z } from "zod";

export const createOrderSchema = z
  .object({
    contactPhone: z.string().trim().max(30).optional(),
    ticketTypeId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid ticket type ID."),
    quantity: z.number().int().min(1).max(4),
    attendees: z
      .array(
        z.object({
          name: z.string().trim().min(2).max(100),
          email: z.string().trim().email().max(254).optional(),
          phone: z.string().trim().max(30).optional(),
          birthDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        }),
      )
      .min(1)
      .max(4),
  })
  .superRefine((value, context) => {
    if (value.attendees.length !== value.quantity) {
      context.addIssue({
        code: "custom",
        path: ["attendees"],
        message: "The attendee count must match the ticket quantity.",
      });
    }
  });

export const idempotencyKeySchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
