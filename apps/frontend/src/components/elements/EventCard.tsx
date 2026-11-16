"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, HeartOff } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useToggleSave } from "@/modules/events/hooks";
import type { EventCard as EventCardData } from "@/modules/events/types";

/**
 * Kartu acara. Komponen "Event Card" dan "Event Row (mobile list)" di pita 02.
 * Dipakai di beranda, hasil cari, kategori (pita 03), Disimpan (08), dan profil penyelenggara (09).
 *
 * - layout="card": poster di atas, untuk grid.
 * - layout="row": thumbnail 84 px di kiri, untuk daftar di mobile. Tombol hati di kanan bila showSave.
 * - Kartu: badge otomatis dari data (Hampir habis, Segera berakhir, Baru, Tiket habis, Sudah lewat, Gratis).
 *   Kirim badge={null} untuk menyembunyikan, atau objek badge sendiri untuk menimpa.
 * - Baris: tanpa badge kecuali dikirim, misalnya badge={eventBadge(event)} di Disimpan.
 */

type Tone = "danger" | "warning" | "neutral" | "success" | "inverse" | "brand";
export type CardBadge = { label: string; short?: string; tone?: Tone };

type EventCardProps = {
  event: EventCardData;
  layout?: "card" | "row";
  badge?: CardBadge | null;
  showSave?: boolean;
  /**
   * Bila diisi, tombol hati memanggil ini dan tidak menyimpan sendiri.
   * Dipakai Disimpan (pita 08) supaya kartu bisa hilang dan kembali di posisinya.
   */
  onSaveChange?: (next: boolean) => void;
  /** Kartu diredupkan, misalnya acara yang sudah lewat di Disimpan. */
  dimmed?: boolean;
  priority?: boolean;
  className?: string;
};

export function isPast(event: EventCardData) {
  return event.status === "ended" || new Date(event.startsAt).getTime() < Date.now();
}

/** Badge bawaan kartu sesuai data. */
export function eventBadge(event: EventCardData): CardBadge | null {
  if (isPast(event)) return { label: "Sudah lewat", tone: "neutral" };
  if (event.status === "cancelled") return { label: "Dibatalkan", tone: "danger" };
  if (event.status === "sold_out") return { label: "Tiket habis", tone: "inverse" };
  if (event.highlight === "almost_sold_out") return { label: "Hampir habis", tone: "danger" };
  if (event.highlight === "ending_soon") return { label: "Penjualan segera berakhir", short: "Segera berakhir", tone: "warning" };
  if (event.highlight === "new") return { label: "Baru", tone: "neutral" };
  if (event.startingPrice === 0) return { label: "Gratis", tone: "brand" };
  return null;
}

function priceLabel(price: number | null) {
  if (price === null) return "Tiket tidak tersedia";
  if (price === 0) return "Gratis";
  return `Mulai ${formatRupiah(price)}`;
}

/** Sab, 21 Nov, 15.00 */
const shortDate = (iso: string) => format(new Date(iso), "EEE, d MMM, HH.mm", { locale: localeId });

const ROW_TONE: Record<Tone, string> = {
  danger: "text-danger-ink",
  warning: "text-warning-ink",
  neutral: "text-text-tertiary",
  success: "text-success-ink",
  inverse: "text-text-tertiary",
  brand: "text-primary-ink",
};

function SaveButton({
  slug,
  saved,
  title,
  variant,
  onSaveChange,
}: {
  slug: string;
  saved: boolean;
  title: string;
  variant: "card" | "row";
  onSaveChange?: (next: boolean) => void;
}) {
  const toggle = useToggleSave();
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onSaveChange) return onSaveChange(!saved);
    toggle.mutate(
      { slug, saved: !saved },
      {
        onSuccess: () =>
          toast(saved ? "Dihapus dari Disimpan" : "Acara disimpan", {
            icon: saved ? <HeartOff className="size-[18px]" /> : <Heart className="size-[18px]" />,
            action: { label: "Batalkan", onClick: () => toggle.mutate({ slug, saved }) },
          }),
        onError: () => toast.error("Gagal menyimpan acara. Coba lagi."),
      },
    );
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? `Hapus ${title} dari Disimpan` : `Simpan ${title}`}
      className={cn(
        "press flex shrink-0 items-center justify-center rounded-full transition-colors",
        variant === "row"
          ? cn("size-10", saved ? "bg-danger-tint text-danger" : "bg-surface-2 text-foreground")
          : cn("size-9", saved ? "bg-inverse text-primary" : "bg-white/90 text-foreground"),
      )}
    >
      <Heart className={cn("size-[18px]", saved && "fill-current")} aria-hidden />
    </button>
  );
}

