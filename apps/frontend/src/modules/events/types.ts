export type TicketSaleStatus = "not_open" | "on_sale" | "sold_out" | "stopped" | "closed";
export type EventStatus = "on_sale" | "not_open" | "sold_out" | "closed" | "ended" | "cancelled";

export type EventCard = {
  slug: string;
  title: string;
  category: string;
  startsAt: string;
  venueName: string;
  poster: string;
  /** null bila tidak ada tiket yang bisa dibeli sekarang. 0 berarti gratis. */
  startingPrice: number | null;
  saved?: boolean;
  status?: EventStatus;
  /**
   * Sorotan penjualan untuk badge kartu. Dihitung backend:
   * almost_sold_out sisa kuota di bawah 10%, ending_soon penjualan tutup dalam 3 hari, new terbit dalam 7 hari.
   */
  highlight?: "almost_sold_out" | "ending_soon" | "new";
};

export type TicketType = {
  id: string;
  name: string;
  description?: string;
  price: number;
  /** Sisa kuota. Disembunyikan bila organizer tidak menampilkannya. */
  remaining?: number;
  salesStartsAt: string;
  salesEndsAt: string;
  status: TicketSaleStatus;
};

export type Performer = { name: string; note: string; time: string; photo: string };

export type EventDetail = {
  id: string;
  slug: string;
  title: string;
  category: string;
  poster: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  venueName: string;
  address: string;
  city: string;
  description: string;
  performerLabel: string;
  performers: Performer[];
  terms: string[];
  ticketTypes: TicketType[];
  maxPerOrder: number;
  status: EventStatus;
  cancelReason?: string;
  saved: boolean;
  organizer: { username: string; name: string; eventCount: number; since: number };
};

export type EventQuery = {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "date_asc" | "price_asc";
  page?: number;
  limit?: number;
};

export type OrganizerProfile = {
  username: string;
  name: string;
  city: string;
  since: number;
  description: string;
  links: { type: string; url: string }[];
  eventCount: number;
  upcoming: EventCard[];
  past: EventCard[];
};

export type ReportReason = "fraud" | "wrong_info" | "inappropriate" | "other";
export type ReportInput = { reason: ReportReason; note: string };
