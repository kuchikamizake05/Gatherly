import { z } from "zod";

const id = z.string().min(1);
const count = z.number().int().nonnegative();
const date = z.string().datetime({ offset: true });
const status = z.enum(["draft", "scheduled", "on_sale", "ended", "cancelled"]);
export const summaryResponse = z
  .object({
    publishedEvents: count,
    paidTickets: count,
    grossPaidSales: count,
    period: z.object({
      from: date.nullable(),
      to: date.nullable(),
      basis: z.literal("paidAt"),
    }),
    generatedAt: date,
    changePercent: z.number().optional(),
    pendingOrders: count.optional(),
    attendanceRate: z.number().min(0).max(100).optional(),
    dailySales: z.array(z.object({ date, amount: count })).optional(),
  })
  .passthrough();
export const eventSummaryResponse = z
  .object({
    capacity: count,
    reserved: count,
    sold: count,
    available: count,
    checkedIn: count,
    grossPaidSales: count,
    netSales: count.optional(),
    pendingOrders: count.optional(),
    perTicketType: z
      .array(z.object({ id, name: z.string(), sold: count, capacity: count }))
      .optional(),
  })
  .passthrough();
export const eventRowResponse = z
  .object({
    id,
    title: z.string(),
    startsAt: date.nullable(),
    venueName: z.string().nullable(),
    poster: z.string().nullable().optional(),
    sold: count,
    capacity: count,
    gross: count,
    status,
  })
  .passthrough();
export const eventResponse = z
  .object({
    id,
    slug: z.string(),
    title: z.string(),
    category: z.string(),
    description: z.string(),
    posterAssetId: z.string().nullable().optional(),
    posterUrl: z.string().nullable().optional(),
    startsAt: z.union([date, z.literal("")]),
    endsAt: z.union([date, z.literal("")]),
    timezone: z.enum(["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"]),
    locationType: z.enum(["offline", "online"]),
    venueName: z.string(),
    address: z.string(),
    city: z.string(),
    province: z.string().optional(),
    postalCode: z.string().optional(),
    publicationStatus: z.enum(["draft", "published"]),
    status,
    salesClosed: z.boolean(),
    updatedAt: date,
    terms: z.array(z.string()).optional(),
    performerLabel: z.string().optional(),
    showRemaining: z.boolean().optional(),
    performers: z
      .array(
        z.object({
          name: z.string(),
          note: z.string(),
          time: z.string(),
          photoAssetId: z.string().nullable().optional(),
          photoUrl: z.string().nullable().optional(),
        }),
      )
      .optional(),
    ticketTypes: z.array(
      z.object({
        id,
        name: z.string(),
        description: z.string().optional(),
        price: count,
        capacity: count,
        sold: count,
        reserved: count,
        salesStartsAt: date,
        salesEndsAt: date,
        salesStopped: z.boolean(),
      }),
    ),
  })
  .passthrough();
export const orderRowResponse = z
  .object({
    id,
    orderCode: z.string(),
    buyer: z.object({ name: z.string(), email: z.string() }),
    ticketTypeName: z.string().optional(),
    ticketType: z.object({ name: z.string() }).passthrough().optional(),
    quantity: count,
    totalAmount: count,
    createdAt: date,
    paymentStatus: z.enum([
      "pending",
      "paid",
      "failed",
      "expired",
      "refunded",
      "partially_refunded",
    ]),
  })
  .passthrough()
  .refine(
    (order) => !!order.ticketTypeName || !!order.ticketType?.name,
    "Ticket type is required",
  );
export const orderDetailResponse = orderRowResponse.safeExtend({
  unitPrice: count,
  paidAt: date.nullable(),
  paymentMethod: z.string().optional(),
  attendees: z.array(
    z.object({ name: z.string(), email: z.string().optional() }),
  ),
  timeline: z.array(z.object({ status: z.string(), at: date })),
  tickets: z.array(
    z.object({
      id,
      ticketCode: z.string(),
      attendeeName: z.string(),
      checkInStatus: z.enum(["unused", "used", "cancelled"]),
      checkedInAt: date.nullable(),
    }),
  ),
});
export const attendeeResponse = z
  .object({
    ticketId: id,
    attendeeName: z.string(),
    ticketCode: z.string(),
    ticketTypeName: z.string(),
    buyerEmail: z.string().optional(),
    checkInStatus: z.enum(["unused", "used", "cancelled"]),
    checkedInAt: date.nullable(),
  })
  .passthrough();

export const assetResponse = z.object({
  assetId: z.string().min(1),
  url: z
    .string()
    .min(1)
    .refine((value) => {
      if (/[\\\u0000-\u001f]/.test(value)) return false;
      if (value.startsWith("/") && !value.startsWith("//")) return true;
      if (/^data:image\/(png|jpeg|webp);base64,/.test(value)) return true;
      try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
      } catch {
        return false;
      }
    }),
});
