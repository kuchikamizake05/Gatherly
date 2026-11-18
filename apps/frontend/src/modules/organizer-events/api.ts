import { dataResponse, pageResponse, readResponse } from "@/lib/api/response";
import {
  assetResponse,
  attendeeResponse,
  summaryResponse,
  eventSummaryResponse,
  eventResponse,
  eventRowResponse,
  orderRowResponse,
  orderDetailResponse,
} from "./response";
import {
  api,
  ApiError,
  page,
  wrap,
  upload,
  type Paginated,
} from "@/lib/api/client";
import { mockAssignments } from "@/modules/team/mock-assignments";
import { FIX } from "@/modules/_mock/fixtures";
import { readMock, writeMock } from "@/modules/_mock/store";

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

const pending = {} as const;
const base = "/organizer/events";

const mockEvent: OrgEvent = {
  id: FIX.festival.id,
  slug: FIX.festival.slug,
  title: FIX.festival.title,
  posterAssetId: "asset_festival",
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
  performers: FIX.festival.performers.map((p) => ({
    name: p.name,
    note: p.note,
    time: p.time,
    photoUrl: p.photo,
  })),
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

function mockGet(id: string, creating = false): OrgEvent {
  const stored = readMock<OrgEvent | null>(`event.${id}`, null);
  if (stored) return stored;
  if (id === FIX.festival.id) return structuredClone(mockEvent);
  const row = FIX.orgEvents.find((event) => event.id === id);
  if (!row && !creating)
    throw new ApiError(404, "NOT_FOUND", "Acara tidak ditemukan.");
  const startsAt = row?.startsAt ?? "";
  const salesStartsAt = startsAt
    ? new Date(Date.parse(startsAt) - 14 * 86400000).toISOString()
    : "";
  return {
    ...mockEvent,
    id,
    slug: id,
    title: row?.title ?? "",
    description: "",
    category: row ? "Musik" : "",
    posterUrl: null,
    posterAssetId: null,
    startsAt,
    endsAt: startsAt
      ? new Date(Date.parse(startsAt) + 7 * 3600000).toISOString()
      : "",
    venueName: row?.venueName ?? "",
    address: "",
    city: "",
    terms: [],
    performers: [],
    publicationStatus: row && row.status !== "draft" ? "published" : "draft",
    status: row?.status ?? "draft",
    ticketTypes: row?.capacity
      ? [
          {
            id: `${id}-reguler`,
            name: "Reguler",
            description: "Tiket masuk acara",
            price: row.sold ? row.gross / row.sold : 50000,
            capacity: row.capacity,
            sold: row.sold,
            reserved: 0,
            salesStartsAt,
            salesEndsAt: startsAt,
            salesStopped: false,
          },
        ]
      : [],
  };
}
const mockSave = (id: string, input: Partial<OrgEvent>) => {
  const previous = mockGet(id, true);
  const event = writeMock(`event.${id}`, {
    ...previous,
    ...input,
    posterUrl: input.posterAssetId
      ? readMock<string | null>(
          `asset.${input.posterAssetId}`,
          previous.posterUrl ?? null,
        )
      : (input.posterUrl ?? previous.posterUrl),
    id,
    updatedAt: new Date().toISOString(),
  });
  writeMock(
    "eventIds",
    Array.from(new Set([...readMock<string[]>("eventIds", []), id])),
  );
  return event;
};

const mockOrders: OrgOrderRow[] = [
  {
    id: "o1",
    orderCode: "GTH-7Q4K",
    buyer: { name: "Galih Prasetyo", email: "galih.p@gmail.com" },
    ticketTypeName: "Reguler",
    quantity: 2,
    totalAmount: 200000,
    paymentStatus: "paid",
    createdAt: "2026-11-14T03:12:00Z",
  },
  {
    id: "o2",
    orderCode: "GTH-8B2M",
    buyer: { name: "Bima Saputra", email: "bima.s@gmail.com" },
    ticketTypeName: "Reguler",
    quantity: 1,
    totalAmount: 100000,
    paymentStatus: "paid",
    createdAt: "2026-11-14T02:45:00Z",
  },
  {
    id: "o3",
    orderCode: "GTH-3C9P",
    buyer: { name: "Citra Lestari", email: "citra.l@gmail.com" },
    ticketTypeName: "Reguler",
    quantity: 3,
    totalAmount: 300000,
    paymentStatus: "pending",
    createdAt: "2026-11-14T02:10:00Z",
  },
  {
    id: "o4",
    orderCode: "GTH-5D1R",
    buyer: { name: "Dimas Ardi", email: "dimas.ardi@gmail.com" },
    ticketTypeName: "Presale",
    quantity: 2,
    totalAmount: 160000,
    paymentStatus: "refunded",
    createdAt: "2026-10-06T13:31:00Z",
  },
];

function mockOrder(eventId: string, orderId: string): OrgOrderDetail {
  const row =
    eventId === FIX.festival.id
      ? mockOrders.find((o) => o.id === orderId)
      : undefined;
  if (!row) throw new ApiError(404, "NOT_FOUND", "Pesanan tidak ditemukan.");
  return readMock(`order.${eventId}.${orderId}`, {
    ...row,
    unitPrice: row.totalAmount / row.quantity,
    paidAt: row.paymentStatus === "paid" ? row.createdAt : null,
    paymentMethod: "QRIS",
    attendees: Array.from({ length: row.quantity }, (_, i) => ({
      name: i ? "Sekar Ayu" : row.buyer.name,
    })),
    timeline: [
      { status: "pending", at: row.createdAt },
      ...(row.paymentStatus === "paid"
        ? [{ status: "paid", at: row.createdAt }]
        : []),
    ],
    tickets:
      row.paymentStatus === "paid"
        ? Array.from({ length: row.quantity }, (_, i) => ({
            id: `${orderId}-t${i + 1}`,
            ticketCode: `${row.orderCode}-${i ? "31PL" : "29XM"}`,
            attendeeName: i ? "Sekar Ayu" : row.buyer.name,
            checkInStatus: "unused" as const,
            checkedInAt: null,
          }))
        : [],
  });
}
function mockPage<T>(rows: T[], number = 1) {
  return {
    data: rows.slice((number - 1) * 20, number * 20),
    meta: { page: number, limit: 20, total: rows.length },
  };
}

export const organizerEventsApi = {
  summary: async (from?: string, to?: string) =>
    readResponse(
      dataResponse(summaryResponse),
      await api.get<{ data: OrgSummary }>("/organizer/summary", {
        query: { from, to },
        mock: () => {
          const result = wrap({
            publishedEvents: 4,
            paidTickets: 412,
            grossPaidSales: 12450000,
            dailySales: Array.from(
              {
                length: Math.min(
                  366,
                  Math.max(
                    1,
                    Math.ceil(
                      (Date.parse(to ?? new Date().toISOString()) -
                        Date.parse(
                          from ??
                            new Date(Date.now() - 30 * 86400000).toISOString(),
                        )) /
                        86400000,
                    ),
                  ),
                ),
              },
              (_, index) => ({
                date: new Date(
                  Date.parse(
                    from ?? new Date(Date.now() - 30 * 86400000).toISOString(),
                  ) +
                    index * 86400000,
                ).toISOString(),
                amount: [
                  250000, 400000, 150000, 550000, 300000, 450000, 800000,
                ][index % 7],
              }),
            ),
            changePercent: 18,
            pendingOrders: 3,
            attendanceRate: 87,
            period: {
              from: from ?? null,
              to: to ?? null,
              basis: "paidAt" as const,
            },
            generatedAt: new Date().toISOString(),
          });
          result.data.grossPaidSales = result.data.dailySales.reduce(
            (sum, day) => sum + day.amount,
            0,
          );
          return result;
        },
      }),
    ),

  list: async (status?: string) =>
    readResponse(
      pageResponse(eventRowResponse),
      await api.get<Paginated<OrgEventRow>>(base, {
        query: { status },
        mock: () => {
          const rows: OrgEventRow[] = [...FIX.orgEvents];
          for (const id of readMock<string[]>("eventIds", [])) {
            const event = mockGet(id);
            const index = rows.findIndex((row) => row.id === id);
            const row = {
              id,
              title: event.title,
              startsAt: event.startsAt || null,
              venueName: event.venueName || null,
              poster: event.posterUrl,
              sold: event.ticketTypes.reduce((n, t) => n + t.sold, 0),
              capacity: event.ticketTypes.reduce((n, t) => n + t.capacity, 0),
              gross: event.ticketTypes.reduce(
                (n, t) => n + t.sold * t.price,
                0,
              ),
              status: event.status,
            };
            if (index < 0) rows.push(row);
            else rows[index] = row;
          }
          return page(
            rows.filter(
              (e) =>
                !status ||
                e.status === status ||
                (status === "running" &&
                  ["on_sale", "scheduled"].includes(e.status)),
            ),
          );
        },
      }),
    ),
  get: async (id: string) =>
    readResponse(
      dataResponse(eventResponse),
      await api.get<{ data: OrgEvent }>(`${base}/${id}`, {
        mock: () => wrap(mockGet(id)),
      }),
    ),
  create: (input: Partial<EventInput>) =>
    api.post<{ data: OrgEvent }>(base, input, {
      mock: () => {
        const id = `ev_${crypto.randomUUID()}`;
        return wrap(
          mockSave(id, {
            ...input,
            slug: id,
            posterUrl: null,
            posterAssetId: null,
            ticketTypes: [],
            terms: [],
            performers: [],
            publicationStatus: "draft",
            status: "draft",
          }),
        );
      },
    }),
  update: (id: string, input: Partial<EventInput>) =>
    api.patch<{ data: OrgEvent }>(`${base}/${id}`, input, {
      mock: () => wrap(mockSave(id, input)),
    }),
  remove: (id: string) =>
    api.delete<void>(`${base}/${id}`, { mock: () => undefined }),
  publish: (id: string) =>
    api.post<{ data: OrgEvent }>(`${base}/${id}/publish`, undefined, {
      mock: () =>
        wrap(
          mockSave(id, { publicationStatus: "published", status: "on_sale" }),
        ),
    }),

  addTicketType: (id: string, input: TicketTypeInput) =>
    api.post<{ data: OrgEvent["ticketTypes"][number] }>(
      `${base}/${id}/ticket-types`,
      input,
      {
        mock: () => {
          const ticket = {
            ...input,
            id: `tt_${crypto.randomUUID()}`,
            sold: 0,
            reserved: 0,
            salesStopped: false,
          };
          mockSave(id, { ticketTypes: [...mockGet(id).ticketTypes, ticket] });
          return wrap(ticket);
        },
      },
    ),
  updateTicketType: (
    id: string,
    typeId: string,
    input: Partial<TicketTypeInput>,
  ) =>
    api.patch<void>(`${base}/${id}/ticket-types/${typeId}`, input, {
      mock: () => {
        mockSave(id, {
          ticketTypes: mockGet(id).ticketTypes.map((t) =>
            t.id === typeId ? { ...t, ...input } : t,
          ),
        });
      },
    }),
  removeTicketType: (id: string, typeId: string) =>
    api.delete<void>(`${base}/${id}/ticket-types/${typeId}`, {
      mock: () => {
        mockSave(id, {
          ticketTypes: mockGet(id).ticketTypes.filter((t) => t.id !== typeId),
        });
      },
    }),

  eventSummary: async (id: string) =>
    readResponse(
      dataResponse(eventSummaryResponse),
      await api.get<{ data: OrgEventSummary }>(`${base}/${id}/summary`, {
        mock: () => {
          const tickets = mockGet(id).ticketTypes;
          const capacity = tickets.reduce((n, t) => n + t.capacity, 0);
          const sold = tickets.reduce((n, t) => n + t.sold, 0);
          const reserved = tickets.reduce((n, t) => n + t.reserved, 0);
          const grossPaidSales = tickets.reduce(
            (n, t) => n + t.sold * t.price,
            0,
          );
          return wrap({
            capacity,
            sold,
            reserved,
            available: Math.max(0, capacity - sold - reserved),
            checkedIn:
              id === FIX.festival.id
                ? 130 +
                  readMock<{ outcome?: string }[]>(`scan.${id}.history`, [
                    { outcome: "valid" },
                  ]).filter((h) => h.outcome !== "rejected").length
                : 0,
            grossPaidSales,
            netSales: Math.round(grossPaidSales * 0.95),
            perTicketType: tickets.map((ticket) => ({
              id: ticket.id,
              name: ticket.name,
              sold: ticket.sold,
              capacity: ticket.capacity,
            })),
          });
        },
      }),
    ),
  orders: async (
    id: string,
    params: { q?: string; paymentStatus?: string; page?: number } = {},
  ) => {
    const result = await api.get<Paginated<OrgOrderRow>>(
      `${base}/${id}/orders`,
      {
        query: params,
        mock: () =>
          mockPage(
            (id === FIX.festival.id ? mockOrders : [])
              .map((o) => mockOrder(id, o.id))
              .filter(
                (o) =>
                  (!params.paymentStatus ||
                    o.paymentStatus === params.paymentStatus) &&
                  (!params.q ||
                    `${o.orderCode} ${o.buyer.name}`
                      .toLowerCase()
                      .includes(params.q.toLowerCase())),
              ),
            params.page,
          ),
      },
    );
    const validated = readResponse(pageResponse(orderRowResponse), result);
    return {
      ...validated,
      data: validated.data.map((row) => ({
        ...row,
        ticketTypeName: row.ticketTypeName ?? row.ticketType!.name,
      })),
    };
  },
  order: async (id: string, orderId: string) => {
    const result = await api.get<{ data: OrgOrderDetail }>(
      `${base}/${id}/orders/${orderId}`,
      { mock: () => wrap(mockOrder(id, orderId)) },
    );
    const validated = readResponse(dataResponse(orderDetailResponse), result);
    return wrap({
      ...validated.data,
      ticketTypeName:
        validated.data.ticketTypeName ?? validated.data.ticketType!.name,
    });
  },
  attendees: async (
    id: string,
    params: { q?: string; checkInStatus?: string; page?: number } = {},
  ) =>
    readResponse(
      pageResponse(attendeeResponse),
      await api.get<Paginated<AttendeeRow>>(`${base}/${id}/attendees`, {
        query: params,
        mock: () => {
          const rows = (id === FIX.festival.id ? mockOrders : []).flatMap(
            (o) => {
              const order = mockOrder(id, o.id);
              return order.tickets.map((t) => ({
                ticketId: t.id,
                ticketCode: t.ticketCode,
                attendeeName: t.attendeeName,
                buyerEmail: order.buyer.email,
                ticketTypeName: order.ticketTypeName,
                checkInStatus: t.checkInStatus,
                checkedInAt: t.checkedInAt,
              }));
            },
          );
          return mockPage(
            rows.filter(
              (r) =>
                (!params.checkInStatus ||
                  r.checkInStatus === params.checkInStatus) &&
                (!params.q ||
                  `${r.attendeeName} ${r.ticketCode} ${r.ticketTypeName}`
                    .toLowerCase()
                    .includes(params.q.toLowerCase())),
            ),
            params.page,
          );
        },
      }),
    ),
  resendTicket: (id: string, orderId: string) =>
    api.post<void>(`${base}/${id}/orders/${orderId}/resend`, undefined, {
      ...pending,
      mock: () => {
        if (
          !["paid", "partially_refunded"].includes(
            mockOrder(id, orderId).paymentStatus,
          )
        )
          throw new ApiError(
            422,
            "ORDER_NOT_PAID",
            "E-tiket hanya dapat dikirim untuk pesanan yang dibayar.",
          );
      },
    }),
  /** Unduh CSV pesanan atau peserta. Pending: endpoint ekspor. */
  exportCsvUrl: (id: string, kind: "orders" | "attendees") =>
    `/api/v1${base}/${id}/${kind}.csv`,

  committee: (id: string) =>
    api.get<{ data: CommitteeAssignment[] }>(`${base}/${id}/committee`, {
      mock: () => wrap(mockAssignments(id)),
    }),
  /** Pending B28/B17: penugasan memakai akun panitia (username), bukan email peserta. */
  assignCommittee: (id: string, memberIds: string[]) =>
    api.post<void>(
      `${base}/${id}/committee`,
      { memberIds },
      {
        ...pending,
        mock: async () => {
          const existing = (await organizerEventsApi.committee(id)).data;
          const members = readMock<
            { id: string; name: string; username: string }[]
          >("team", FIX.team);
          writeMock(`committee.${id}`, [
            ...existing,
            ...members
              .filter(
                (m) =>
                  memberIds.includes(m.id) &&
                  !existing.some((a) => a.userId === m.id),
              )
              .map((m) => ({
                userId: m.id,
                name: m.name,
                username: m.username,
                assignedAt: new Date().toISOString(),
              })),
          ]);
        },
      },
    ),
  revokeCommittee: (id: string, userId: string) =>
    api.delete<void>(`${base}/${id}/committee/${userId}`, {
      mock: async () => {
        const existing = (await organizerEventsApi.committee(id)).data;
        writeMock(
          `committee.${id}`,
          existing.filter((a) => a.userId !== userId),
        );
      },
    }),

  // Pending B33
  uploadPoster: async (
    file: File,
    signal?: AbortSignal,
    onProgress?: (percent: number) => void,
  ) =>
    readResponse(
      dataResponse(assetResponse),
      await upload<{ data: { assetId: string; url: string } }>(
        "/organizer/posters",
        file,
        {
          ...pending,
          signal,
          onProgress,
          mock: async () => {
            const url = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(new Error("Gambar gagal dibaca."));
              reader.readAsDataURL(file);
            });
            if (signal?.aborted)
              throw new ApiError(0, "ABORTED", "Unggahan dibatalkan.");
            const assetId = `asset_${crypto.randomUUID()}`;
            writeMock(`asset.${assetId}`, url);
            return wrap({ assetId, url });
          },
        },
      ),
    ),
  setTicketSales: (id: string, typeId: string, stopped: boolean) =>
    api.post<void>(
      `${base}/${id}/ticket-types/${typeId}/${stopped ? "stop" : "resume"}`,
      undefined,
      {
        ...pending,
        mock: () => {
          mockSave(id, {
            ticketTypes: mockGet(id).ticketTypes.map((t) =>
              t.id === typeId ? { ...t, salesStopped: stopped } : t,
            ),
          });
        },
      },
    ),
  cancelEvent: (
    id: string,
    confirmTitle: string,
    reason: string,
    idempotencyKey?: string,
  ) =>
    api.post<void>(
      `${base}/${id}/cancel`,
      { confirmTitle, reason },
      {
        ...pending,
        headers: idempotencyKey
          ? { "Idempotency-Key": idempotencyKey }
          : undefined,
        mock: () => {
          const event = mockGet(id);
          if (confirmTitle !== event.title || !reason.trim())
            throw new ApiError(
              422,
              "VALIDATION_ERROR",
              "Nama acara dan alasan pembatalan wajib diisi dengan benar.",
            );
          if (["cancelled", "ended"].includes(event.status))
            throw new ApiError(409, "EVENT_CLOSED", "Acara sudah ditutup.");
          mockSave(id, {
            status: "cancelled",
            salesClosed: true,
            ticketTypes: event.ticketTypes.map((t) => ({
              ...t,
              salesStopped: true,
            })),
          });
        },
      },
    ),
  duplicate: (id: string) =>
    api.post<{ data: { id: string } }>(`${base}/${id}/duplicate`, undefined, {
      ...pending,
      mock: () => {
        const copyId = `ev_${crypto.randomUUID()}`;
        const original = mockGet(id);
        mockSave(copyId, {
          ...original,
          title: `${original.title} (salinan)`,
          slug: copyId,
          publicationStatus: "draft",
          status: "draft",
          salesClosed: false,
          ticketTypes: original.ticketTypes.map((t) => ({
            ...t,
            id: crypto.randomUUID(),
            sold: 0,
            reserved: 0,
            salesStopped: false,
          })),
        });
        return wrap({ id: copyId });
      },
    }),

  refund: (
    id: string,
    orderId: string,
    input: RefundInput,
    idempotencyKey?: string,
  ) =>
    api.post<void>(`${base}/${id}/orders/${orderId}/refunds`, input, {
      ...pending,
      headers: idempotencyKey
        ? { "Idempotency-Key": idempotencyKey }
        : undefined,
      mock: () => {
        const order = mockOrder(id, orderId);
        if (
          !["paid", "partially_refunded"].includes(order.paymentStatus) ||
          !input.reason.trim()
        )
          throw new ApiError(
            422,
            "INVALID_REFUND",
            "Pesanan tidak dapat direfund atau alasan belum diisi.",
          );
        const ids =
          input.mode === "full"
            ? order.tickets
                .filter((t) => t.checkInStatus !== "cancelled")
                .map((t) => t.id)
            : (input.ticketIds ?? []);
        if (
          !ids.length ||
          ids.some(
            (ticketId) =>
              !order.tickets.some(
                (t) => t.id === ticketId && t.checkInStatus !== "cancelled",
              ),
          )
        )
          throw new ApiError(
            422,
            "INVALID_REFUND",
            "Pilih tiket yang masih aktif.",
          );
        const tickets = order.tickets.map((t) =>
          ids.includes(t.id)
            ? { ...t, checkInStatus: "cancelled" as const }
            : t,
        );
        const paymentStatus = tickets.every(
          (t) => t.checkInStatus === "cancelled",
        )
          ? "refunded"
          : "partially_refunded";
        writeMock(`order.${id}.${orderId}`, {
          ...order,
          tickets,
          paymentStatus,
          timeline: [
            ...order.timeline,
            { status: paymentStatus, at: new Date().toISOString() },
          ],
        });
      },
    }),
};
