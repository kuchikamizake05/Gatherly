"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, CalendarDays, ChevronRight, Flag, Heart, LayoutGrid, MapPin, Share2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatDateLong, formatTimeRange } from "@/lib/format";
import { useMe } from "@/modules/auth/hooks";
import { useEvent, useToggleSave } from "@/modules/events/hooks";
import { categorySlug } from "@/modules/events/categories";
import type { EventDetail as EventDetailData } from "@/modules/events/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/elements/Alert";
import { initials } from "@/components/elements/AccountMenu";
import { eventBadge } from "@/components/elements/EventCard";

import { ReportEventDialog } from "./ReportEventDialog";
import { ShareMenu } from "./ShareMenu";
import { MobileTicketBar, OfflinePurchaseNote, PurchaseLogin, TicketCard, useTicketPurchase } from "./TicketPanel";

/**
 * Detail acara. Pita 04.
 * Data awal dari server (initial), lalu disegarkan di client supaya status simpan dan kuota terbaru.
 */

function SaveToggle({ event, round }: { event: EventDetailData; round: "outline" | "glass" }) {
  const toggle = useToggleSave();
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <button
      type="button"
      aria-pressed={event.saved}
      aria-label={event.saved ? "Hapus dari Disimpan" : "Simpan acara"}
      onClick={() => {
        if (!me.data) return router.push(`/login?returnTo=${encodeURIComponent(pathname)}`);
        toggle.mutate(
          { slug: event.slug, saved: !event.saved },
          {
            onSuccess: () =>
              toast(event.saved ? "Dihapus dari Disimpan" : "Acara disimpan", {
                id: "saved-toggle",
                icon: <Heart className="size-[18px]" />,
                action: { label: event.saved ? "Batalkan" : "Lihat", onClick: () => (event.saved ? toggle.mutate({ slug: event.slug, saved: true }) : router.push("/saved")) },
              }),
            onError: () => toast.error("Gagal menyimpan acara. Coba lagi."),
          },
        );
      }}
      className={cn(
        "press flex items-center justify-center rounded-full transition-colors",
        round === "outline" ? "size-10 border border-border-strong" : "size-[42px] bg-white/90 text-foreground",
        event.saved && round === "outline" && "border-inverse bg-inverse text-primary",
      )}
    >
      <Heart className={cn("size-[18px]", event.saved && "fill-current")} aria-hidden />
    </button>
  );
}

function ShareButton({ title, round }: { title: string; round: "outline" | "glass" }) {
  return (
    <ShareMenu title={title}>
      <button
        type="button"
        aria-label="Bagikan acara"
        className={cn(
          "press flex items-center justify-center rounded-full",
          round === "outline" ? "size-10 border border-border-strong" : "size-[42px] bg-white/90 text-foreground",
        )}
      >
        <Share2 className="size-[18px]" aria-hidden />
      </button>
    </ShareMenu>
  );
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3.5 pt-2", className)}>
      <h2 className="text-xl font-extrabold tracking-tight md:text-2xl">{title}</h2>
      {children}
    </section>
  );
}

function About({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const paragraphs = text.split(/\n{2,}/).filter(Boolean);
  const long = text.length > 280;
  return (
    <Section title="Tentang acara">
      <div className={cn("flex flex-col gap-3 text-[15px] leading-relaxed text-text-secondary md:text-[17px]", !open && long && "line-clamp-4")}>
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="press w-fit text-sm font-bold md:text-[15px]">
          {open ? "Tutup" : "Baca selengkapnya"}
        </button>
      )}
    </Section>
  );
}

function InfoRow({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 md:gap-3.5 md:rounded-lg md:border md:border-border-strong md:p-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-surface-2 md:size-11 [&_svg]:size-5">{icon}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[15px] font-bold md:text-base">{title}</span>
        <span className="text-[13px] text-text-secondary md:text-sm">{sub}</span>
      </span>
    </div>
  );
}

