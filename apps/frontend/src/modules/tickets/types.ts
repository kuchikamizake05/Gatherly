export type CheckInStatus = "unused" | "used" | "cancelled";

export type TicketEvent = {
  title: string;
  slug: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  address?: string;
  city?: string;
  poster?: string;
  /** "cancelled" bila penyelenggara membatalkan acara. */
  status?: "active" | "cancelled";
  organizerUsername?: string;
  /** Jam pintu dibuka, untuk catatan "Pintu dibuka 14.30 WIB". */
  doorsOpenAt?: string | null;
  minAge?: number | null;
};

export type TicketSummary = {
  id: string;
  orderId: string;
  orderCode: string;
  ticketCode: string;
  attendeeName: string;
  ticketTypeName: string;
  checkInStatus: CheckInStatus;
  checkedInAt: string | null;
  /** Nama pintu saat check-in, misalnya "Pintu Utara". */
  checkInGate?: string | null;
  event: TicketEvent;
};

export type TicketDetail = TicketSummary & {
  /** Format gatherly:v1:<token>. Dirender jadi QR, bukan URL. */
  qrPayload: string;
  attendeeEmail?: string;
};
