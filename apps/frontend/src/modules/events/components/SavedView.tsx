"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { HeartOff } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useOnline } from "@/hooks/use-online";
import { useMe } from "@/modules/auth/hooks";
import { useSavedEvents, useToggleSave } from "@/modules/events/hooks";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/elements/Alert";
import { EventCard, EventCardSkeleton, eventBadge, isPast } from "@/components/elements/EventCard";
import { Chip } from "@/components/elements/FilterChips";
import { StateView } from "@/components/elements/StateView";

/**
 * Disimpan. Pita 08.
 * Tamu melihat ajakan masuk (D1), bukan dialihkan. Hapus dari Disimpan menghilangkan kartu
 * dan memunculkan toast dengan Batalkan selama 6 detik (B). Kartu kembali di posisi semula bila dibatalkan.
 */

type Filter = "upcoming" | "past";

function Heading({ sub, filters }: { sub?: string; filters?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-[30px] leading-tight font-extrabold tracking-tight md:text-[40px]">
          <span className="md:hidden">Disimpan</span>
          <span className="hidden md:inline">Acara disimpan</span>
        </h1>
        {sub && <p className="hidden text-[15px] text-text-tertiary md:block">{sub}</p>}
      </div>
      {filters}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-5 pt-[max(24px,env(safe-area-inset-top))] pb-10 md:px-10 md:pt-10 md:pb-24">{children}</div>
  );
}

export function SavedView() {
  const me = useMe();
  const loggedIn = !!me.data;
  const saved = useSavedEvents({ enabled: loggedIn });
  const toggle = useToggleSave();
  const online = useOnline();
  const [filter, setFilter] = useState<Filter>("upcoming");
  /** Kartu yang baru dihapus disembunyikan di sini supaya bisa dikembalikan di posisi yang sama. */
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const toastId = useRef<string | number | undefined>(undefined);

  const { upcoming, past } = useMemo(() => {
    const list = (saved.data?.data ?? []).filter((e) => !removed.has(e.slug));
    return { upcoming: list.filter((e) => !isPast(e)), past: list.filter(isPast) };
  }, [saved.data, removed]);

  const restore = (slug: string) =>
    setRemoved((prev) => {
      const next = new Set(prev);
      next.delete(slug);
      return next;
    });

  const unsave = (slug: string) => {
    setRemoved((prev) => new Set(prev).add(slug));
    toggle.mutate(
      { slug, saved: false },
      { onError: () => (restore(slug), toast.error("Gagal menghapus dari Disimpan. Coba lagi.")) },
    );
    toast.dismiss(toastId.current);
    toastId.current = toast("Dihapus dari Disimpan", {
      icon: <HeartOff className="size-[18px]" />,
      duration: 6000,
      action: {
        label: "Batalkan",
        onClick: () => {
          restore(slug);
          toggle.mutate({ slug, saved: true });
        },
      },
    });
  };

  if (me.isPending) return <SavedSkeleton />;

  if (!loggedIn) {
    return (
      <Shell>
        <h1 className="text-[30px] leading-tight font-extrabold tracking-tight md:sr-only">Disimpan</h1>
        <StateView
          illustration="nothing-saved"
          title="Masuk untuk melihat acara yang disimpan"
          description="Simpan acara dengan ikon hati dan temukan kembali di sini dari perangkat mana pun."
          action={
            <Button asChild>
              <Link href="/login?returnTo=%2Fsaved">Masuk</Link>
            </Button>
          }
        />
      </Shell>
    );
  }

  if (saved.isPending) return <SavedSkeleton />;

  if (saved.isError && !saved.data) {
    return (
      <Shell>
        <Heading />
        <StateView
          tone="error"
          illustration="failed-load"
          title="Daftar acara gagal dimuat"
          description="Periksa koneksi internet Anda, lalu coba lagi."
          action={
            <Button onClick={() => saved.refetch()} loading={saved.isRefetching}>
              Coba lagi
            </Button>
          }
        />
      </Shell>
    );
  }

  const list = filter === "upcoming" ? upcoming : past;
  const nothing = upcoming.length === 0 && past.length === 0;

  const filters = !nothing && (
    <div className="flex gap-2" role="group" aria-label="Saring acara">
      <Chip selected={filter === "upcoming"} onClick={() => setFilter("upcoming")}>
        Akan datang ({upcoming.length})
      </Chip>
      <Chip selected={filter === "past"} onClick={() => setFilter("past")}>
        Sudah lewat ({past.length})
      </Chip>
    </div>
  );

  return (
    <Shell>
      {!online && (
        <Alert tone="offline" title="Anda sedang luring">
          Menampilkan daftar yang terakhir dimuat. Perubahan disimpan setelah koneksi kembali.
        </Alert>
      )}
      <Heading
        sub={
          nothing ? undefined : filter === "upcoming" ? `${upcoming.length} acara akan datang` : `${past.length} acara sudah lewat`
        }
        filters={filters}
      />

      {nothing ? (
        <StateView
          illustration="nothing-saved"
          title="Belum ada acara yang disimpan"
          description="Ketuk ikon hati pada acara yang menarik agar mudah ditemukan lagi di sini."
          action={
            <Button asChild>
              <Link href="/">Jelajahi acara</Link>
            </Button>
          }
        />
      ) : list.length === 0 ? (
        <StateView
          layout="section"
          illustration="nothing-saved"
          title={filter === "upcoming" ? "Tidak ada acara akan datang" : "Belum ada acara yang lewat"}
          description={
            filter === "upcoming"
              ? "Semua acara yang Anda simpan sudah berlangsung."
              : "Acara yang Anda simpan akan muncul di sini setelah berlangsung."
          }
        />
      ) : (
        <>
          {/* Tablet dan desktop: grid kartu */}
          <ul className="hidden gap-6 md:grid md:grid-cols-2 xl:grid-cols-4">
            {list.map((event, i) => (
              <li key={event.slug} className="animate-in fade-in duration-200">
                <EventCard
                  event={{ ...event, saved: true }}
                  dimmed={filter === "past"}
                  onSaveChange={() => unsave(event.slug)}
                  priority={i < 4}
                />
              </li>
            ))}
          </ul>
          {/* Mobile: daftar baris */}
          <ul className="flex flex-col gap-4 md:hidden">
            {list.map((event, i) => (
              <li key={event.slug}>
                <EventCard
                  layout="row"
                  badge={eventBadge(event)}
                  event={{ ...event, saved: true }}
                  dimmed={filter === "past"}
                  onSaveChange={() => unsave(event.slug)}
                  priority={i < 4}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </Shell>
  );
}

function SavedSkeleton() {
  return (
    <Shell>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between" aria-busy>
        <div className="flex flex-col gap-2">
          <span className="text-[30px] leading-tight font-extrabold tracking-tight md:text-[40px]">
            <span className="md:hidden">Disimpan</span>
            <span className="hidden md:inline">Acara disimpan</span>
          </span>
          <span className="skeleton hidden h-4 w-36 rounded md:block" />
        </div>
        <div className="flex gap-2">
          <span className="skeleton h-9 w-32 rounded-full" />
          <span className="skeleton h-9 w-32 rounded-full" />
        </div>
      </div>
      <div className={cn("hidden gap-6 md:grid md:grid-cols-2 xl:grid-cols-4")}>
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
