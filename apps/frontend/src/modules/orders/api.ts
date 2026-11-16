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
  ...overrides,
});

export const ordersApi = {
  /** Idempotency-Key: UUID per percobaan checkout. Pertahankan saat retry, ganti untuk pesanan baru. */
  create: (input: CreateOrderInput, idempotencyKey: string) =>
    api.post<{ data: Order }>("/orders", input, {
      headers: { "Idempotency-Key": idempotencyKey },
      mock: () => wrap(mockOrder({ quantity: input.quantity, attendees: input.attendees })),
    }),
  get: (id: string) => api.get<{ data: Order }>(`/orders/${id}`, { mock: () => wrap(mockOrder({ id })) }),
  list: () => api.get<Paginated<Order>>("/orders", { mock: () => page([mockOrder()]) }),
  paymentSession: (id: string) =>
    api.post<{ data: PaymentSession }>(`/orders/${id}/payment-session`, undefined, {
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
