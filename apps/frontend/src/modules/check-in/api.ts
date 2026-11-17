import { readResponse, dataResponse, pageResponse } from "@/lib/api/response";
import {
  lookupResponse,
  checkInResponse,
  assignedResponse,
  historyResponse,
} from "./response";
import { api, ApiError, page, wrap, type Paginated } from "@/lib/api/client";
import { readMock, writeMock } from "@/modules/_mock/store";
import { mockSession } from "@/modules/organizer-auth/mock-session";
import { mockAssignments } from "@/modules/team/mock-assignments";
import type { TeamMember } from "@/modules/team/api";
import { FIX } from "@/modules/_mock/fixtures";

/**
 * Scan tiket untuk panitia dan organizer. Pita desain 14 (acara ditugaskan) dan 19.
 * Sudah ada: acara ditugaskan, cari tiket, riwayat, check-in.
 * Check-in wajib online (keputusan 17 November 2026). Tidak ada daftar tiket luring atau sinkronisasi.
 */

export type AssignedEvent = {
  id: string;
  title: string;
  startsAt: string;
  venueName: string;
  poster?: string;
  checkedIn: number;
  paidTickets: number;
  /** Pemindaian dibuka 2 jam sebelum acara dan ditutup saat acara selesai. */
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
  checkedInBy: { id: string; name: string } | null;
  method?: "scan" | "manual";
  outcome?: "valid" | "rejected";
  reason?: string;
};

export type HistoryPage = Paginated<HistoryItem> & {
  meta: Paginated<HistoryItem>["meta"] & {
    paidTickets: number;
    generatedAt: string;
    historyTotal?: number;
  };
};

const base = "/committee/events";
const mockTickets: LookupTicket[] = [
  {
    ticketId: "tk_29xm",
    ticketCode: "GTH-4A7N-29XM",
    attendeeName: "Aulia Nur Fajri",
    ticketTypeName: "Reguler",
    checkInStatus: "unused",
    checkedInAt: null,
  },
  {
    ticketId: "tk_31pl",
    ticketCode: "GTH-4A7N-31PL",
    attendeeName: "Rafi Pratama",
    ticketTypeName: "Reguler",
    checkInStatus: "unused",
    checkedInAt: null,
  },
  {
    ticketId: "tk_90qw",
    ticketCode: "GTH-2K8M-90QW",
    attendeeName: "Rafika Dewi",
    ticketTypeName: "Presale",
    checkInStatus: "used",
    checkedInAt: "2026-11-21T12:21:00Z",
  },
];
const getTickets = (id: string) =>
  readMock<LookupTicket[]>(`scan.${id}.tickets`, mockTickets);
const getHistory = (id: string) =>
  readMock<HistoryItem[]>(`scan.${id}.history`, [
    {
      ticketId: "tk_11qa",
      ticketCode: "GTH-8B2M-11QA",
      attendeeName: "Bima Saputra",
      ticketTypeName: "Reguler",
      checkedInAt: "2026-11-21T12:02:00Z",
      checkedInBy: { id: "c_nisa", name: "Nisa Rahmawati" },
      outcome: "valid",
      method: "scan",
    },
    {
      ticketId: "rejected_1",
      ticketCode: "",
      attendeeName: "Kode tidak dikenali",
      ticketTypeName: "",
      checkedInAt: "2026-11-21T11:58:00Z",
      checkedInBy: { id: "c_nisa", name: "Nisa Rahmawati" },
      outcome: "rejected",
      reason: "Bukan e-tiket Gatherly",
      method: "scan",
    },
  ]);

