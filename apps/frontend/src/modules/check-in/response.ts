import { z } from "zod";
import { pageResponse } from "@/lib/api/response";
const id = z.string().min(1);
const date = z.string().datetime({ offset: true });
export const lookupResponse = z.object({
  ticketId: id,
  ticketCode: id,
  attendeeName: z.string(),
  ticketTypeName: z.string(),
  checkInStatus: z.enum(["unused", "used", "cancelled"]),
  checkedInAt: date.nullable(),
});
export const checkInResponse = z.object({
  ticketId: id,
  ticketCode: z.string().optional(),
  attendeeName: z.string(),
  ticketTypeName: z.string(),
  checkInStatus: z.literal("used"),
  checkedInAt: date,
  orderTicketIndex: z
    .object({
      position: z.number().int().positive(),
      total: z.number().int().positive(),
    })
    .optional(),
});
export const assignedResponse = pageResponse(
  z.object({
    id,
    title: z.string(),
    startsAt: date,
    venueName: z.string(),
    poster: z.string().optional(),
    checkedIn: z.number().int().nonnegative(),
    paidTickets: z.number().int().nonnegative(),
    scanOpensAt: date,
    scanClosesAt: date,
  }),
);
export const historyResponse = pageResponse(
  z
    .object({
      ticketId: id,
      ticketCode: z.string(),
      attendeeName: z.string(),
      ticketTypeName: z.string(),
      checkedInAt: date,
      checkedInBy: z.object({ id, name: z.string() }).nullable(),
      method: z.enum(["scan", "manual"]).optional(),
      outcome: z.enum(["valid", "rejected"]).optional(),
      reason: z.string().optional(),
    })
    .superRefine((item, context) => {
      if (item.outcome !== "rejected" && !item.ticketCode)
        context.addIssue({
          code: "custom",
          path: ["ticketCode"],
          message: "A successful check-in requires a ticket code",
        });
    }),
).extend({
  meta: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    paidTickets: z.number().int().nonnegative(),
    generatedAt: date,
    historyTotal: z.number().int().nonnegative().optional(),
  }),
});
