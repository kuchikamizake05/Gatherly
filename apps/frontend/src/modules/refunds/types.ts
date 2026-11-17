/** Pengembalian dana pembeli. Kontrak dari backend #98, lihat komentar Dien di issue #16. */
export type RefundStatus = "requested" | "approved" | "processing" | "manual_required" | "refunded" | "rejected";

export type Refund = {
  id: string;
  orderId: string;
  eventId: string;
  /** Kosong berarti seluruh pesanan. */
  ticketIds: string[];
  reason: string;
  /** "event_cancelled": dana kembali penuh karena penyelenggara membatalkan acara. */
  kind: "buyer" | "event_cancelled";
  status: RefundStatus;
  amount: number;
  baseAmount: number;
  decisionNote: string | null;
  requestedAt: string;
  decidedAt: string | null;
  refundedAt: string | null;
  transferReference: string | null;
};

export type RefundInput = { reason: string; ticketIds?: string[] };
