/**
 * Bentuk data acara di ruang organizer. Untuk endpoint yang sudah ada,
 * cocokkan lagi dengan Swagger (apps/backend/src/docs/swagger-spec.ts) saat integrasi.
 */

export type OrgEventStatus =
  "draft" | "scheduled" | "on_sale" | "ended" | "cancelled";

export type OrgEventRow = {
  id: string;
  title: string;
  startsAt: string | null;
  venueName: string | null;
  poster?: string | null;
  sold: number;
  capacity: number;
  gross: number;
  status: OrgEventStatus;
};

export type OrgSummary = {
  publishedEvents: number;
  paidTickets: number;
  grossPaidSales: number;
  /** Perbandingan dengan periode sebelumnya, dalam persen. */
  changePercent?: number;
  pendingOrders?: number;
  attendanceRate?: number;
  dailySales?: { date: string; amount: number }[];
  period: { from: string | null; to: string | null; basis: "paidAt" };
  generatedAt: string;
};

export type TicketTypeInput = {
  name: string;
  description?: string;
  price: number;
  capacity: number;
  salesStartsAt: string;
  salesEndsAt: string;
};

export type OrgTicketType = TicketTypeInput & {
  id: string;
  sold: number;
  reserved: number;
  salesStopped: boolean;
};

export type PerformerInput = {
  name: string;
  note: string;
  time: string;
  photoAssetId?: string | null;
  photoUrl?: string | null;
};

export type EventInput = {
  title: string;
  category: string;
  description: string;
  posterAssetId?: string | null;
  startsAt: string;
  endsAt: string;
  timezone: string;
  locationType: "offline" | "online";
  venueName: string;
  address: string;
  city: string;
  /** Pending B33 */
  terms?: string[];
  performerLabel?: string;
  performers?: PerformerInput[];
  showRemaining?: boolean;
};

export type OrgEvent = EventInput & {
  id: string;
  slug: string;
  publicationStatus: "draft" | "published";
  status: OrgEventStatus;
  salesClosed: boolean;
  posterUrl?: string | null;
  ticketTypes: OrgTicketType[];
  updatedAt: string;
};

export type OrgEventSummary = {
  capacity: number;
  reserved: number;
  sold: number;
  available: number;
  checkedIn: number;
  grossPaidSales: number;
  netSales?: number;
  pendingOrders?: number;
  perTicketType?: {
    id: string;
    name: string;
    sold: number;
    capacity: number;
  }[];
};

export type OrgOrderRow = {
  id: string;
  orderCode: string;
  buyer: { name: string; email: string };
  ticketTypeName: string;
  quantity: number;
  totalAmount: number;
  paymentStatus:
    | "pending"
    | "paid"
    | "failed"
    | "expired"
    | "refunded"
    | "partially_refunded";
  createdAt: string;
};

export type OrgOrderDetail = OrgOrderRow & {
  attendees: { name: string; email?: string }[];
  unitPrice: number;
  paidAt: string | null;
  paymentMethod?: string;
  timeline: { status: string; at: string }[];
  tickets: {
    id: string;
    ticketCode: string;
    attendeeName: string;
    checkInStatus: "unused" | "used" | "cancelled";
    checkedInAt: string | null;
  }[];
};

export type AttendeeRow = {
  ticketId: string;
  attendeeName: string;
  buyerEmail?: string;
  ticketTypeName: string;
  ticketCode: string;
  checkInStatus: "unused" | "used" | "cancelled";
  checkedInAt: string | null;
};

export type CommitteeAssignment = {
  userId: string;
  name: string;
  username: string;
  assignedAt: string;
};

export type RefundInput = {
  mode: "full" | "partial";
  ticketIds?: string[];
  amount?: number;
  reason: string;
};
