import { api, page, wrap, type Paginated } from "@/lib/api/client";
import { FIX } from "@/modules/_mock/fixtures";

import type {
  AttendeeRow,
  CommitteeAssignment,
  EventInput,
  OrgEvent,
  OrgEventRow,
  OrgEventSummary,
  OrgOrderDetail,
  OrgOrderRow,
  OrgSummary,
  RefundInput,
  TicketTypeInput,
} from "./types";

/**
 * Dashboard, buat dan ubah acara, kelola acara. Pita desain 15, 16, 17.
 * Sudah ada di backend: ringkasan, CRUD acara, publish, jenis tiket, ringkasan acara,
 * pesanan, detail pesanan, peserta, penugasan panitia.
 * Pending: batalkan dan duplikat acara, hentikan penjualan, poster (B33), refund (B35).
 */

const pending = { pending: true } as const;
const base = "/organizer/events";

const mockEvent: OrgEvent = {
  id: FIX.festival.id,
  slug: FIX.festival.slug,
  title: FIX.festival.title,
  category: FIX.festival.category,
  description: FIX.festival.description,
  posterUrl: FIX.festival.poster,
  startsAt: FIX.festival.startsAt,
  endsAt: FIX.festival.endsAt,
  timezone: FIX.festival.timezone,
  locationType: "offline",
  venueName: FIX.festival.venueName,
  address: FIX.festival.address,
  city: FIX.festival.city,
  terms: FIX.festival.terms,
  performerLabel: FIX.festival.performerLabel,
  performers: FIX.festival.performers.map((p) => ({ name: p.name, note: p.note, time: p.time, photoUrl: p.photo })),
  showRemaining: true,
  publicationStatus: "published",
  status: "on_sale",
  salesClosed: false,
  updatedAt: "2026-11-14T03:42:00Z",
  ticketTypes: FIX.festival.ticketTypes.map((t) => ({
    id: t.id,
    name: t.name,
    price: t.price,
    capacity: t.capacity,
    sold: t.sold,
    reserved: 0,
    salesStartsAt: t.salesStartsAt,
    salesEndsAt: t.salesEndsAt,
    salesStopped: false,
  })),
};

const mockOrders: OrgOrderRow[] = [
  { id: "o1", orderCode: "GTH-7Q4K", buyer: { name: "Galih Prasetyo", email: "galih.p@gmail.com" }, ticketTypeName: "Reguler", quantity: 2, totalAmount: 200000, paymentStatus: "paid", createdAt: "2026-11-14T03:12:00Z" },
  { id: "o2", orderCode: "GTH-8B2M", buyer: { name: "Bima Saputra", email: "bima.s@gmail.com" }, ticketTypeName: "Reguler", quantity: 1, totalAmount: 100000, paymentStatus: "paid", createdAt: "2026-11-14T02:45:00Z" },
  { id: "o3", orderCode: "GTH-3C9P", buyer: { name: "Citra Lestari", email: "citra.l@gmail.com" }, ticketTypeName: "Reguler", quantity: 3, totalAmount: 300000, paymentStatus: "pending", createdAt: "2026-11-14T02:10:00Z" },
  { id: "o4", orderCode: "GTH-5D1R", buyer: { name: "Dimas Ardi", email: "dimas.ardi@gmail.com" }, ticketTypeName: "Presale", quantity: 2, totalAmount: 160000, paymentStatus: "refunded", createdAt: "2026-10-06T13:31:00Z" },
];

