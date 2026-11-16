"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, CalendarDays, Globe, Link2, Mail, MapPin, Share2, Ticket } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { useOnline } from "@/hooks/use-online";
import { useMe } from "@/modules/auth/hooks";
import { useOrganizerProfile } from "@/modules/events/hooks";
import type { EventCard as EventCardData, OrganizerProfile } from "@/modules/events/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert } from "@/components/elements/Alert";
import { initials } from "@/components/elements/AccountMenu";
import { InstagramIcon, TikTokIcon } from "@/components/elements/BrandIcons";
import { EventCard, EventCardSkeleton } from "@/components/elements/EventCard";
import { StateView } from "@/components/elements/StateView";

/**
 * Profil publik penyelenggara. Pita 09.
 * Dibuka dari nama penyelenggara di detail acara. Tab acara akan datang dan sudah lewat,
 * tombol bagikan menyalin tautan (C2) atau membuka lembar bagikan di ponsel.
 */

type Tab = "upcoming" | "past";

const LINK_META: Record<string, { label: string; icon: ReactNode; display: (url: string) => string }> = {
  instagram: { label: "Instagram", icon: <InstagramIcon className="size-4" />, display: (u) => `@${u.split("/").filter(Boolean).pop()}` },
  tiktok: { label: "TikTok", icon: <TikTokIcon className="size-4" />, display: (u) => u.split("/").filter(Boolean).pop() ?? u },
  website: { label: "Website", icon: <Globe className="size-4" />, display: (u) => u.replace(/^https?:\/\//, "").replace(/\/$/, "") },
  email: { label: "Email", icon: <Mail className="size-4" />, display: () => "Email" },
};

const hrefOf = (type: string, url: string) => (type === "email" ? `mailto:${url}` : /^https?:\/\//.test(url) ? url : `https://${url}`);

function Shell({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-5 pt-[max(8px,env(safe-area-inset-top))] pb-10 md:px-10 md:pt-12 md:pb-24">{children}</div>;
}

function ShareButton({ name, className }: { name: string; className?: string }) {
  const share = async () => {
    const url = window.location.href;
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: `${name} di Gatherly`, url });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Tautan profil disalin", { icon: <Link2 className="size-[18px]" /> });
    } catch {
      toast.error("Gagal menyalin tautan. Salin dari kolom alamat browser.");
    }
  };
  return (
    <button
      type="button"
      onClick={share}
      aria-label="Bagikan profil"
      className={cn("press flex size-11 shrink-0 items-center justify-center rounded-full", className)}
    >
      <Share2 className="size-5" aria-hidden />
    </button>
  );
}

function MobileHeader({ name }: { name: string }) {
  const router = useRouter();
  return (
    <div className="-mx-3 flex items-center justify-between py-1 md:hidden">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
        aria-label="Kembali"
        className="press flex size-11 items-center justify-center rounded-full"
      >
        <ArrowLeft className="size-6" aria-hidden />
      </button>
      <ShareButton name={name} />
    </div>
  );
}

function ProfileHeader({ profile }: { profile: OrganizerProfile }) {
  return (
    <section className="flex flex-col gap-3 pt-2 pb-5 md:flex-row md:gap-8 md:border-b md:border-border md:pt-0 md:pb-10">
      <div
        className="flex size-[88px] shrink-0 items-center justify-center rounded-[26px] bg-inverse text-[30px] font-extrabold text-primary md:size-[132px] md:rounded-[36px] md:text-[44px]"
        aria-hidden
      >
        {initials(profile.name)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <h1 className="flex items-center gap-2 pt-1 text-2xl leading-tight font-extrabold tracking-tight md:pt-0 md:text-[44px]">
            {profile.name}
            <BadgeCheck className="size-5 shrink-0 text-info md:hidden" aria-label="Penyelenggara terverifikasi" />
          </h1>
          <ShareButton name={profile.name} className="hidden border border-border-strong md:flex" />
        </div>

        <p className="text-sm text-text-secondary md:hidden">
          {profile.city}, sejak {profile.since}, {profile.eventCount} acara
        </p>
        <ul className="hidden flex-wrap items-center gap-x-[18px] gap-y-1 text-[15px] font-medium text-text-secondary md:flex">
          <li className="flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden />
            {profile.city}
          </li>
          <li className="flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden />
            Aktif sejak {profile.since}
          </li>
          <li className="flex items-center gap-1.5">
            <Ticket className="size-4" aria-hidden />
            {profile.eventCount} acara diselenggarakan
          </li>
        </ul>

        {profile.description && (
          <p className="max-w-[760px] text-[15px] leading-relaxed text-text-secondary md:text-[17px]">{profile.description}</p>
        )}

        {profile.links.length > 0 && (
          <ul className="flex flex-wrap gap-2 pt-1">
            {profile.links.map((link) => {
              const meta = LINK_META[link.type] ?? LINK_META.website;
              return (
                <li key={link.type + link.url}>
                  <a
                    href={hrefOf(link.type, link.url)}
                    target={link.type === "email" ? undefined : "_blank"}
                    rel="noopener noreferrer"
                    className="press inline-flex h-10 items-center gap-2 rounded-full border border-border-strong px-3.5 text-[13px] font-bold [@media(hover:hover)]:hover:bg-surface"
                  >
                    {meta.icon}
                    <span className="md:hidden">{meta.label}</span>
                    <span className="hidden md:inline">{meta.display(link.url)}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function TabLabel({ label, count, active }: { label: string; count: number; active: boolean }) {
  return (
    <>
      <span className="md:hidden">
        {label}, {count}
      </span>
      <span className="hidden md:inline">{label}</span>
      <span
        className={cn(
          "hidden h-[22px] min-w-[22px] items-center justify-center rounded-full px-2 text-xs font-extrabold md:inline-flex",
          active ? "bg-inverse text-inverse-foreground" : "bg-surface-2 text-text-secondary",
        )}
      >
        {count}
      </span>
    </>
  );
}

const TRIGGER =
  "min-w-0 flex-1 justify-center rounded-full border-b-0 py-0 h-[38px] text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm md:h-auto md:flex-none md:rounded-none md:border-b-2 md:py-3 md:text-base md:data-[state=active]:bg-transparent md:data-[state=active]:shadow-none";

function EventList({ events, onSave }: { events: EventCardData[]; onSave?: (slug: string) => void }) {
  return (
    <>
      <ul className="hidden gap-6 md:grid md:grid-cols-2 xl:grid-cols-4">
        {events.map((event, i) => (
          <li key={event.slug}>
            <EventCard event={event} priority={i < 4} onSaveChange={onSave ? () => onSave(event.slug) : undefined} />
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-4 md:hidden">
        {events.map((event, i) => (
          <li key={event.slug}>
            <EventCard layout="row" event={event} showSave={false} priority={i < 4} />
          </li>
        ))}
      </ul>
    </>
  );
}

export function OrganizerProfileView({ username }: { username: string }) {
  const profile = useOrganizerProfile(username);
  const me = useMe();
  const online = useOnline();
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>("upcoming");

  if (profile.isPending) return <ProfileSkeleton />;

  if (profile.isError && !profile.data) {
    const notFound = profile.error instanceof ApiError && profile.error.status === 404;
    return (
      <Shell>
        <StateView
          tone={notFound ? "neutral" : "error"}
          illustration={notFound ? "not-found" : "failed-load"}
          title={notFound ? "Penyelenggara tidak ditemukan" : "Profil gagal dimuat"}
          description={notFound ? "Profil ini tidak ada atau sudah dinonaktifkan." : "Periksa koneksi internet Anda, lalu coba lagi."}
          action={
            notFound ? (
              <Button asChild>
                <Link href="/">Jelajahi acara</Link>
              </Button>
            ) : (
              <Button onClick={() => profile.refetch()} loading={profile.isRefetching}>
                Coba lagi
              </Button>
            )
          }
        />
      </Shell>
    );
  }

  const data = profile.data;
  /** Tamu yang menekan hati diarahkan ke Masuk, lalu kembali ke profil ini. */
  const guestSave = me.data ? undefined : () => router.push(`/login?returnTo=${encodeURIComponent(pathname)}`);

  return (
    <Shell>
      <MobileHeader name={data.name} />
      {!online && (
        <Alert tone="offline" title="Anda sedang luring" className="mb-6">
          Menampilkan profil yang terakhir dimuat.
        </Alert>
      )}
      <ProfileHeader profile={data} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-5 md:gap-6 md:pt-10">
        <TabsList className="w-full gap-1 rounded-full bg-surface-2 p-1 md:w-auto md:gap-7 md:rounded-none md:bg-transparent md:p-0">
          <TabsTrigger value="upcoming" className={TRIGGER}>
            <TabLabel label="Akan datang" count={data.upcoming.length} active={tab === "upcoming"} />
          </TabsTrigger>
          <TabsTrigger value="past" className={TRIGGER}>
            <TabLabel label="Sudah lewat" count={data.past.length} active={tab === "past"} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          {data.upcoming.length > 0 ? (
            <EventList events={data.upcoming} onSave={guestSave} />
          ) : (
            <StateView
              layout="section"
              illustration="no-events"
              title="Belum ada acara mendatang"
              description="Lihat acara yang pernah diselenggarakan di tab Sudah lewat."
              action={
                data.past.length > 0 ? (
                  <Button variant="outline" onClick={() => setTab("past")}>
                    Lihat acara yang sudah lewat
                  </Button>
                ) : undefined
              }
            />
          )}
        </TabsContent>
        <TabsContent value="past">
          {data.past.length > 0 ? (
            <EventList events={data.past} onSave={guestSave} />
          ) : (
            <StateView
              layout="section"
              illustration="no-events"
              title="Belum ada acara yang lewat"
              description="Acara yang sudah berlangsung akan tampil di sini."
            />
          )}
        </TabsContent>
      </Tabs>
    </Shell>
  );
}

function ProfileSkeleton() {
  return (
    <Shell>
      <div className="flex flex-col gap-3 pt-14 pb-5 md:flex-row md:gap-8 md:pt-0 md:pb-10" aria-busy>
        <span className="skeleton size-[88px] rounded-[26px] md:size-[132px] md:rounded-[36px]" />
        <div className="flex flex-1 flex-col gap-3 md:pt-2">
          <span className="skeleton h-8 w-56 rounded md:h-11 md:w-80" />
          <span className="skeleton h-4 w-64 rounded" />
          <span className="skeleton h-4 w-full max-w-[640px] rounded" />
        </div>
      </div>
      <div className="hidden gap-6 pt-10 md:grid md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <EventCardSkeleton key={i} />
        ))}
      </div>
      <div className="flex flex-col gap-4 md:hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <EventCardSkeleton key={i} layout="row" />
        ))}
      </div>
    </Shell>
  );
}
