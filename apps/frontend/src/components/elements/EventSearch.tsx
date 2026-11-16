"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, History, LayoutGrid, MapPin, Search, X } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { useEventSuggestions } from "@/modules/events/hooks";
import { CATEGORIES } from "@/modules/events/categories";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * Pencarian acara. Pita 03 baris B.
 * - SearchBar: kolom cari besar di beranda dan hasil (tablet dan desktop), dengan dropdown saran.
 * - MobileSearch: layar cari penuh di mobile, dibuka dari tombol pil.
 * Kata kunci terakhir disimpan di perangkat (localStorage). Saran datang dari eventsApi.suggest.
 */

const RECENT_KEY = "gatherly:recent-searches";
const CITY = "Yogyakarta";

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function rememberSearch(q: string) {
  const term = q.trim();
  if (!term) return;
  try {
    const next = [term, ...readRecent().filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* penyimpanan tidak tersedia, abaikan */
  }
}

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

const searchHref = (q: string) => `/events?q=${encodeURIComponent(q.trim())}`;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-2.5 pt-2 pb-1 text-[13px] font-bold text-text-tertiary">{title}</p>
      {children}
    </div>
  );
}

const ITEM =
  "press flex w-full items-center gap-3 rounded-md px-2.5 py-2.5 text-left text-[15px] font-medium text-foreground outline-none [@media(hover:hover)]:hover:bg-surface focus-visible:bg-surface";

/** Isi saran. Kosong: pencarian terakhir dan kategori populer. Mengetik: saran, acara, kategori. */
function SuggestionList({ q, onNavigate }: { q: string; onNavigate: (href: string, term?: string) => void }) {
  const term = useDebounced(q.trim());
  const typing = term.length >= 2;
  const suggestions = useEventSuggestions(term);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(readRecent()), []);

  if (!typing) {
    return (
      <>
        {recent.length > 0 && (
          <Group title="Pencarian terakhir">
            {recent.slice(0, 3).map((t) => (
              <button key={t} type="button" className={ITEM} onClick={() => onNavigate(searchHref(t), t)}>
                <History className="size-[18px] text-text-tertiary" aria-hidden />
                {t}
              </button>
            ))}
          </Group>
        )}
        <Group title="Kategori populer">
          {CATEGORIES.slice(0, 4).map((c) => (
            <button key={c.slug} type="button" className={ITEM} onClick={() => onNavigate(`/events?category=${c.slug}`)}>
              <LayoutGrid className="size-[18px] text-text-tertiary" aria-hidden />
              {c.name}
            </button>
          ))}
        </Group>
      </>
    );
  }

  const data = suggestions.data;
  return (
    <>
      {data && data.keywords.length > 0 && (
        <Group title="Saran">
          {data.keywords.map((k, i) => (
            <button
              key={k}
              type="button"
              className={cn(ITEM, i === 0 && "font-bold")}
              onClick={() => onNavigate(searchHref(k), k)}
            >
              <Search className="size-[18px] text-text-tertiary" aria-hidden />
              {k}
            </button>
          ))}
        </Group>
      )}
      {data && data.events.length > 0 && (
        <Group title="Acara">
          {data.events.map((e) => (
            <button key={e.slug} type="button" className={cn(ITEM, "py-2")} onClick={() => onNavigate(`/events/${e.slug}`)}>
              <span className="relative size-11 shrink-0 overflow-hidden rounded-md bg-surface-2">
                <Image src={e.poster} alt="" fill sizes="44px" className="object-cover" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-bold">{e.title}</span>
                <span className="truncate text-[13px] font-normal text-text-secondary">
                  {format(new Date(e.startsAt), "EEE, d MMM", { locale: localeId })}, {e.venueName}
                </span>
              </span>
            </button>
          ))}
        </Group>
      )}
      {data && data.categories.length > 0 && (
        <Group title="Kategori">
          {data.categories.slice(0, 2).map((c) => (
            <button
              key={c.slug}
              type="button"
              className={ITEM}
              onClick={() => onNavigate(`/events?q=${encodeURIComponent(term)}&category=${c.slug}`, term)}
            >
              <LayoutGrid className="size-[18px] text-text-tertiary" aria-hidden />
              <span className="flex flex-col">
                <span>
                  {term.charAt(0).toUpperCase() + term.slice(1)} dalam kategori {c.name}
                </span>
                <span className="text-[13px] font-normal text-text-tertiary">{c.count} acara</span>
              </span>
            </button>
          ))}
        </Group>
      )}
      {data && data.keywords.length + data.events.length === 0 && (
        <p className="px-2.5 py-3 text-sm text-text-secondary">Belum ada saran untuk “{term}”.</p>
      )}
      <button type="button" className={cn(ITEM, "font-bold")} onClick={() => onNavigate(searchHref(term), term)}>
        <ArrowRight className="size-[18px]" aria-hidden />
        Lihat semua hasil untuk “{term}”
      </button>
    </>
  );
}

