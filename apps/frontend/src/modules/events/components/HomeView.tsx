import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/elements/EventCard";
import { CATEGORIES } from "@/modules/events/categories";
import type { EventCard as EventCardData } from "@/modules/events/types";

import { HomeOffline, HomeSearch } from "./HomeSearch";

/**
 * Beranda dan Jelajahi. Pita 03 baris A.
 * Dirender di server. Kolom cari, filter, dan tombol simpan adalah komponen client di dalamnya.
 */

type HomeViewProps = {
  featured: EventCardData[];
  thisWeek: EventCardData[];
  affordable: EventCardData[];
};

const QUICK = [
  { label: "Hari ini", href: "/events?date=today" },
  { label: "Minggu ini", href: "/events?date=week" },
  { label: "Gratis", href: "/events?minPrice=0&maxPrice=0" },
  { label: "Dekat kampus", href: "/events?area=campus" },
];

/** Ukuran poster bergantian supaya pita poster terasa seperti kolase (sesuai frame "Poster band"). */
const POSTER_SIZES = [
  { w: "w-[160px] md:w-[200px]", h: "h-[200px] md:h-[260px]" },
  { w: "w-[200px] md:w-[300px]", h: "h-[230px] md:h-[290px]" },
  { w: "w-[160px] md:w-[230px]", h: "h-[200px] md:h-[250px]" },
  { w: "w-[200px] md:w-[320px]", h: "h-[230px] md:h-[310px]" },
];

const shortDay = (iso: string) => format(new Date(iso), "EEE, d MMM", { locale: localeId });

const CHIP =
  "press inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors";

function PosterStrip({ events }: { events: EventCardData[] }) {
  if (events.length === 0) return null;
  return (
    <section aria-label="Acara pilihan" className="w-full">
      <ul className="flex snap-x scroll-px-5 items-end justify-center-safe gap-3.5 overflow-x-auto px-5 pt-6 md:scroll-px-6 xl:scroll-px-10 pb-1 [scrollbar-width:none] md:gap-5 md:px-6 md:pt-2 xl:px-10 [&::-webkit-scrollbar]:hidden">
        {events.map((event, i) => {
          const size = POSTER_SIZES[i % POSTER_SIZES.length];
          return (
            <li key={event.slug} className={cn("shrink-0 snap-start", size.w)}>
              <Link href={`/events/${event.slug}`} className="group flex flex-col gap-2.5 md:gap-3">
                <span className={cn("relative block overflow-hidden rounded-[20px] bg-surface-2 md:rounded-xl", size.h)}>
                  <Image
                    src={event.poster}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 320px, 200px"
                    priority={i < 3}
                    className="object-cover transition-transform duration-200 ease-out [@media(hover:hover)]:group-hover:scale-[1.03]"
                  />
                  <span className="absolute top-2.5 left-2.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-foreground md:top-3 md:left-3 md:text-xs">
                    {event.category}
                  </span>
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="truncate text-[15px] font-bold md:text-base">{event.title}</span>
                  <span className="text-xs font-medium text-text-secondary md:text-sm">{shortDay(event.startsAt)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SectionHeader({ title, sub, href }: { title: string; sub: string; href: string }) {
  return (
    <div className="flex items-end justify-between gap-4 px-5 md:px-0">
      <div className="flex flex-col gap-0.5 md:gap-1">
        <h2 className="text-[22px] leading-tight font-extrabold tracking-tight md:text-[28px]">{title}</h2>
        <p className="text-[13px] text-text-tertiary md:text-sm">{sub}</p>
      </div>
      <Link href={href} className="press shrink-0 text-sm font-bold md:hidden">
        Lihat semua
      </Link>
      <Button asChild variant="outline" className="hidden md:inline-flex">
        <Link href={href}>
          Lihat semua
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Button>
    </div>
  );
}

function Section({ children }: { children: ReactNode }) {
  return <section className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 pt-9 md:gap-5 md:px-6 md:pt-8 xl:px-10">{children}</section>;
}

function CardGrid({ events }: { events: EventCardData[] }) {
  return (
    <ul className="hidden gap-6 md:grid md:grid-cols-2 xl:grid-cols-4">
      {events.map((event) => (
        <li key={event.slug}>
          <EventCard event={event} />
        </li>
      ))}
    </ul>
  );
}

export function HomeView({ featured, thisWeek, affordable }: HomeViewProps) {
  return (
    <div className="flex w-full flex-col pb-14 md:pb-20">
      <HomeOffline />

      {/* Judul, kolom cari, dan pilihan cepat */}
      <section className="mx-auto flex w-full max-w-[1440px] flex-col items-start gap-3.5 px-5 pt-7 md:items-center md:gap-5 md:px-6 md:pt-16 md:pb-10 md:text-center xl:px-10">
        <h1 className="max-w-[900px] text-[34px] leading-[1.05] font-extrabold tracking-tight text-balance md:text-[50px] xl:text-[64px]">
          <span className="md:hidden">Temukan acara di sekitar Anda</span>
          <span className="hidden md:inline">Temukan acara komunitas di sekitar Anda</span>
        </h1>
        <p className="max-w-[640px] text-[15px] leading-relaxed text-text-secondary md:text-lg">
          <span className="md:hidden">Konser, lokakarya, lari malam, hingga temu komunitas di Yogyakarta.</span>
          <span className="hidden md:inline">Konser kecil, workshop, lari malam, sampai meetup di Yogyakarta. Pesan tiket dalam semenit.</span>
        </p>
        <HomeSearch />
        <nav aria-label="Pilihan cepat" className="-mx-5 flex max-w-[100vw] gap-2 overflow-x-auto px-5 pt-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
          {QUICK.map((q) => (
            <Link key={q.href} href={q.href} className={cn(CHIP, "h-[34px] border-border-strong bg-background [@media(hover:hover)]:hover:bg-surface")}>
              {q.label}
            </Link>
          ))}
        </nav>
      </section>

      <PosterStrip events={featured} />

      {/* Kategori */}
      <nav
        aria-label="Kategori"
        className="mx-auto flex w-full max-w-[1440px] gap-2 overflow-x-auto px-5 pt-7 [scrollbar-width:none] md:px-6 md:pt-12 xl:px-10 [&::-webkit-scrollbar]:hidden"
      >
        <Link href="/events" className={cn(CHIP, "border-inverse bg-inverse text-inverse-foreground")}>
          Semua
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/events?category=${c.slug}`}
            className={cn(CHIP, "border-border-strong bg-background [@media(hover:hover)]:hover:bg-surface")}
          >
            {c.name}
          </Link>
        ))}
      </nav>

      {thisWeek.length > 0 && (
        <Section>
          <SectionHeader title="Minggu ini di Yogyakarta" sub="Diurutkan dari yang paling dekat" href="/events?date=week" />
          <CardGrid events={thisWeek} />
          <ul className="flex flex-col gap-4 px-5 md:hidden">
            {thisWeek.map((event) => (
              <li key={event.slug}>
                <EventCard layout="row" event={event} showSave={false} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {affordable.length > 0 && (
        <Section>
          <SectionHeader title="Gratis & terjangkau" sub="Pilihan hemat untuk akhir bulan" href="/events?maxPrice=50000&sort=price_asc" />
          <CardGrid events={affordable} />
          <ul className="flex snap-x scroll-px-5 gap-3.5 overflow-x-auto px-5 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
            {affordable.map((event) => (
              <li key={event.slug} className="w-[240px] shrink-0 snap-start">
                <EventCard event={event} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
