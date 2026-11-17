import { api, page, wrap, type Paginated } from "@/lib/api/client";
import { FIX } from "@/modules/_mock/fixtures";

/**
 * Scan tiket untuk panitia dan organizer. Pita desain 14 (acara ditugaskan) dan 19.
 * Sudah ada: acara ditugaskan, cari tiket, riwayat, check-in.
 * Check-in wajib online. Tidak ada validasi tiket atau sinkronisasi offline.
 */

export type AssignedEvent = {
  id: string;
  title: string;
  startsAt: string;
  venueName: string;
  poster?: string;
  checkedIn: number;
  paidTickets: number;
  /** Waktu pemindaian ditentukan organizer per acara. */
  scanOpensAt: string;
  scanClosesAt: string;
};

export type LookupTicket = {
  ticketId: string;
  ticketCode: string;
  attendeeName: string;
  ticketTypeName: string;
  checkInStatus: "unused" | "used" | "cancelled";
  checkedInAt: string | null;
};

export type CheckInResult = {
  ticketId: string;
  ticketCode?: string;
  attendeeName: string;
  ticketTypeName: string;
  checkInStatus: "used";
  checkedInAt: string;
  orderTicketIndex?: { position: number; total: number };
};

export type HistoryItem = {
  ticketId: string;
  ticketCode: string;
  attendeeName: string;
  ticketTypeName: string;
  checkedInAt: string;
  checkedInBy: { id: string; name: string };
  method?: "scan" | "manual";
};

export type HistoryPage = Paginated<HistoryItem> & {
  meta: Paginated<HistoryItem>["meta"] & { paidTickets: number; generatedAt: string };
};

const base = "/committee/events";

export const checkInApi = {
  assigned: () =>
    api.get<Paginated<AssignedEvent>>(base, {
      mock: () =>
        page([
          { id: FIX.festival.id, title: FIX.festival.title, startsAt: FIX.festival.startsAt, venueName: FIX.festival.venueName, poster: FIX.festival.poster, checkedIn: 131, paidTickets: 168, scanOpensAt: "2026-11-21T06:00:00Z", scanClosesAt: "2026-11-21T15:00:00Z" },
          { id: "ev_keroncong", title: "Keroncong di Pendopo", startsAt: "2026-12-05T12:00:00Z", venueName: "Pendopo Kalurahan", checkedIn: 0, paidTickets: 74, scanOpensAt: "2026-12-05T10:00:00Z", scanClosesAt: "2026-12-05T15:00:00Z" },
        ]),
    }),
  lookup: (eventId: string, q: string) =>
    api.get<Paginated<LookupTicket>>(`${base}/${eventId}/tickets`, {
      query: { q },
      mock: () =>
        page([
          { ticketId: "tk_31pl", ticketCode: "GTH-4A7N-31PL", attendeeName: "Rafi Pratama", ticketTypeName: "Reguler", checkInStatus: "unused" as const, checkedInAt: null },
          { ticketId: "tk_90qw", ticketCode: "GTH-2K8M-90QW", attendeeName: "Rafika Dewi", ticketTypeName: "Presale", checkInStatus: "used" as const, checkedInAt: "2026-11-21T12:21:00Z" },
        ]),
    }),
  history: (eventId: string, params: { page?: number; rejectedOnly?: boolean } = {}) =>
    api.get<HistoryPage>(`${base}/${eventId}/check-ins`, {
      query: params,
      mock: () => ({
        ...page([
          { ticketId: "tk_29xm", ticketCode: "GTH-4A7N-29XM", attendeeName: "Aulia Nur Fajri", ticketTypeName: "Reguler", checkedInAt: "2026-11-21T12:24:00Z", checkedInBy: { id: "c_dimas", name: "Dimas Satria" }, method: "scan" as const },
          { ticketId: "tk_11qa", ticketCode: "GTH-8B2M-11QA", attendeeName: "Bima Saputra", ticketTypeName: "Reguler", checkedInAt: "2026-11-21T12:02:00Z", checkedInBy: { id: "c_nisa", name: "Nisa Rahmawati" }, method: "scan" as const },
        ]),
        meta: { page: 1, limit: 20, total: 131, paidTickets: 168, generatedAt: new Date().toISOString() },
      }),
    }),
  /** Kirim salah satu: qrPayload dari kamera, atau ticketCode dari pencarian manual. */
  checkIn: (eventId: string, input: { qrPayload: string } | { ticketCode: string }) =>
    api.post<{ data: CheckInResult }>(`${base}/${eventId}/check-ins`, input, {
      mock: () =>
        wrap({
          ticketId: "tk_29xm",
          attendeeName: "Aulia Nur Fajri",
          ticketTypeName: "Reguler",
          checkInStatus: "used" as const,
          checkedInAt: new Date().toISOString(),
          orderTicketIndex: { position: 2, total: 2 },
        }),
    }),

};