export const organizerEventsApi = {
  summary: (from?: string, to?: string) =>
    api.get<{ data: OrgSummary }>("/organizer/summary", {
      query: { from, to },
      mock: () =>
        wrap({
          publishedEvents: 4,
          paidTickets: 412,
          grossPaidSales: 12450000,
          changePercent: 18,
          pendingOrders: 3,
          attendanceRate: 87,
          period: { from: from ?? null, to: to ?? null, basis: "paidAt" as const },
          generatedAt: new Date().toISOString(),
        }),
    }),

  list: (status?: string) =>
    api.get<Paginated<OrgEventRow>>(base, {
      query: { status },
      mock: () => page(FIX.orgEvents.filter((e) => !status || e.status === status || (status === "running" && e.status !== "draft"))),
    }),
  get: (id: string) => api.get<{ data: OrgEvent }>(`${base}/${id}`, { mock: () => wrap({ ...mockEvent, id }) }),
  create: (input: Partial<EventInput>) =>
    api.post<{ data: OrgEvent }>(base, input, { mock: () => wrap({ ...mockEvent, ...input, id: "ev_new", publicationStatus: "draft" as const, status: "draft" as const }) }),
  update: (id: string, input: Partial<EventInput>) =>
    api.patch<{ data: OrgEvent }>(`${base}/${id}`, input, { mock: () => wrap({ ...mockEvent, ...input, id }) }),
  remove: (id: string) => api.delete<void>(`${base}/${id}`, { mock: () => undefined }),
  publish: (id: string) => api.post<{ data: OrgEvent }>(`${base}/${id}/publish`, undefined, { mock: () => wrap(mockEvent) }),

  addTicketType: (id: string, input: TicketTypeInput) =>
    api.post<{ data: OrgEvent["ticketTypes"][number] }>(`${base}/${id}/ticket-types`, input, {
      mock: () => wrap({ ...input, id: "tt_new", sold: 0, reserved: 0, salesStopped: false }),
    }),
  updateTicketType: (id: string, typeId: string, input: Partial<TicketTypeInput>) =>
    api.patch<void>(`${base}/${id}/ticket-types/${typeId}`, input, { mock: () => undefined }),
  removeTicketType: (id: string, typeId: string) =>
    api.delete<void>(`${base}/${id}/ticket-types/${typeId}`, { mock: () => undefined }),

  eventSummary: (id: string) =>
    api.get<{ data: OrgEventSummary }>(`${base}/${id}/summary`, {
      mock: () =>
        wrap({
          capacity: 250, reserved: 3, sold: 168, available: 79, checkedIn: 0,
          grossPaidSales: 16800000, netSales: 15960000, pendingOrders: 3,
          perTicketType: [
            { id: "tt_presale", name: "Presale", sold: 50, capacity: 50 },
            { id: "tt_reguler", name: "Reguler", sold: 118, capacity: 200 },
          ],
        }),
    }),
  orders: (id: string, params: { q?: string; paymentStatus?: string; page?: number } = {}) =>
    api.get<Paginated<OrgOrderRow>>(`${base}/${id}/orders`, { query: params, mock: () => page(mockOrders) }),
  order: (id: string, orderId: string) =>
    api.get<{ data: OrgOrderDetail }>(`${base}/${id}/orders/${orderId}`, {
      mock: () =>
        wrap({
          ...mockOrders[0]!,
          attendees: [{ name: "Galih Prasetyo" }, { name: "Sekar Ayu" }],
          unitPrice: 100000,
          paidAt: "2026-11-14T03:12:00Z",
          paymentMethod: "QRIS",
          timeline: [
            { status: "pending", at: "2026-11-14T03:09:00Z" },
            { status: "paid", at: "2026-11-14T03:12:00Z" },
          ],
          tickets: [
            { id: "t1", ticketCode: "GTH-7Q4K-29XM", attendeeName: "Galih Prasetyo", checkInStatus: "unused" as const, checkedInAt: null },
            { id: "t2", ticketCode: "GTH-7Q4K-31PL", attendeeName: "Sekar Ayu", checkInStatus: "unused" as const, checkedInAt: null },
          ],
        }),
    }),
  attendees: (id: string, params: { q?: string; checkInStatus?: string; page?: number } = {}) =>
    api.get<Paginated<AttendeeRow>>(`${base}/${id}/attendees`, {
      query: params,
      mock: () =>
        page([
          { ticketId: "t3", attendeeName: "Bima Saputra", buyerEmail: "bima.s@gmail.com", ticketTypeName: "Reguler", ticketCode: "GTH-8B2M-11QA", checkInStatus: "unused" as const, checkedInAt: null },
          { ticketId: "t4", attendeeName: "Gita Anjani", buyerEmail: "gita.anj@gmail.com", ticketTypeName: "Reguler", ticketCode: "GTH-1G8H-77RT", checkInStatus: "unused" as const, checkedInAt: null },
        ]),
    }),
  /** Unduh CSV pesanan atau peserta. Pending: endpoint ekspor. */
  exportCsvUrl: (id: string, kind: "orders" | "attendees") => `/api/v1${base}/${id}/${kind}.csv`,

  committee: (id: string) =>
    api.get<{ data: CommitteeAssignment[] }>(`${base}/${id}/committee`, {
      mock: () =>
        wrap([
          { userId: "c_dimas", name: "Dimas Satria", username: "dimas.sawah", assignedAt: "2026-11-12T03:02:00Z" },
          { userId: "c_nisa", name: "Nisa Rahmawati", username: "nisa.sawah", assignedAt: "2026-11-12T03:02:00Z" },
        ]),
    }),
  /** Pending B28/B17: penugasan memakai akun panitia (username), bukan email peserta. */
  assignCommittee: (id: string, memberIds: string[]) =>
    api.post<void>(`${base}/${id}/committee`, { memberIds }, { ...pending, mock: () => undefined }),
  revokeCommittee: (id: string, userId: string) =>
    api.delete<void>(`${base}/${id}/committee/${userId}`, { mock: () => undefined }),

  // Pending B33
  uploadPoster: (file: Blob) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<{ data: { assetId: string; url: string } }>("/organizer/posters", form, {
      ...pending,
      mock: () => wrap({ assetId: "asset_mock", url: FIX.festival.poster }),
    });
  },
  setTicketSales: (id: string, typeId: string, stopped: boolean) =>
    api.post<void>(`${base}/${id}/ticket-types/${typeId}/${stopped ? "stop" : "resume"}`, undefined, { ...pending, mock: () => undefined }),
  cancelEvent: (id: string, confirmTitle: string, reason: string) =>
    api.post<void>(`${base}/${id}/cancel`, { confirmTitle, reason }, { ...pending, mock: () => undefined }),
  duplicate: (id: string) =>
    api.post<{ data: { id: string } }>(`${base}/${id}/duplicate`, undefined, { ...pending, mock: () => wrap({ id: "ev_copy" }) }),

  // Pending B35
  refund: (id: string, orderId: string, input: RefundInput) =>
    api.post<void>(`${base}/${id}/orders/${orderId}/refunds`, input, { ...pending, mock: () => undefined }),
};
