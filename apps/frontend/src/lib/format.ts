import { formatDistanceToNowStrict } from "date-fns";
import { id } from "date-fns/locale";

const TZ_LABEL = "WIB";
const timeZone = "Asia/Jakarta";
const shortDate = new Intl.DateTimeFormat("id-ID", {
  timeZone,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const longDate = new Intl.DateTimeFormat("id-ID", {
  timeZone,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const clock = new Intl.DateTimeFormat("id-ID", {
  timeZone,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const compactDate = new Intl.DateTimeFormat("id-ID", {
  timeZone,
  day: "numeric",
  month: "short",
});

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/** Rp100.000 */
export function formatRupiah(amount: number) {
  return rupiah.format(amount).replace(/\s/g, "");
}

/** Rp36,25 jt, untuk kartu angka yang sempit. */
export function formatRupiahShort(amount: number) {
  if (amount >= 1_000_000) {
    const value = (amount / 1_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 2,
    });
    return `Rp${value} jt`;
  }
  return formatRupiah(amount);
}

const toDate = (value: string | Date) =>
  typeof value === "string" ? new Date(value) : value;

/** Sab, 21 Nov 2026 */
export function formatDateShort(value: string | Date) {
  return shortDate.format(toDate(value));
}

/** Sabtu, 21 November 2026 */
export function formatDateLong(value: string | Date) {
  return longDate.format(toDate(value));
}

/** 15.00 WIB */
export function formatTime(value: string | Date) {
  return `${clock.format(toDate(value))} ${TZ_LABEL}`;
}

/** 15.00 – 22.00 WIB (en dash dengan spasi, sesuai desain pita 04) */
export function formatTimeRange(start: string | Date, end: string | Date) {
  return `${clock.format(toDate(start))} – ${clock.format(toDate(end))} ${TZ_LABEL}`;
}

/** Event editor review, preserving the event's selected Indonesian timezone. */
export function formatEventDateTime(value: string, timezone = "Asia/Jakarta") {
  const label =
    timezone === "Asia/Makassar"
      ? "WITA"
      : timezone === "Asia/Jayapura"
        ? "WIT"
        : "WIB";
  const date = new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
  const time = new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
  return `${date}, ${time} ${label}`;
}

/** 14 Nov, 10.12 */
export function formatDateTimeCompact(value: string | Date) {
  return `${compactDate.format(toDate(value))}, ${clock.format(toDate(value))}`;
}

/** 5 menit lalu */
export function formatRelative(value: string | Date) {
  return `${formatDistanceToNowStrict(toDate(value), { locale: id })} lalu`;
}
