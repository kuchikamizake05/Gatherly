import { format, formatDistanceToNowStrict } from "date-fns";
import { id } from "date-fns/locale";

const TZ_LABEL = "WIB";

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
    const value = (amount / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 2 });
    return `Rp${value} jt`;
  }
  return formatRupiah(amount);
}

const toDate = (value: string | Date) => (typeof value === "string" ? new Date(value) : value);

/** Sab, 21 Nov 2026 */
export function formatDateShort(value: string | Date) {
  return format(toDate(value), "EEE, d MMM yyyy", { locale: id });
}

/** Sabtu, 21 November 2026 */
export function formatDateLong(value: string | Date) {
  return format(toDate(value), "EEEE, d MMMM yyyy", { locale: id });
}

/** 15.00 WIB */
export function formatTime(value: string | Date) {
  return `${format(toDate(value), "HH.mm")} ${TZ_LABEL}`;
}

/** 15.00 – 22.00 WIB (en dash dengan spasi, sesuai desain pita 04) */
export function formatTimeRange(start: string | Date, end: string | Date) {
  return `${format(toDate(start), "HH.mm")} – ${format(toDate(end), "HH.mm")} ${TZ_LABEL}`;
}

/** 14 Nov, 10.12 */
export function formatDateTimeCompact(value: string | Date) {
  return format(toDate(value), "d MMM, HH.mm", { locale: id });
}

/** 5 menit lalu */
export function formatRelative(value: string | Date) {
  return `${formatDistanceToNowStrict(toDate(value), { locale: id })} lalu`;
}
