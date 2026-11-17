import type { PipelineStage } from "mongoose";
import { z } from "zod";
import { AppError } from "../../lib/app-error.js";
import { Event, TicketType, type TicketTypeDocument } from "../events/event.models.js";
import { Organizer } from "../organizers/organizer.model.js";
import { publicAssetUrl } from "../storage/storage.service.js";
import { SavedEvent } from "../saved-events/saved-event.model.js";
import { eventCards } from "../saved-events/saved-event.service.js";

export const categories = [
  { slug: "musik", name: "Musik" },
  { slug: "lokakarya", name: "Lokakarya" },
  { slug: "olahraga", name: "Olahraga" },
  { slug: "seni-budaya", name: "Seni & Budaya" },
  { slug: "teknologi", name: "Teknologi" },
  { slug: "kuliner", name: "Kuliner" },
  { slug: "komunitas", name: "Komunitas" },
];
export const publicEventQuery = z
  .object({
    q: z.string().trim().max(100).optional(),
    category: z.string().trim().max(100).optional(),
    minPrice: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().int().min(0).optional(),
    date: z.enum(["today", "tomorrow", "weekend", "week"]).optional(),
    area: z.enum(["campus"]).optional(),
    sort: z.enum(["date_asc", "price_asc"]).default("date_asc"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine(
    (input) =>
      input.minPrice === undefined ||
      input.maxPrice === undefined ||
      input.minPrice <= input.maxPrice,
    { path: ["maxPrice"], message: "Maximum price must not be lower than minimum price." },
  );

function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Public discovery date chips use WIB, matching the default site display timezone.
export function publicDateRange(choice: "today" | "tomorrow" | "weekend" | "week", now: Date) {
  const offset = 7 * 3600_000;
  const local = new Date(now.getTime() + offset);
  const dayStart =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offset;
  const weekday = local.getUTCDay();
  if (choice === "today") return { from: new Date(dayStart), to: new Date(dayStart + 86_400_000) };
  if (choice === "tomorrow")
    return { from: new Date(dayStart + 86_400_000), to: new Date(dayStart + 2 * 86_400_000) };
  const monday = dayStart - ((weekday + 6) % 7) * 86_400_000;
  if (choice === "week") return { from: new Date(dayStart), to: new Date(monday + 7 * 86_400_000) };
  return {
    from: new Date(weekday === 0 ? dayStart : monday + 5 * 86_400_000),
    to: new Date(monday + 7 * 86_400_000),
  };
}

export async function publicEventList(
  query: z.input<typeof publicEventQuery>,
  userId?: string,
  now = new Date(),
) {
  const result = publicEventQuery.safeParse(query);
  if (!result.success) throw new AppError(400, "VALIDATION_ERROR", "Please check event filters.");
  const input = result.data;
  const category = categories.find((item) => item.slug === input.category)?.name ?? input.category;
  const match: Record<string, unknown> = { publicationStatus: "published", endsAt: { $gte: now } };
  if (input.q)
    match.$or = ["title", "description", "venueName", "city"].map((field) => ({
      [field]: { $regex: escaped(input.q!), $options: "i" },
    }));
  if (category) match.category = { $regex: `^${escaped(category)}$`, $options: "i" };
  if (input.date) {
    const range = publicDateRange(input.date, now);
    match.startsAt = { $gte: range.from, $lt: range.to };
  }
  if (input.area)
    match.$and = [
      {
        $or: ["venueName", "address", "title"].map((field) => ({
          [field]: { $regex: "kampus|universitas|university|politeknik|institut", $options: "i" },
        })),
      },
    ];
  const ticketMatch: Record<string, unknown> = {
    salesStartsAt: { $lte: now },
    salesEndsAt: { $gt: now },
    salesStopped: { $ne: true },
    $expr: {
      $and: [
        { $eq: ["$eventId", "$$eventId"] },
        { $gt: [{ $subtract: ["$capacity", { $add: ["$reserved", "$sold"] }] }, 0] },
      ],
    },
  };
  const pipeline: PipelineStage[] = [
    { $match: match },
    {
      $lookup: {
        from: Organizer.collection.name,
        localField: "organizerId",
        foreignField: "_id",
        as: "organizer",
      },
    },
    { $match: { "organizer.0": { $exists: true }, "organizer.status": { $ne: "frozen" } } },
    {
      $lookup: {
        from: TicketType.collection.name,
        let: { eventId: "$_id" },
        pipeline: [{ $match: ticketMatch }, { $project: { price: 1 } }],
        as: "activeTypes",
      },
    },
    {
      $addFields: {
        priceSort: { $ifNull: [{ $min: "$activeTypes.price" }, Number.MAX_SAFE_INTEGER] },
      },
    },
  ];
  if (input.minPrice !== undefined || input.maxPrice !== undefined) {
    pipeline.push({
      $match: {
        salesClosed: false,
        activeTypes: {
          $elemMatch: {
            price: {
              ...(input.minPrice !== undefined ? { $gte: input.minPrice } : {}),
              ...(input.maxPrice !== undefined ? { $lte: input.maxPrice } : {}),
            },
          },
        },
      },
    });
  }
  pipeline.push(
    {
      $sort:
        input.sort === "price_asc"
          ? { priceSort: 1, startsAt: 1, _id: 1 }
          : { startsAt: 1, _id: 1 },
    },
    {
      $facet: {
        items: [
          { $skip: (input.page - 1) * input.limit },
          { $limit: input.limit },
          { $project: { organizer: 0, activeTypes: 0, priceSort: 0 } },
        ],
        count: [{ $count: "total" }],
      },
    },
  );
  const [page] = await Event.aggregate(pipeline);
  return {
    data: await eventCards(page?.items ?? [], userId, now),
    meta: { page: input.page, limit: input.limit, total: page?.count[0]?.total ?? 0 },
  };
}

export function ticketSaleStatus(type: TicketTypeDocument, closed: boolean, now: Date) {
  if (closed || type.salesEndsAt <= now) return "closed";
  if (type.salesStopped) return "stopped";
  if (type.salesStartsAt > now) return "not_open";
  return type.capacity - type.reserved - type.sold <= 0 ? "sold_out" : "on_sale";
}

export async function publicEventDetail(slug: string, userId?: string, now = new Date()) {
  const event = await Event.findOne({
    slug,
    publicationStatus: { $in: ["published", "cancelled"] },
  }).lean();
  if (!event) throw new AppError(404, "NOT_FOUND", "Event was not found.");
  const organizer = await Organizer.findById(event.organizerId).lean();
  if (!organizer) throw new AppError(404, "NOT_FOUND", "Event was not found.");
  const types = await TicketType.find({ eventId: event._id }).sort({ price: 1, _id: 1 }).lean();
  const closed =
    event.salesClosed ||
    organizer.status === "frozen" ||
    event.publicationStatus === "cancelled" ||
    event.endsAt < now;
  const [card] = await eventCards([event], userId, now);
  const eventCount = await Event.countDocuments({
    organizerId: organizer._id,
    publicationStatus: "published",
  });
  return {
    ...card,
    id: event._id.toString(),
    endsAt: event.endsAt,
    timezone: event.timezone,
    address: event.address,
    city: event.city,
    description: event.description,
    performerLabel: event.performerLabel ?? "Performers",
    terms: event.terms ?? [],
    performers: await Promise.all(
      (event.performers ?? []).map(async (performer) => ({
        name: performer.name,
        note: performer.note ?? "",
        time: performer.time ?? "",
        photo: performer.photoAssetId
          ? ((await publicAssetUrl(performer.photoAssetId)) ?? "")
          : (performer.photoUrl ?? ""),
      })),
    ),
    ticketTypes: types.map((type) => ({
      id: type._id.toString(),
      name: type.name,
      description: type.description,
      price: type.price,
      ...(event.showRemaining === false
        ? {}
        : { remaining: type.capacity - type.reserved - type.sold }),
      salesStartsAt: type.salesStartsAt,
      salesEndsAt: type.salesEndsAt,
      status: ticketSaleStatus(type, closed, now),
    })),
    maxPerOrder: 4,
    ...(event.publicationStatus === "cancelled" ? { cancelReason: event.cancellationReason } : {}),
    organizer: {
      username: organizer.username ?? organizer._id.toString(),
      name: organizer.name,
      eventCount,
      since: organizer.createdAt.getFullYear(),
      description: organizer.description,
    },
  };
}

export async function publicSuggestions(q: string, userId?: string) {
  if (!q.trim()) return { keywords: [], events: [], categories: [] };
  const result = await publicEventList({ q, limit: 5 }, userId);
  const suggestedCategories = await Promise.all(
    categories.map(async (category) => {
      const list = await publicEventList({ q, category: category.slug, limit: 1 });
      return { ...category, count: list.meta.total };
    }),
  );
  return {
    keywords: [...new Set(result.data.map((item) => item.title))].slice(0, 3),
    events: result.data.map(({ slug, title, startsAt, venueName, poster }) => ({
      slug,
      title,
      startsAt,
      venueName,
      poster,
    })),
    categories: suggestedCategories.filter((category) => category.count > 0),
  };
}
