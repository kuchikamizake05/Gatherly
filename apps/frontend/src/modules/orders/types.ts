export type PaymentStatus = "pending" | "paid" | "failed" | "expired";
export type ReservationStatus = "held" | "converted" | "released";
export type IssuanceStatus = "not_ready" | "processing" | "issued";

export type Attendee = { name: string; email?: string };

/** OrderDTO dari backend (docs/api-contract.md). */
export type Order = {
  id: string;
  orderCode?: string;
  event: { title: string; startsAt: string; timezone: string; venueName: string; slug?: string };
  ticketType: { name: string; unitPrice: number };
  quantity: number;
  attendees: Attendee[];
  totalAmount: number;
  currency: "IDR";
  paymentStatus: PaymentStatus;
  reservationStatus: ReservationStatus;
  issuanceStatus: IssuanceStatus;
  expiresAt: string;
  serverTime: string;
  isVerifying: boolean;
  canResumePayment: boolean;
  ticketIds: string[];
  /** Pending B34: pembatalan oleh pembeli. */
  cancelledAt?: string | null;
};

export type CreateOrderInput = {
  ticketTypeId: string;
  quantity: number;
  attendees: Attendee[];
};

export type PaymentSession = { snapToken: string; redirectUrl: string; expiresAt: string };