export const checkInApi = {
  assigned: async () =>
    readResponse(
      assignedResponse,
      await api.get<Paginated<AssignedEvent>>(base, {
        pending: true,
        mock: () => {
          const session = mockSession();
          const member = readMock<TeamMember[]>("team", FIX.team).find(
            (m) => m.username === session.username,
          );
          const ids = Array.from(
            new Set([
              ...FIX.orgEvents.map((e) => e.id),
              ...readMock<string[]>("eventIds", []),
            ]),
          );
          const rows: AssignedEvent[] = [];
          for (const id of ids) {
            const baseEvent = FIX.orgEvents.find((e) => e.id === id);
            const event = readMock(`event.${id}`, {
              ...baseEvent,
              id,
              title: baseEvent?.title ?? "",
              status: baseEvent?.status ?? "draft",
              startsAt: baseEvent?.startsAt ?? "",
              endsAt: baseEvent?.startsAt
                ? new Date(
                    Date.parse(baseEvent.startsAt) + 7 * 3600000,
                  ).toISOString()
                : "",
              venueName: baseEvent?.venueName ?? "",
            });
            if (
              !event.startsAt ||
              ["draft", "cancelled"].includes(event.status)
            )
              continue;
            const assignments = mockAssignments(id);
            if (
              session.role === "committee" &&
              (!member ||
                member.status === "inactive" ||
                !assignments.some((a) => a.userId === member.id))
            )
              continue;
            rows.push({
              id,
              title: event.title,
              startsAt: event.startsAt,
              venueName: event.venueName ?? "",
              paidTickets: baseEvent?.sold ?? 0,
              checkedIn: getHistory(id).filter((h) => h.outcome !== "rejected")
                .length,
              scanOpensAt: new Date(
                Date.parse(event.startsAt) - 2 * 3600000,
              ).toISOString(),
              scanClosesAt: event.endsAt,
            });
          }
          return page(rows);
        },
      }),
    ),
  lookup: async (eventId: string, q: string) =>
    readResponse(
      pageResponse(lookupResponse),
      await api.get<Paginated<LookupTicket>>(`${base}/${eventId}/tickets`, {
        query: { q },
        mock: () =>
          page(
            getTickets(eventId).filter((t) =>
              `${t.attendeeName} ${t.ticketCode}`
                .toLowerCase()
                .includes(q.toLowerCase()),
            ),
          ),
      }),
    ),
  history: async (
    eventId: string,
    params: { page?: number; rejectedOnly?: boolean } = {},
  ) =>
    readResponse(
      historyResponse,
      await api.get<HistoryPage>(`${base}/${eventId}/check-ins`, {
        query: params,
        mock: () => {
          const items = getHistory(eventId);
          const filtered = params.rejectedOnly
            ? items.filter((item) => item.outcome === "rejected")
            : items;
          const number = params.page ?? 1;
          return {
            data: filtered.slice((number - 1) * 20, number * 20),
            meta: {
              page: number,
              limit: 20,
              total:
                130 +
                items.filter((item) => item.outcome !== "rejected").length,
              paidTickets: 168,
              generatedAt: new Date().toISOString(),
              historyTotal: filtered.length,
            },
          };
        },
      }),
    ),
  /** Kirim salah satu: qrPayload dari kamera, atau ticketCode dari pencarian manual. */
  checkIn: async (
    eventId: string,
    input: { qrPayload: string } | { ticketCode: string },
  ) =>
    readResponse(
      dataResponse(checkInResponse),
      await api.post<{ data: CheckInResult }>(
        `${base}/${eventId}/check-ins`,
        input,
        {
          mock: () => {
            const tickets = getTickets(eventId);
            const ticket =
              "ticketCode" in input
                ? tickets.find((t) => t.ticketCode === input.ticketCode)
                : tickets.find(
                    (t) =>
                      input.qrPayload === `gatherly:v1:mock-${t.ticketCode}`,
                  );
            if (!ticket)
              throw new ApiError(
                404,
                "INVALID_TICKET",
                "Kode tiket tidak dikenali.",
              );
            if (ticket.checkInStatus === "used")
              throw new ApiError(
                409,
                "TICKET_ALREADY_USED",
                "Tiket sudah digunakan.",
                {},
                { checkedInAt: ticket.checkedInAt },
              );
            if (ticket.checkInStatus === "cancelled")
              throw new ApiError(409, "TICKET_CANCELLED", "Tiket dibatalkan.");
            const checkedInAt = new Date().toISOString();
            writeMock(
              `scan.${eventId}.tickets`,
              tickets.map((t) =>
                t.ticketId === ticket.ticketId
                  ? { ...t, checkInStatus: "used", checkedInAt }
                  : t,
              ),
            );
            writeMock(`scan.${eventId}.history`, [
              {
                ...ticket,
                checkedInAt,
                checkedInBy: { id: "c_dimas", name: "Dimas Satria" },
                outcome: "valid",
                method: "manual",
              },
              ...getHistory(eventId),
            ]);
            return wrap({
              ...ticket,
              checkInStatus: "used" as const,
              checkedInAt,
            });
          },
        },
      ),
    ),
};
