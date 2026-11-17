import type { TicketEvent, TicketSummary } from "./types";
import { SITE_DOMAIN } from "@/lib/site";

/**
 * Logika bersama Tiketku dan e-tiket (pita 06, 07): status tiket, pengelompokan per pesanan,
 * dan tautan kalender.
 */

export type TicketState = "unused" | "used" | "past" | "void";

export function ticketState(t: Pick<TicketSummary, "checkInStatus" | "event">): TicketState {
  if (t.event.status === "cancelled" || t.checkInStatus === "cancelled") return "void";
  if (t.checkInStatus === "used") return "used";
  if (new Date(t.event.endsAt).getTime() < Date.now()) return "past";
  return "unused";
}

export const eventEnded = (e: TicketEvent) => new Date(e.endsAt).getTime() < Date.now();

/** Satu baris di Tiketku mewakili satu pesanan (bisa berisi beberapa tiket). */
export type TicketGroup = {
  orderId: string;
  orderCode: string;
  event: TicketEvent;
  ticketTypeName: string;
  tickets: TicketSummary[];
};

export function groupByOrder(tickets: TicketSummary[]): TicketGroup[] {
  const map = new Map<string, TicketGroup>();
  for (const t of tickets) {
    const g = map.get(t.orderId);
    if (g) g.tickets.push(t);
    else map.set(t.orderId, { orderId: t.orderId, orderCode: t.orderCode, event: t.event, ticketTypeName: t.ticketTypeName, tickets: [t] });
  }
  return [...map.values()];
}

// ---------- Kalender (pita 06 C) ----------

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function location(e: TicketEvent) {
  return [e.venueName, e.address].filter(Boolean).join(", ");
}

export function googleCalendarUrl(e: TicketEvent, detailsUrl: string) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${icsDate(e.startsAt)}/${icsDate(e.endsAt)}`,
    location: location(e),
    details: `E-tiket Gatherly: ${detailsUrl}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const escapeIcs = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** Unduh berkas .ics untuk Apple Calendar dan Outlook. */
export function downloadIcs(e: TicketEvent, detailsUrl: string, uid: string) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gatherly//E-tiket//ID",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}@${SITE_DOMAIN}`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(e.startsAt)}`,
    `DTEND:${icsDate(e.endsAt)}`,
    `SUMMARY:${escapeIcs(e.title)}`,
    `LOCATION:${escapeIcs(location(e))}`,
    `DESCRIPTION:${escapeIcs(`E-tiket Gatherly: ${detailsUrl}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${e.slug || "acara"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const mapsUrl = (e: TicketEvent) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location(e))}`;