export function EventDetailView({ initial }: { initial: EventDetailData }) {
  const { data } = useEvent(initial.slug);
  const event = data ?? initial;
  const purchase = useTicketPurchase(event);
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const [reportOpen, setReportOpen] = useState(false);
  const badge = eventBadge({ ...event, startingPrice: null });
  const mapsQuery = encodeURIComponent(`${event.venueName}, ${event.address}`);

  const openReport = () => {
    if (!me.data) return router.push(`/login?returnTo=${encodeURIComponent(pathname)}`);
    setReportOpen(true);
  };

  return (
    <div className="flex w-full flex-col pb-32 md:pb-24">
      {event.status === "cancelled" && (
        <div className="mx-auto w-full max-w-[1440px] px-5 pt-4 md:px-6 xl:px-10">
          <Alert title="Acara ini dibatalkan penyelenggara">Pembeli tiket akan dihubungi melalui email terkait pengembalian dana.</Alert>
        </div>
      )}
      <div className="mx-auto hidden w-full max-w-[1440px] px-6 pt-4 md:block xl:px-10">
        <OfflinePurchaseNote p={purchase} />
      </div>

      {/* Breadcrumb tablet dan desktop */}
      <nav aria-label="Lokasi halaman" className="mx-auto hidden w-full max-w-[1440px] items-center gap-2 px-6 pt-4 text-sm md:flex xl:px-10">
        <Link href="/" className="font-medium text-text-tertiary [@media(hover:hover)]:hover:text-foreground">
          Jelajahi
        </Link>
        <ChevronRight className="size-4 text-text-tertiary" aria-hidden />
        <Link href={`/events?category=${categorySlug(event.category)}`} className="font-medium text-text-tertiary [@media(hover:hover)]:hover:text-foreground">
          {event.category}
        </Link>
        <ChevronRight className="size-4 text-text-tertiary" aria-hidden />
        <span className="truncate font-semibold" aria-current="page">
          {event.title}
        </span>
      </nav>

      <div className="mx-auto grid w-full max-w-[1440px] gap-14 md:px-6 md:pt-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:px-10">
        <article className="flex min-w-0 flex-col gap-6 md:gap-9">
          {/* Poster. Di mobile memenuhi lebar dengan tombol di atasnya. */}
          <div className="relative h-[420px] w-full overflow-hidden bg-surface-2 md:h-[480px] md:rounded-[28px]">
            <Image src={event.poster} alt={`Poster ${event.title}`} fill priority sizes="(min-width: 1280px) 884px, 100vw" className="object-cover" />
            <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))] md:hidden">
              <button
                type="button"
                aria-label="Kembali"
                onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
                className="press flex size-[42px] items-center justify-center rounded-full bg-white/90"
              >
                <ArrowLeft className="size-5" aria-hidden />
              </button>
              <div className="flex gap-2">
                <ShareButton title={event.title} round="glass" />
                <SaveToggle event={event} round="glass" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6 px-5 md:gap-9 md:px-0">
            <div className="md:hidden">
              <OfflinePurchaseNote p={purchase} />
            </div>

            {/* Judul, kategori, penyelenggara */}
            <header className="flex flex-col gap-3 md:gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-surface-2 px-2.5 text-xs font-bold md:h-7 md:px-3 md:text-[13px]">
                  <LayoutGrid className="size-3.5" aria-hidden />
                  {event.category}
                </span>
                {badge && <Badge tone={badge.tone === "inverse" ? "inverse" : badge.tone}>{badge.label}</Badge>}
              </div>
              <h1 className="text-[28px] leading-tight font-extrabold tracking-tight text-balance md:text-[44px]">{event.title}</h1>
              <div className="flex items-center justify-between gap-4 pt-1">
                <Link href={`/organizers/${event.organizer.username}`} className="press flex min-w-0 items-center gap-2.5 md:gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-inverse text-xs font-extrabold text-primary md:size-11 md:text-sm">
                    {initials(event.organizer.name)}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-1 text-sm font-bold md:text-[15px]">
                      {event.organizer.name}
                      <BadgeCheck className="size-4 text-info" aria-label="Terverifikasi" />
                    </span>
                    <span className="text-xs text-text-tertiary md:text-[13px]">
                      <span className="md:hidden">{event.organizer.eventCount} acara diselenggarakan</span>
                      <span className="hidden md:inline">Penyelenggara dengan {event.organizer.eventCount} acara</span>
                    </span>
                  </span>
                </Link>
                <div className="hidden gap-2 md:flex">
                  <ShareButton title={event.title} round="outline" />
                  <SaveToggle event={event} round="outline" />
                </div>
              </div>
            </header>

            {/* Tanggal dan lokasi */}
            <div className="grid gap-4 border-y border-border py-5 md:grid-cols-2 md:border-0 md:py-0">
              <InfoRow
                icon={<CalendarDays />}
                title={formatDateLong(event.startsAt)}
                sub={formatTimeRange(event.startsAt, event.endsAt)}
              />
              <InfoRow icon={<MapPin />} title={event.venueName} sub={event.city} />
            </div>

            {/* Kartu tiket tablet (desktop di kolom kanan, mobile di lembar bawah) */}
            <TicketCard p={purchase} className="hidden md:flex xl:hidden" />

            <About text={event.description} />

            {event.performers.length > 0 && (
              <Section title={event.performerLabel || "Yang akan tampil"}>
                <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
                  {event.performers.map((p) => (
                    <li key={p.name} className="flex w-[150px] shrink-0 flex-col gap-2 md:w-auto md:gap-2.5">
                      <span className="relative aspect-square w-full overflow-hidden rounded-lg bg-surface-2 md:aspect-[284/180]">
                        <Image src={p.photo} alt="" fill sizes="(min-width: 768px) 284px, 150px" className="object-cover" />
                      </span>
                      <span className="flex flex-col">
                        <span className="text-sm font-bold md:text-base">{p.name}</span>
                        <span className="text-xs text-text-tertiary md:text-sm">
                          <span className="md:hidden">{p.time}</span>
                          <span className="hidden md:inline">{p.note ? `${p.note}, ${p.time}` : p.time}</span>
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="Lokasi">
              <div className="relative h-[180px] w-full overflow-hidden rounded-xl bg-surface-2 md:h-[280px]">
                <iframe
                  title={`Peta ${event.venueName}`}
                  src={`https://www.google.com/maps?q=${mapsQuery}&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="absolute inset-0 size-full border-0"
                />
              </div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-bold md:text-base">{event.venueName}</span>
                  <span className="text-[13px] text-text-secondary md:text-sm">{event.address}</span>
                </div>
                <Button asChild variant="outline" className="w-full md:w-auto">
                  <a href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noopener noreferrer">
                    <MapPin className="size-4" aria-hidden />
                    Buka di Google Maps
                  </a>
                </Button>
              </div>
            </Section>

            <Section title="Penyelenggara" className="hidden md:flex">
              <div className="flex items-center gap-[18px] rounded-xl bg-surface p-6">
                <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-inverse text-xl font-extrabold text-primary">
                  {initials(event.organizer.name)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[17px] font-extrabold">{event.organizer.name}</span>
                  <span className="text-sm text-text-secondary">
                    {event.organizer.description ? `${event.organizer.description} ` : ""}
                    {event.organizer.eventCount} acara diselenggarakan.
                  </span>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/organizers/${event.organizer.username}`}>Lihat acara lainnya</Link>
                </Button>
              </div>
            </Section>

            {event.terms.length > 0 && (
              <Section title="Ketentuan tiket">
                <ul className="flex flex-col gap-2">
                  {event.terms.map((t) => (
                    <li key={t} className="flex gap-2.5 text-sm leading-relaxed text-text-secondary md:text-base">
                      <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-text-tertiary md:mt-[10px]" aria-hidden />
                      {t}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={openReport}
                  className="press flex w-fit items-center gap-1.5 pt-2 text-sm font-semibold text-text-secondary [@media(hover:hover)]:hover:text-foreground"
                >
                  <Flag className="size-4" aria-hidden />
                  Laporkan acara ini
                </button>
              </Section>
            )}
          </div>
        </article>

        <aside className="hidden xl:block">
          <TicketCard p={purchase} className="sticky top-24" />
        </aside>
      </div>

      <MobileTicketBar p={purchase} />
      <PurchaseLogin p={purchase} />
      <ReportEventDialog slug={event.slug} open={reportOpen} onOpenChange={setReportOpen} />
    </div>
  );
}
