import { ApiError, api, wrap } from "@/lib/api/client";

import type { Refund, RefundInput } from "./types";

/**
 * Pengajuan pengembalian dana oleh pembeli. Pita 07 baris G.
 * - GET /refunds: milik pembeli yang masuk, terbaru lebih dulu.
 * - POST /refunds/orders/:orderId: 409 REFUND_DEADLINE, NOT_REFUNDABLE, INVALID_TICKETS, REFUND_OVERFLOW.
 * Mock menyimpan pengajuan di memori selama tab terbuka supaya status setelah mengajukan bisa dicoba.
 */
const mockRefunds: Refund[] = [];

export const refundsApi = {
  list: () => api.get<{ data: Refund[] }>("/refunds", { mock: () => wrap([...mockRefunds]) }),
  request: (orderId: string, input: RefundInput, unitPrice: number, ticketCount: number) =>
    api.post<{ data: Refund }>(`/refunds/orders/${orderId}`, input, {
      mock: () => {
        if (input.reason.toLowerCase().includes("tes batas"))
          throw new ApiError(409, "REFUND_DEADLINE", "Batas pengajuan sudah lewat.");
        const count = input.ticketIds?.length ?? ticketCount;
        const refund: Refund = {
          id: `rf_${Date.now()}`,
          orderId,
          eventId: "ev_festival_jazz",
          ticketIds: input.ticketIds ?? [],
          reason: input.reason,
          kind: "buyer",
          status: "requested",
          amount: count * unitPrice,
          baseAmount: count * unitPrice,
          decisionNote: null,
          requestedAt: new Date().toISOString(),
          decidedAt: null,
          refundedAt: null,
          transferReference: null,
        };
        mockRefunds.unshift(refund);
        return wrap(refund);
      },
    }),
};
