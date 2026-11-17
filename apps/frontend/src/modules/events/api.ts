import { api, page, wrap, type Paginated } from "@/lib/api/client";
import { FIX } from "@/modules/_mock/fixtures";

import { CATEGORIES, categorySlug } from "./categories";
import type { CityOption, EventCard, EventDetail, EventQuery, EventSuggestions, OrganizerProfile, ReportInput } from "./types";

/**
 * Acara publik di gatherly.xyz. Pita desain 03, 04, 08, 09.
 * Semua masih pending: katalog publik (issue #3 B10), disimpan dan profil (B37), laporan (B40).
 */

const pending = {} as const;

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
  minAge: 17,
  status: "on_sale",
  saved: true,
  highlight: "almost_sold_out",
  organizer: {
    username: FIX.organizer.username,
    name: FIX.organizer.name,
    eventCount: FIX.organizer.eventCount,
    since: FIX.organizer.since,
    description: FIX.organizer.description,
  },
};

/** Kota tiap acara contoh. Yang tidak tercantum ada di Kota Yogyakarta. */
const MOCK_CITY: Record<string, string> = {
  "festival-jazz-di-sawah": "Kabupaten Sleman",
  "keroncong-di-pendopo": "Kabupaten Bantul",
  "panggung-halaman-rumah-8": "Kabupaten Bantul",
};
const cityOf = (c: EventCard) => MOCK_CITY[c.slug] ?? "Kota Yogyakarta";

function mockCities(): CityOption[] {
  const counts = new Map<string, number>();
  for (const c of cards) if (!PAST(c)) counts.set(cityOf(c), (counts.get(cityOf(c)) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Mock katalog: hanya acara yang belum lewat. Filter tanggal dan area diabaikan di mock. */
function filterCards(query: EventQuery) {
  const list = cards.filter((c) => {
    if (PAST(c)) return false;
    if (query.q && !c.title.toLowerCase().includes(query.q.toLowerCase())) return false;
    if (query.category && categorySlug(c.category) !== query.category) return false;
    if (query.city && cityOf(c).toLowerCase() !== query.city.toLowerCase()) return false;
    if (query.minPrice !== undefined && (c.startingPrice ?? 0) < query.minPrice) return false;
    if (query.maxPrice !== undefined && (c.startingPrice ?? Infinity) > query.maxPrice) return false;
    return true;
  });
  if (query.sort === "price_asc") list.sort((a, b) => (a.startingPrice ?? Infinity) - (b.startingPrice ?? Infinity));
  else list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return list;
}

function mockList(query: EventQuery) {
  const all = filterCards(query);
  const limit = query.limit ?? 20;
  const pageNo = query.page ?? 1;
  return { data: all.slice(0, pageNo * limit), meta: { page: pageNo, limit, total: all.length } };
}

function mockSuggest(q: string): EventSuggestions {
  const term = q.trim().toLowerCase();
  const events = filterCards({ q: term }).slice(0, 2);
  const words = new Set<string>([term]);
  for (const c of cards) {
    const title = c.title.toLowerCase();
    if (title.includes(term)) words.add(title.split(" ").slice(0, 3).join(" "));
  }
  return {
    keywords: [...words].slice(0, 3),
    events,
    categories: CATEGORIES.filter((cat) => filterCards({ q: term, category: cat.slug }).length > 0).map((cat) => ({
      ...cat,
      count: filterCards({ q: term, category: cat.slug }).length,
    })),
  };
}

export const eventsApi = {
  list: (query: EventQuery = {}, cookie?: string) =>
    api.get<Paginated<EventCard>>("/events", { query, cookie, ...pending, mock: () => mockList(query) }),
  /** Kota yang punya acara aktif, terbanyak lebih dulu. */
  cities: () => api.get<{ data: CityOption[] }>("/events/cities", { ...pending, mock: () => wrap(mockCities()) }),
  /** Saran kata kunci, acara, dan kategori saat mengetik. */
  suggest: (q: string) =>
    api.get<{ data: EventSuggestions }>("/events/suggestions", { query: { q }, ...pending, mock: () => wrap(mockSuggest(q)) }),
  detail: (slug: string, cookie?: string) =>
    api.get<{ data: EventDetail }>(`/events/${slug}`, { cookie, ...pending, mock: () => wrap({ ...festival, slug }) }),

  saved: () => api.get<Paginated<EventCard>>("/me/saved-events", { mock: () => page(SAVED.map((slug) => cards.find((c) => c.slug === slug)!)) }),
  save: (slug: string) => api.put<void>(`/me/saved-events/${slug}`, undefined, { mock: () => undefined }),
  unsave: (slug: string) => api.delete<void>(`/me/saved-events/${slug}`, { mock: () => undefined }),

  organizerProfile: (username: string, cookie?: string) =>
    api.get<{ data: OrganizerProfile }>(`/organizers/${username}/profile`, {
      cookie,
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
    api.post<void>(`/events/${slug}/reports`, input, { mock: () => undefined }),
};
