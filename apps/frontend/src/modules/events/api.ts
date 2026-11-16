import { api, page, wrap, type Paginated } from "@/lib/api/client";
import { FIX } from "@/modules/_mock/fixtures";

import type { EventCard, EventDetail, EventQuery, OrganizerProfile, ReportInput } from "./types";

/**
 * Acara publik di gatherly.xyz. Pita desain 03, 04, 08, 09.
 * Semua masih pending: katalog publik (issue #3 B10), disimpan dan profil (B37), laporan (B40).
 */

const pending = { pending: true } as const;

const SAVED = ["festival-jazz-di-sawah", "pameran-foto-kampung-kota", "keroncong-di-pendopo", "bazar-buku-bekas-zine", "workshop-risograph", "senja-akustik-di-kotabaru"];
const PAST = (c: EventCard) => new Date(c.startsAt).getTime() < Date.now();

const cards: EventCard[] = FIX.catalog.map((e) => {
  const card: EventCard = { ...e, saved: SAVED.includes(e.slug) };
  if (e.slug === "festival-jazz-di-sawah") card.highlight = "almost_sold_out";
  if (PAST(card)) card.status = "ended";
  return card;
});

const festival: EventDetail = {
  id: FIX.festival.id,
  slug: FIX.festival.slug,
  title: FIX.festival.title,
  category: FIX.festival.category,
  poster: FIX.festival.poster,
  startsAt: FIX.festival.startsAt,
  endsAt: FIX.festival.endsAt,
  timezone: FIX.festival.timezone,
  venueName: FIX.festival.venueName,
  address: FIX.festival.address,
  city: FIX.festival.city,
  description: FIX.festival.description,
  performerLabel: FIX.festival.performerLabel,
  performers: FIX.festival.performers,
  terms: FIX.festival.terms,
  ticketTypes: FIX.festival.ticketTypes.map((t) => ({
    id: t.id,
    name: t.name,
    price: t.price,
    remaining: t.capacity - t.sold,
    salesStartsAt: t.salesStartsAt,
    salesEndsAt: t.salesEndsAt,
    status: t.status,
  })),
  maxPerOrder: FIX.festival.maxPerOrder,
  status: "on_sale",
  saved: true,
  organizer: {
    username: FIX.organizer.username,
    name: FIX.organizer.name,
    eventCount: FIX.organizer.eventCount,
    since: FIX.organizer.since,
  },
};

function filterCards(query: EventQuery) {
  return cards.filter((c) => {
    if (query.q && !c.title.toLowerCase().includes(query.q.toLowerCase())) return false;
    if (query.category && c.category.toLowerCase() !== query.category.toLowerCase()) return false;
    if (query.minPrice !== undefined && (c.startingPrice ?? 0) < query.minPrice) return false;
    if (query.maxPrice !== undefined && (c.startingPrice ?? 0) > query.maxPrice) return false;
    return true;
  });
}

export const eventsApi = {
  list: (query: EventQuery = {}, cookie?: string) =>
    api.get<Paginated<EventCard>>("/events", { query, cookie, ...pending, mock: () => page(filterCards(query)) }),
  detail: (slug: string, cookie?: string) =>
    api.get<{ data: EventDetail }>(`/events/${slug}`, { cookie, ...pending, mock: () => wrap({ ...festival, slug }) }),

  saved: () => api.get<Paginated<EventCard>>("/me/saved-events", { ...pending, mock: () => page(SAVED.map((slug) => cards.find((c) => c.slug === slug)!)) }),
  save: (slug: string) => api.put<void>(`/me/saved-events/${slug}`, undefined, { ...pending, mock: () => undefined }),
  unsave: (slug: string) => api.delete<void>(`/me/saved-events/${slug}`, { ...pending, mock: () => undefined }),

  organizerProfile: (username: string, cookie?: string) =>
    api.get<{ data: OrganizerProfile }>(`/organizers/${username}/profile`, {
      cookie,
      ...pending,
      mock: () =>
        wrap({
          username,
          name: FIX.organizer.name,
          city: FIX.organizer.city,
          since: FIX.organizer.since,
          description: FIX.organizer.description,
          links: FIX.organizer.links,
          eventCount: FIX.organizer.eventCount,
          upcoming: ["festival-jazz-di-sawah", "keroncong-di-pendopo", "malam-eksperimen-gamelan-synth", "panggung-halaman-rumah-8"].map(
            (slug) => cards.find((c) => c.slug === slug)!,
          ),
          past: cards.filter(PAST),
        }),
    }),

  report: (slug: string, input: ReportInput) =>
    api.post<void>(`/events/${slug}/reports`, input, { ...pending, mock: () => undefined }),
};
