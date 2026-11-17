import { ApiError, api, page, wrap, type Paginated } from "@/lib/api/client";
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

/** Acara contoh untuk mencoba pengajuan pengembalian dana: 45 hari dari sekarang, jadi masih sebelum batas. */
const REFUND_DEMO_START = new Date(Date.now() + 45 * 86_400_000);
REFUND_DEMO_START.setUTCHours(13, 0, 0, 0);
export const refundDemoEvent = {
  startsAt: REFUND_DEMO_START.toISOString(),
  endsAt: new Date(REFUND_DEMO_START.getTime() + 3 * 3600_000).toISOString(),
};

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
      id: `tk_gs0${i}`,
      orderId: "ord_gs01",
      orderCode: "GTH-GS01",
      ticketCode: `GTH-GS01-${i ? "8RTW" : "5MNE"}`,
      attendeeName: name,
      ticketTypeName: "Reguler",
      event: ev("malam-eksperimen-gamelan-synth", refundDemoEvent),
    }),
  ),
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
  /**
   * Tiket dari tautan di email e-tiket, tanpa login. Bentuknya sama dengan get.
   * 404 NOT_FOUND bila token tidak dikenal. Mock: token "demo-rafi" berisi tiket Rafi.
   */
  shared: (token: string) =>
    api.get<{ data: TicketDetail }>(`/tickets/shared/${encodeURIComponent(token)}`, {
      mock: () => {
        const ticket = token === "demo-rafi" ? mockTickets.find((t) => t.attendeeName === "Rafi Pratama") : undefined;
        if (!ticket) throw new ApiError(404, "NOT_FOUND", "Tautan e-tiket tidak berlaku.");
        return wrap(ticket);
      },
    }),
  /** Kirim ulang e-tiket ke email peserta. Backend menolak dengan 409 RESEND_UNAVAILABLE bila belum lewat 60 detik. */
  resend: (orderId: string) =>
    api.post<void>(`/orders/${orderId}/tickets/resend`, undefined, { mock: () => undefined }),
};
