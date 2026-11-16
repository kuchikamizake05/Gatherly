export type PaymentStatus = "pending" | "paid" | "failed" | "expired";
export type ReservationStatus = "held" | "converted" | "released";
export type IssuanceStatus = "not_ready" | "processing" | "issued";

/** birthDate YYYY-MM-DD, wajib bila acara punya batas usia (EventDetail.minAge). */
export type Attendee = { name: string; email?: string; birthDate?: string };

/** OrderDTO dari backend (docs/api-contract.md). */
export type Order = {
  id: string;
  orderCode?: string;
  event: {
    title: string;
    startsAt: string;
    timezone: string;
    venueName: string;
    slug?: string;
    poster?: string;
    endsAt?: string;
    address?: string;
    /** "cancelled" bila penyelenggara membatalkan acara. */
    status?: "active" | "cancelled";
    organizerUsername?: string;
  };
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
  createdAt?: string;
  paidAt?: string | null;
  /** ID transaksi Midtrans untuk bukti pembayaran. */
  transactionId?: string | null;
  buyer?: { name: string; email: string };
  contactPhone?: string | null;
  /** Siapa yang membatalkan: pembeli (B34) atau penyelenggara (acara dibatalkan). */
  cancelledBy?: "buyer" | "organizer" | null;
  /** Kode metode yang dipilih terakhir, misalnya "bca_va". */
  paymentMethod?: string | null;
  /** Pending B34: pembatalan oleh pembeli. */
  cancelledAt?: string | null;
};

export type CreateOrderInput = {
  ticketTypeId: string;
  quantity: number;
  attendees: Attendee[];
  /** Nomor WhatsApp pemesan untuk info penting pesanan. */
  contactPhone: string;
};

export type PaymentSession = { snapToken: string; redirectUrl: string; expiresAt: string };
