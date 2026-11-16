"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatDateShort, formatRupiah, formatTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { useToggleSave } from "@/modules/events/hooks";
import type { EventCard as EventCardData } from "@/modules/events/types";

/**
 * Kartu acara. Komponen "Event Card" dan "Event Row (mobile list)" di pita 02.
 * Dipakai di beranda, hasil cari, kategori (pita 03), Disimpan (08), dan profil penyelenggara (09).
 *
 * - layout="card": poster 16:9 di atas, untuk grid.
 * - layout="row": thumbnail 88 px di kiri, untuk daftar di mobile.
 */

type EventCardProps = {
  event: EventCardData;
  layout?: "card" | "row";
  /** Label status pendek di atas judul, misalnya "Hampir habis" atau "Sudah lewat". */
  badge?: { label: string; tone?: "danger" | "warning" | "neutral" | "success" };
  /** Disembunyikan untuk tamu. Klik simpan saat tamu sebaiknya diarahkan ke Masuk oleh halaman. */
  showSave?: boolean;
  /** Kartu diredupkan, misalnya acara yang sudah lewat di Disimpan. */
  dimmed?: boolean;
  priority?: boolean;
  className?: string;
};

function priceLabel(price: number | null) {
  if (price === null) return "Tiket tidak tersedia";
  if (price === 0) return "Gratis";
  return `Mulai ${formatRupiah(price)}`;
}

function SaveButton({ slug, saved, title }: { slug: string; saved: boolean; title: string }) {
  const toggle = useToggleSave();
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle.mutate(
      { slug, saved: !saved },
      {
        onSuccess: () =>
          toast(saved ? "Dihapus dari Disimpan" : "Acara disimpan", {
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
        "press flex size-9 items-center justify-center rounded-full transition-colors",
        saved ? "bg-inverse text-primary" : "bg-white/90 text-foreground",
      )}
    >
      <Heart className={cn("size-[17px]", saved && "fill-current")} aria-hidden />
    </button>
  );
}

export function EventCard({
  event,
  layout = "card",
  badge,
  showSave = true,
  dimmed = false,
  priority = false,
  className,
}: EventCardProps) {
  const href = `/events/${event.slug}`;
  const date = `${formatDateShort(event.startsAt).replace(/ \d{4}$/, "")}, ${formatTime(event.startsAt)}`;

  if (layout === "row") {
    return (
      <Link
        href={href}
        className={cn(
          "press flex w-full items-center gap-3.5 border-b border-border pb-4",
          dimmed && "opacity-60",
          className,
        )}
      >
        <span className="relative size-[88px] shrink-0 overflow-hidden rounded-md bg-surface-2">
          <Image src={event.poster} alt="" fill sizes="88px" className="object-cover" priority={priority} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          {badge && <Badge tone={badge.tone ?? "neutral"}>{badge.label}</Badge>}
          <span className="text-[13px] font-bold text-text-secondary">{date}</span>
          <span className="line-clamp-2 text-base leading-snug font-bold text-foreground">{event.title}</span>
          <span className="truncate text-[13px] font-medium text-text-tertiary">
            {event.venueName}, {priceLabel(event.startingPrice)}
          </span>
        </span>
      </Link>
    );
  }

  return (
    <Link href={href} className={cn("group flex w-full flex-col gap-2.5", dimmed && "opacity-60", className)}>
      <span className="relative block aspect-[16/10] w-full overflow-hidden rounded-lg bg-surface-2">
        <Image
          src={event.poster}
          alt=""
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
          className="object-cover transition-transform duration-200 ease-out [@media(hover:hover)]:group-hover:scale-[1.02]"
          priority={priority}
        />
        {showSave && (
          <span className="absolute right-2.5 bottom-2.5">
            <SaveButton slug={event.slug} saved={!!event.saved} title={event.title} />
          </span>
        )}
      </span>
      {badge && <Badge tone={badge.tone ?? "neutral"}>{badge.label}</Badge>}
      <span className="line-clamp-2 text-lg leading-snug font-bold text-foreground">{event.title}</span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-text-secondary">{date}</span>
        <span className="truncate text-sm font-medium text-text-tertiary">{event.venueName}</span>
      </span>
      <span className="text-base font-extrabold text-foreground">{priceLabel(event.startingPrice)}</span>
    </Link>
  );
}
