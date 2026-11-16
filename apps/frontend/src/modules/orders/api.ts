import { api, page, wrap, type Paginated } from "@/lib/api/client";
import { FIX } from "@/modules/_mock/fixtures";

import type { CreateOrderInput, Order, PaymentSession } from "./types";

/**
 * Checkout dan pembayaran. Pita desain 04 (tombol Beli tiket), 05, dan 07 (kartu menunggu bayar).
 * Endpoint create, get, list, dan payment-session sudah ada di backend.
 * Pembatalan oleh pembeli belum ada (issue B34).
 */

const mockOrder = (overrides: Partial<Order> = {}): Order => ({
  id: FIX.order.id,
  orderCode: FIX.order.orderCode,
  event: {
    title: FIX.festival.title,
    startsAt: FIX.festival.startsAt,
    timezone: FIX.festival.timezone,
    venueName: FIX.festival.venueName,
    slug: FIX.festival.slug,
  },
  ticketType: { name: "Reguler", unitPrice: FIX.order.unitPrice },
  quantity: FIX.order.quantity,
  attendees: FIX.order.attendees,
  totalAmount: FIX.order.totalAmount,
  currency: "IDR",
  paymentStatus: "pending",
  reservationStatus: "held",
  issuanceStatus: "not_ready",
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  serverTime: new Date().toISOString(),
  isVerifying: false,
  canResumePayment: true,
  ticketIds: [],
  createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
  paymentMethod: null,
  ...overrides,
});

const ev = (slug: string, extra: Partial<Order["event"]> = {}): Order["event"] => {
  const c = FIX.catalog.find((x) => x.slug === slug)!;
  return { title: c.title, startsAt: c.startsAt, timezone: "Asia/Jakarta", venueName: c.venueName, slug: c.slug, poster: c.poster, ...extra };
};

/** Pesanan contoh untuk Tiketku: menunggu bayar dan tab Dibatalkan (pita 07 C, E). */
const mockOrders: Order[] = [
  mockOrder({
    id: "ord_pm01",
    orderCode: "GTH-PM01",
    event: ev("pameran-foto-kampung-kota"),
    ticketType: { name: "Reguler", unitPrice: 0 },
    quantity: 1,
    totalAmount: 0,
    expiresAt: new Date(Date.now() + 11 * 60_000).toISOString(),
  }),
  mockOrder({
    id: "ord_mt01",
    orderCode: "GTH-MT01",
    event: ev("meetup-desainer-produk-12"),
    ticketType: { name: "Reguler", unitPrice: 75000 },
    quantity: 1,
    totalAmount: 75000,
    paymentStatus: "expired",
    reservationStatus: "released",
    canResumePayment: false,
    expiresAt: "2026-10-14T07:40:00Z",
  }),
  mockOrder({
    id: "ord_nr01",
    orderCode: "GTH-NR01",
    event: ev("jogja-night-run-5k"),
    ticketType: { name: "Reguler", unitPrice: 150000 },
    quantity: 1,
    totalAmount: 150000,
    reservationStatus: "released",
    canResumePayment: false,
    cancelledBy: "buyer",
    cancelledAt: "2026-10-12T02:15:00Z",
  }),
  mockOrder({
    id: "ord_gm01",
    orderCode: "GTH-GM01",
    event: ev("malam-eksperimen-gamelan-synth", { status: "cancelled", organizerUsername: FIX.organizer.username }),
    ticketType: { name: "VIP", unitPrice: 150000 },
    quantity: 2,
    totalAmount: 300000,
    paymentStatus: "paid",
    reservationStatus: "converted",
    issuanceStatus: "issued",
    canResumePayment: false,
    cancelledBy: "organizer",
    cancelledAt: "2026-11-07T05:00:00Z",
  }),
];

/** Pesanan yang sudah dibayar (dipakai e-tiket dan bukti pembayaran). */
const paidOrder = () =>
  mockOrder({
    paymentStatus: "paid",
    reservationStatus: "converted",
    issuanceStatus: "issued",
    canResumePayment: false,
    paidAt: FIX.order.paidAt,
    createdAt: FIX.order.createdAt,
    paymentMethod: "bca_va",
    transactionId: "MT-8F2C91A4-4A7N",
    buyer: { name: FIX.buyer.name, email: FIX.buyer.email },
    contactPhone: FIX.buyer.phone,
    ticketIds: FIX.order.tickets.map((t) => t.id),
    event: {
      title: FIX.festival.title,
      startsAt: FIX.festival.startsAt,
      endsAt: FIX.festival.endsAt,
      timezone: FIX.festival.timezone,
      venueName: FIX.festival.venueName,
      address: FIX.festival.address,
      slug: FIX.festival.slug,
      poster: FIX.festival.poster,
    },
  });

export const ordersApi = {
  /** Idempotency-Key: UUID per percobaan checkout. Pertahankan saat retry, ganti untuk pesanan baru. */
  create: (input: CreateOrderInput, idempotencyKey: string) =>
    api.post<{ data: Order }>("/orders", input, {
      headers: { "Idempotency-Key": idempotencyKey },
      mock: () => wrap(mockOrder({ id: "ord_new", quantity: input.quantity, attendees: input.attendees })),
    }),
  /** Mock: ord_4a7n sudah dibayar (e-tiket, bukti bayar), pesanan lain menunggu bayar (checkout). */
  get: (id: string) =>
    api.get<{ data: Order }>(`/orders/${id}`, {
      mock: () => wrap(id === FIX.order.id ? paidOrder() : (mockOrders.find((o) => o.id === id) ?? mockOrder({ id }))),
    }),
  list: () => api.get<Paginated<Order>>("/orders", { mock: () => page([paidOrder(), ...mockOrders]) }),
  /** method: kode dari payment-methods.ts. Backend meneruskannya sebagai enabled_payments Snap. */
  paymentSession: (id: string, method: string) =>
    api.post<{ data: PaymentSession }>(`/orders/${id}/payment-session`, { method }, {
      mock: () =>
        wrap({
          snapToken: "mock-snap-token",
          redirectUrl: "https://app.sandbox.midtrans.com/snap/v4/redirection/mock",
          expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        }),
    }),

  // Pending B34
  cancel: (id: string) =>
    api.post<{ data: Order }>(`/orders/${id}/cancel`, undefined, {
      pending: true,
      mock: () => wrap(mockOrder({ id, reservationStatus: "released", canResumePayment: false })),
    }),
};
