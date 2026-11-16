import { api, page, wrap, type Paginated } from "@/lib/api/client";
import { FIX } from "@/modules/_mock/fixtures";

/**
 * Tiketku dan e-tiket. Pita desain 06 dan 07.
 * GET /tickets dan /tickets/:id sudah ada. Kirim ulang e-tiket belum ada (issue #25 B25).
 */

export type CheckInStatus = "unused" | "used" | "cancelled";

export type TicketSummary = {
  id: string;
  orderId: string;
  orderCode: string;
  ticketCode: string;
  attendeeName: string;
  ticketTypeName: string;
  checkInStatus: CheckInStatus;
  event: { title: string; slug: string; startsAt: string; venueName: string; poster?: string };
};

export type TicketDetail = TicketSummary & {
  /** Format gatherly:v1:<token>. Dirender jadi QR, bukan URL. */
  qrPayload: string;
  checkedInAt: string | null;
  attendeeEmail?: string;
};

const mockTickets: TicketDetail[] = FIX.order.tickets.map((t, i) => ({
  id: t.id,
  orderId: FIX.order.id,
  orderCode: FIX.order.orderCode,
  ticketCode: t.ticketCode,
  attendeeName: t.attendeeName,
  attendeeEmail: FIX.order.attendees[i]?.email,
  ticketTypeName: "Reguler",
  checkInStatus: "unused",
  checkedInAt: null,
  qrPayload: `gatherly:v1:mock-${t.ticketCode}`,
  event: {
    title: FIX.festival.title,
    slug: FIX.festival.slug,
    startsAt: FIX.festival.startsAt,
    venueName: FIX.festival.venueName,
    poster: FIX.festival.poster,
  },
}));

export const ticketsApi = {
  list: () => api.get<Paginated<TicketSummary>>("/tickets", { mock: () => page(mockTickets) }),
  get: (id: string) =>
    api.get<{ data: TicketDetail }>(`/tickets/${id}`, {
      mock: () => wrap(mockTickets.find((t) => t.id === id) ?? mockTickets[0]!),
    }),
  /** Pending #25: kirim ulang e-tiket, jeda 60 detik. */
  resend: (orderId: string) =>
    api.post<void>(`/orders/${orderId}/tickets/resend`, undefined, { pending: true, mock: () => undefined }),
};
