import { api, page, wrap, type Paginated } from "@/lib/api/client";
import { FIX } from "@/modules/_mock/fixtures";

import type { TicketDetail, TicketEvent, TicketSummary } from "./types";

export type { CheckInStatus, TicketDetail, TicketEvent, TicketSummary } from "./types";

/**
 * Tiketku dan e-tiket. Pita desain 06 dan 07.
 * GET /tickets dan /tickets/:id sudah ada. Kirim ulang e-tiket belum ada (issue #25 B25).
 */

const card = (slug: string) => FIX.catalog.find((c) => c.slug === slug)!;
const ev = (slug: string, extra: Partial<TicketEvent> = {}): TicketEvent => {
  const c = card(slug);
  return {
    title: c.title,
    slug: c.slug,
    startsAt: c.startsAt,
    endsAt: new Date(new Date(c.startsAt).getTime() + 5 * 3600_000).toISOString(),
    venueName: c.venueName,
    poster: c.poster,
    status: "active",
    organizerUsername: FIX.organizer.username,
    ...extra,
  };
};

const festival: TicketEvent = {
  title: FIX.festival.title,
  slug: FIX.festival.slug,
  startsAt: FIX.festival.startsAt,
  endsAt: FIX.festival.endsAt,
  venueName: FIX.festival.venueName,
  address: FIX.festival.address,
  city: FIX.festival.city,
  poster: FIX.festival.poster,
  status: "active",
  organizerUsername: FIX.organizer.username,
  doorsOpenAt: "2026-11-21T07:30:00Z",
  minAge: 17,
};

type Seed = Omit<TicketDetail, "qrPayload" | "checkedInAt" | "checkInStatus"> & Partial<Pick<TicketDetail, "checkedInAt" | "checkInStatus">>;
const make = (t: Seed): TicketDetail => ({
  checkInStatus: "unused",
  checkedInAt: null,
  ...t,
  qrPayload: `gatherly:v1:mock-${t.ticketCode}`,
});

const mockTickets: TicketDetail[] = [
  ...FIX.order.tickets.map((t, i) =>
    make({
      id: t.id,
      orderId: FIX.order.id,
      orderCode: FIX.order.orderCode,
      ticketCode: t.ticketCode,
      attendeeName: t.attendeeName,
      attendeeEmail: FIX.order.attendees[i]?.email,
      ticketTypeName: "Reguler",
      event: festival,
    }),
  ),
  make({
    id: "tk_kr01",
    orderId: "ord_kr01",
    orderCode: "GTH-KR01",
    ticketCode: "GTH-KR01-7QHD",
    attendeeName: "Aulia Nur Fajri",
    attendeeEmail: FIX.buyer.email,
    ticketTypeName: "Reguler",
    event: ev("keroncong-di-pendopo"),
  }),
  make({
    id: "tk_sa01",
    orderId: "ord_sa01",
    orderCode: "GTH-SA01",
    ticketCode: "GTH-SA01-2KLM",
    attendeeName: "Aulia Nur Fajri",
    ticketTypeName: "Reguler",
    checkInStatus: "used",
    checkedInAt: "2026-10-24T12:12:00Z",
    checkInGate: "Pintu Utara",
    event: ev("senja-akustik-di-kotabaru"),
  }),
  ...["Aulia Nur Fajri", "Rafi Pratama"].map((name, i) =>
    make({
      id: `tk_ws0${i}`,
      orderId: "ord_ws01",
      orderCode: "GTH-WS01",
      ticketCode: `GTH-WS01-0${i}AB`,
      attendeeName: name,
      ticketTypeName: "Reguler",
      checkInStatus: i === 0 ? "used" : "unused",
      checkedInAt: i === 0 ? "2026-10-25T03:20:00Z" : null,
      event: ev("workshop-risograph"),
    }),
  ),
];

export const ticketsApi = {
  list: () => api.get<Paginated<TicketSummary>>("/tickets", { mock: () => page(mockTickets) }),
  get: (id: string) =>
    api.get<{ data: TicketDetail }>(`/tickets/${id}`, {
      mock: () => wrap(mockTickets.find((t) => t.id === id) ?? mockTickets[0]!),
    }),
  /** Pending #25: kirim ulang e-tiket ke email peserta, jeda 60 detik. */
  resend: (orderId: string) =>
    api.post<void>(`/orders/${orderId}/tickets/resend`, undefined, { pending: true, mock: () => undefined }),
};