/** Kolom cari besar. Tablet dan desktop. */
export function SearchBar({ defaultValue = "", className }: { defaultValue?: string; className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => setQ(defaultValue), [defaultValue]);

  const go = (href: string, term?: string) => {
    if (term) rememberSearch(term);
    setOpen(false);
    router.push(href);
  };

  return (
    <div
      ref={wrap}
      className={cn("relative w-full", className)}
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) go(searchHref(q), q);
        }}
        className={cn(
          "flex h-14 items-center gap-3 rounded-full border bg-background py-1.5 pr-1.5 pl-5 transition-[border-color,box-shadow] duration-150",
          open ? "border-foreground shadow-[0_8px_24px_rgba(17,17,19,0.08)]" : "border-border-strong",
        )}
      >
        <Search className="size-5 shrink-0 text-text-tertiary" aria-hidden />
        <label htmlFor={`${listId}-q`} className="sr-only">
          Cari acara
        </label>
        <input
          id={`${listId}-q`}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
          enterKeyHint="search"
          aria-expanded={open}
          aria-controls={listId}
          placeholder="Cari acara, pengisi acara, atau komunitas"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium text-foreground outline-none placeholder:text-text-tertiary"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Hapus kata kunci"
            className="press flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
        <span className="hidden h-6 w-px bg-border md:block" aria-hidden />
        <span className="hidden shrink-0 items-center gap-2.5 pr-2 text-[15px] font-semibold md:flex">
          <MapPin className="size-5 text-text-tertiary" aria-hidden />
          {CITY}
        </span>
        <Button type="submit" size="sm" className="h-11 px-5">
          Cari
        </Button>
      </form>

      {open && (
        <div
          id={listId}
          className="absolute top-[calc(100%+8px)] right-0 left-0 z-40 flex max-h-[420px] flex-col gap-0.5 overflow-y-auto rounded-[20px] border border-border bg-background p-3.5 text-left shadow-[0_16px_40px_rgba(17,17,19,0.12)] animate-in fade-in-0 slide-in-from-top-1 duration-150"
        >
          <SuggestionList q={q} onNavigate={go} />
        </div>
      )}
    </div>
  );
}

/** Pencarian di mobile. Tombol pil yang membuka layar cari penuh (pita 03 B2 mobile). */
export function MobileSearch({
  value = "",
  placeholder = `Cari acara di ${CITY}`,
  className,
}: {
  value?: string;
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(value);

  const go = (href: string, term?: string) => {
    if (term) rememberSearch(term);
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setQ(value);
          setOpen(true);
        }}
        className={cn(
          "press flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-border-strong bg-background px-4 text-left text-[15px]",
          className,
        )}
      >
        <Search className="size-5 shrink-0 text-text-tertiary" aria-hidden />
        <span className={cn("truncate", value ? "font-bold text-foreground" : "font-medium text-text-tertiary")}>
          {value || placeholder}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-0 left-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 data-[state=open]:slide-in-from-bottom-2"
        >
          <DialogTitle className="sr-only">Cari acara</DialogTitle>
          <form
            role="search"
            className="flex items-center gap-1 pt-[max(4px,env(safe-area-inset-top))] pr-4 pb-2 pl-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) go(searchHref(q), q);
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup pencarian"
              className="press flex size-11 shrink-0 items-center justify-center rounded-full"
            >
              <ArrowLeft className="size-6" aria-hidden />
            </button>
            <div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full border border-foreground pr-2 pl-4">
              <label htmlFor="mobile-q" className="sr-only">
                Cari acara
              </label>
              <input
                id="mobile-q"
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                enterKeyHint="search"
                autoComplete="off"
                placeholder={placeholder}
                className="h-full min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:font-medium placeholder:text-text-tertiary"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="Hapus kata kunci"
                  className="press flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2"
                >
                  <X className="size-4" aria-hidden />
                </button>
              )}
            </div>
          </form>
          <div className="px-4 pb-2">
            <span className="inline-flex h-[34px] items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[13px] font-bold">
              <MapPin className="size-4" aria-hidden />
              {CITY}
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto border-t border-border px-3 py-3">
            <SuggestionList q={q} onNavigate={go} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Tombol kembali bulat 44 px untuk header mobile. */
export function BackButton({ href }: { href?: string }) {
  const router = useRouter();
  const cls = "press flex size-11 shrink-0 items-center justify-center rounded-full";
  if (href)
    return (
      <Link href={href} aria-label="Kembali" className={cls}>
        <ArrowLeft className="size-6" aria-hidden />
      </Link>
    );
  return (
    <button type="button" aria-label="Kembali" className={cls} onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}>
      <ArrowLeft className="size-6" aria-hidden />
    </button>
  );
}