export function EventCard({
  event,
  layout = "card",
  badge,
  showSave = true,
  onSaveChange,
  dimmed = false,
  priority = false,
  className,
}: EventCardProps) {
  const href = `/events/${event.slug}`;
  const shownBadge = badge === undefined ? eventBadge(event) : badge;

  if (layout === "row") {
    /** Baris tanpa badge: tanggal di atas (pita 03, 09). Dengan badge: badge di atas, tanggal di bawah (pita 08). */
    const rowBadge = badge ?? null;
    return (
      <div className={cn("flex w-full items-center gap-3", className)}>
        <Link href={href} className={cn("press flex min-w-0 flex-1 items-center gap-3.5", dimmed && "opacity-60")}>
          <span className="relative size-[84px] shrink-0 overflow-hidden rounded-md bg-surface-2">
            <Image src={event.poster} alt="" fill sizes="84px" className="object-cover" priority={priority} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            {rowBadge ? (
              <span className={cn("text-xs font-bold", ROW_TONE[rowBadge.tone ?? "neutral"])}>{rowBadge.short ?? rowBadge.label}</span>
            ) : (
              <span className="text-[13px] font-bold text-text-secondary">{shortDate(event.startsAt)}</span>
            )}
            <span className="line-clamp-2 text-[15px] leading-snug font-bold text-foreground">{event.title}</span>
            <span className="line-clamp-2 text-[13px] text-text-tertiary">
              {rowBadge
                ? `${shortDate(event.startsAt)}, ${event.venueName}`
                : `${event.venueName}${event.startingPrice !== null ? `, ${priceLabel(event.startingPrice)}` : ""}`}
            </span>
          </span>
        </Link>
        {showSave && (
          <SaveButton slug={event.slug} saved={!!event.saved} title={event.title} variant="row" onSaveChange={onSaveChange} />
        )}
      </div>
    );
  }

  return (
    <Link href={href} className={cn("group flex w-full flex-col gap-2.5", dimmed && "opacity-60", className)}>
      <span className="relative block aspect-[16/10] w-full overflow-hidden rounded-lg bg-surface-2">
        <Image
          src={event.poster}
          alt=""
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
          className="object-cover transition-transform duration-200 ease-out [@media(hover:hover)]:group-hover:scale-[1.02]"
          priority={priority}
        />
        {showSave && (
          <span className="absolute top-2.5 right-2.5">
            <SaveButton slug={event.slug} saved={!!event.saved} title={event.title} variant="card" onSaveChange={onSaveChange} />
          </span>
        )}
      </span>
      {shownBadge && <Badge tone={shownBadge.tone ?? "neutral"}>{shownBadge.label}</Badge>}
      <span className="line-clamp-2 text-lg leading-snug font-bold text-foreground">{event.title}</span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-text-secondary">{shortDate(event.startsAt)} WIB</span>
        <span className="truncate text-sm font-medium text-text-tertiary">{event.venueName}</span>
      </span>
      <span className="text-base font-extrabold text-foreground">{priceLabel(event.startingPrice)}</span>
    </Link>
  );
}

/** Kerangka kartu saat memuat, bentuknya sama dengan kartu asli. */
export function EventCardSkeleton({ layout = "card" }: { layout?: "card" | "row" }) {
  if (layout === "row") {
    return (
      <div className="flex w-full items-center gap-3.5" aria-hidden>
        <span className="skeleton size-[84px] shrink-0 rounded-md" />
        <span className="flex flex-1 flex-col gap-2">
          <span className="skeleton h-4 w-3/4 rounded" />
          <span className="skeleton h-3 w-1/2 rounded" />
        </span>
      </div>
    );
  }
  return (
    <div className="flex w-full flex-col gap-3" aria-hidden>
      <span className="skeleton aspect-[16/10] w-full rounded-lg" />
      <span className="skeleton h-4 w-3/4 rounded" />
      <span className="skeleton h-3 w-1/2 rounded" />
    </div>
  );
}
