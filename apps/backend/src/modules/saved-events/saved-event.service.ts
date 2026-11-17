import { Types } from "mongoose";
import { AppError } from "../../lib/app-error.js";
import { Event, TicketType } from "../events/event.models.js";
import { Organizer } from "../organizers/organizer.model.js";
import { SavedEvent } from "./saved-event.model.js";
import { publicAssetUrl } from "../storage/storage.service.js";

type CardEvent = {
  _id: Types.ObjectId;
  slug: string;
  title: string;
  category: string;
  startsAt: Date;
  endsAt: Date;
  venueName: string;
  posterAssetId?: string;
  salesClosed: boolean;
  createdAt: Date;
  publicationStatus: string;
};
export async function eventCards(events: CardEvent[], userId?: string, now = new Date()) {
  const ids = events.map((event) => event._id);
  const types = await TicketType.find({ eventId: { $in: ids } }).lean();
  const organizers = await Organizer.find({
    _id: {
      $in: events
        .map((event) => (event as CardEvent & { organizerId?: Types.ObjectId }).organizerId)
        .filter(Boolean),
    },
  })
    .select("status")
    .lean();
  const frozenIds = new Set(
    organizers
      .filter((organizer) => organizer.status === "frozen")
      .map((organizer) => organizer._id.toString()),
  );
  const saved = userId ? await SavedEvent.find({ userId, eventId: { $in: ids } }).lean() : [];
  const savedIds = new Set(saved.map((item) => item.eventId.toString()));
  return Promise.all(
    events.map(async (event) => {
      const all = types.filter((type) => type.eventId.equals(event._id));
      const active = all.filter(
        (type) =>
          type.salesStartsAt <= now &&
          type.salesEndsAt >= now &&
          type.capacity > type.reserved + type.sold &&
          !(type as typeof type & { salesStopped?: boolean }).salesStopped,
      );
      const prices = active.map((type) => type.price);
      const remaining = all.reduce(
        (sum, type) => sum + type.capacity - type.reserved - type.sold,
        0,
      );
      const capacity = all.reduce((sum, type) => sum + type.capacity, 0);
      const frozen = frozenIds.has(
        (event as CardEvent & { organizerId?: Types.ObjectId }).organizerId?.toString() ?? "",
      );
      const status =
        event.publicationStatus === "cancelled"
          ? "cancelled"
          : event.endsAt < now
            ? "ended"
            : event.salesClosed || frozen
              ? "closed"
              : !remaining && all.length
                ? "sold_out"
                : active.length
                  ? "on_sale"
                  : all.some((type) => type.salesStartsAt > now)
                    ? "not_open"
                    : "closed";
      const highlight =
        status === "on_sale" && capacity && remaining / capacity < 0.1
          ? "almost_sold_out"
          : undefined;
      return {
        slug: event.slug,
        title: event.title,
        category: event.category,
        startsAt: event.startsAt,
        venueName: event.venueName,
        poster: (await publicAssetUrl(event.posterAssetId)) ?? "",
        startingPrice: status === "on_sale" && prices.length ? Math.min(...prices) : null,
        saved: savedIds.has(event._id.toString()),
        status,
        ...(highlight ? { highlight } : {}),
      };
    }),
  );
}

export async function saveEvent(userId: string, slug: string) {
  const event = await Event.findOne({ slug, publicationStatus: "published" }).lean();
  if (!event) throw new AppError(404, "NOT_FOUND", "Event was not found.");
  await SavedEvent.updateOne(
    { userId, eventId: event._id },
    { $setOnInsert: { userId, eventId: event._id } },
    { upsert: true },
  );
}

export async function savedEventList(userId: string, page = 1, limit = 20, now = new Date()) {
  const saved = await SavedEvent.find({ userId }).select("eventId").lean();
  const events = await Event.find({
    _id: { $in: saved.map((item) => item.eventId) },
    publicationStatus: { $in: ["published", "cancelled"] },
  }).lean();
  events.sort(
    (a, b) =>
      Number(a.endsAt < now) - Number(b.endsAt < now) ||
      a.startsAt.getTime() - b.startsAt.getTime(),
  );
  return {
    data: await eventCards(events.slice((page - 1) * limit, page * limit), userId, now),
    meta: { page, limit, total: events.length },
  };
}

export async function publicOrganizerProfile(username: string) {
  const organizer = await Organizer.findOne({ username }).lean();
  if (!organizer) throw new AppError(404, "NOT_FOUND", "Organizer was not found.");
  const events = await Event.find({ organizerId: organizer._id, publicationStatus: "published" })
    .sort({ startsAt: 1 })
    .lean();
  const now = new Date();
  return {
    username: organizer.username,
    name: organizer.name,
    city: organizer.city ?? "",
    since: organizer.createdAt.getFullYear(),
    description: organizer.description,
    links: organizer.links ?? [],
    eventCount: events.length,
    upcoming: await eventCards(events.filter((event) => event.endsAt >= now)),
    past: await eventCards(events.filter((event) => event.endsAt < now).reverse()),
  };
}
