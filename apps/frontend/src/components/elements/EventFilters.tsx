"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, CalendarDays, LayoutGrid, MapPin, SlidersHorizontal, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useEvents } from "@/modules/events/hooks";
import { ALL_CITIES } from "@/modules/events/city";
import { ALL_CITY_VALUE, useCityCookie, useCityOptions, writeCityCookie } from "@/modules/events/use-city";
import { Combobox } from "@/components/elements/Combobox";
import { CATEGORIES, DATE_OPTIONS, categoryName, dateLabel } from "@/modules/events/categories";
import type { EventQuery } from "@/modules/events/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Chip, priceRangeLabel, type PriceRange } from "@/components/elements/FilterChips";

/**
 * Filter acara di hasil pencarian dan kategori. Pita 03 baris C dan D.
 * Semua filter tersimpan di URL: /events?q=jazz&category=musik&date=week&minPrice=50000&sort=price_asc&city=Kota%20Yogyakarta
 * Kota tanpa ?city= diambil dari pilihan terakhir pembeli (cookie, lihat modules/events/city.ts).
 */

export type Filters = Omit<EventQuery, "page" | "limit">;

const NUM = (v: string | null) => (v === null || v === "" ? undefined : Number(v));

/** Membaca dan mengubah filter di URL. */
export function useEventFilters() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const cookieCity = useCityCookie();

  const filters: Filters = {
    q: search.get("q") || undefined,
    city: search.get("city") || cookieCity,
    category: search.get("category") || undefined,
    date: (search.get("date") as Filters["date"]) || undefined,
    area: (search.get("area") as Filters["area"]) || undefined,
    minPrice: NUM(search.get("minPrice")),
    maxPrice: NUM(search.get("maxPrice")),
    sort: (search.get("sort") as Filters["sort"]) || undefined,
  };

  const set = (next: Filters) => {
    if (next.city !== filters.city) writeCityCookie(next.city);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const update = (patch: Partial<Filters>) => set({ ...filters, ...patch });

  /** Jumlah filter aktif selain kata kunci dan urutan, untuk angka di tombol filter mobile. */
  const activeCount =
    (filters.category ? 1 : 0) +
    (filters.city ? 1 : 0) +
    (filters.date ? 1 : 0) +
    (filters.area ? 1 : 0) +
    (filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0);

  return { filters, set, update, activeCount };
}

/** Chip filter aktif yang bisa dihapus satu per satu (baris "Active filters"). */
export function ActiveFilters({ filters, onChange, className }: { filters: Filters; onChange: (f: Filters) => void; className?: string }) {
  const items: { key: string; label: string; clear: Partial<Filters> }[] = [];
  if (filters.date) items.push({ key: "date", label: dateLabel(filters.date) ?? filters.date, clear: { date: undefined } });
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined)
    items.push({
      key: "price",
      label: priceRangeLabel({ min: filters.minPrice, max: filters.maxPrice }),
      clear: { minPrice: undefined, maxPrice: undefined },
    });
  if (filters.category)
    items.push({ key: "category", label: categoryName(filters.category) ?? filters.category, clear: { category: undefined } });
  if (filters.area) items.push({ key: "area", label: "Dekat kampus", clear: { area: undefined } });
  if (filters.city) items.push({ key: "city", label: filters.city, clear: { city: undefined } });
  if (items.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange({ ...filters, ...item.clear })}
          aria-label={`Hapus filter ${item.label}`}
          className="press inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 pr-2 pl-3 text-[13px] font-semibold"
        >
          {item.label}
          <X className="size-3.5" aria-hidden />
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange({ q: filters.q, sort: filters.sort })}
        className="press px-1 text-[13px] font-bold underline-offset-4 [@media(hover:hover)]:hover:underline"
      >
        Hapus semua
      </button>
    </div>
  );
}

/** Chip dengan menu pilihan tunggal. Dipakai untuk tanggal, kategori, dan urutan. */
function MenuChip({
  icon,
  label,
  selected,
  value,
  options,
  onChange,
  allLabel,
  align = "start",
}: {
  icon?: ReactNode;
  label: string;
  selected: boolean;
  value?: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
  allLabel?: string;
  align?: "start" | "end";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Chip selected={selected} leading={icon} hasMenu>
          {label}
        </Chip>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[200px]">
        <DropdownMenuRadioGroup value={value ?? ""} onValueChange={(v) => onChange(v || undefined)}>
          {allLabel && <DropdownMenuRadioItem value="">{allLabel}</DropdownMenuRadioItem>}
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const SORT_OPTIONS = [
  { value: "date_asc", label: "Waktu terdekat" },
  { value: "price_asc", label: "Harga terendah" },
] as const;

export function DateChip({ filters, onChange }: { filters: Filters; onChange: (f: Partial<Filters>) => void }) {
  return (
    <MenuChip
      icon={<CalendarDays className="size-4" aria-hidden />}
      label={dateLabel(filters.date) ?? "Tanggal"}
      selected={!!filters.date}
      value={filters.date}
      options={DATE_OPTIONS}
      allLabel="Semua tanggal"
      onChange={(v) => onChange({ date: v as Filters["date"] })}
    />
  );
}

export function CategoryChip({ filters, onChange }: { filters: Filters; onChange: (f: Partial<Filters>) => void }) {
  return (
    <MenuChip
      icon={<LayoutGrid className="size-4" aria-hidden />}
      label={categoryName(filters.category) ?? "Kategori"}
      selected={!!filters.category}
      value={filters.category}
      options={CATEGORIES.map((c) => ({ value: c.slug, label: c.name }))}
      allLabel="Semua kategori"
      onChange={(v) => onChange({ category: v })}
    />
  );
}

export function SortChip({ filters, onChange }: { filters: Filters; onChange: (f: Partial<Filters>) => void }) {
  const current = SORT_OPTIONS.find((o) => o.value === (filters.sort ?? "date_asc"))!;
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm text-text-tertiary xl:inline">Urutkan</span>
      <MenuChip
        icon={<ArrowUpDown className="size-4 xl:hidden" aria-hidden />}
        label={current.label}
        selected={false}
        value={current.value}
        options={SORT_OPTIONS}
        align="end"
        onChange={(v) => onChange({ sort: (v as Filters["sort"]) ?? "date_asc" })}
      />
    </div>
  );
}

/** Pilihan harga di panel filter. Label sesuai lembar filter mobile (pita 03 C2 mobile). */
const PRICE_CHOICES: { label: string; range: PriceRange }[] = [
  { label: "Gratis", range: { min: 0, max: 0 } },
  { label: "Di bawah Rp50rb", range: { max: 50000 } },
  { label: "Rp50rb sampai 150rb", range: { min: 50000, max: 150000 } },
  { label: "Di atas Rp150rb", range: { min: 150000 } },
];

const sameRange = (a: PriceRange, b: PriceRange) => a.min === b.min && a.max === b.max;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="pb-2.5 text-[15px] font-bold">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function PanelBody({
  initial,
  onApply,
  Title,
}: {
  initial: Filters;
  onApply: (f: Filters) => void;
  /** DialogTitle atau DrawerTitle, sesuai wadah. */
  Title: typeof DialogTitle | typeof DrawerTitle;
}) {
  const [draft, setDraft] = useState<Filters>(initial);
  const count = useEvents({ ...draft, limit: 1 });
  const cityOptions = useCityOptions(draft.city);
  const total = count.data?.meta.total;
  const price: PriceRange = { min: draft.minPrice, max: draft.maxPrice };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-5 pt-1 pb-4 md:px-6 md:pt-6">
        <Title className="text-xl">Filter</Title>
        <button
          type="button"
          onClick={() => setDraft({ q: draft.q, sort: draft.sort })}
          className="press text-sm font-bold underline-offset-4 [@media(hover:hover)]:hover:underline"
        >
          Reset
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-2 md:px-6">
        <Section title="Tanggal">
          {DATE_OPTIONS.map((d) => (
            <Chip
              key={d.value}
              selected={draft.date === d.value}
              onClick={() => setDraft((f) => ({ ...f, date: f.date === d.value ? undefined : d.value }))}
            >
              {d.label}
            </Chip>
          ))}
        </Section>
        <Section title="Harga">
          {PRICE_CHOICES.map((p) => (
            <Chip
              key={p.label}
              selected={sameRange(price, p.range)}
              onClick={() =>
                setDraft((f) =>
                  sameRange({ min: f.minPrice, max: f.maxPrice }, p.range)
                    ? { ...f, minPrice: undefined, maxPrice: undefined }
                    : { ...f, minPrice: p.range.min, maxPrice: p.range.max },
                )
              }
            >
              {p.label}
            </Chip>
          ))}
        </Section>
        <Section title="Kategori">
          {CATEGORIES.map((c) => (
            <Chip
              key={c.slug}
              selected={draft.category === c.slug}
              onClick={() => setDraft((f) => ({ ...f, category: f.category === c.slug ? undefined : c.slug }))}
            >
              {c.name}
            </Chip>
          ))}
        </Section>
        <div className="flex flex-col gap-2.5">
          <label htmlFor="filter-city" className="text-[15px] font-bold">
            Kota
          </label>
          <Combobox
            id="filter-city"
            options={cityOptions}
            value={draft.city ?? ALL_CITY_VALUE}
            onChange={(v) => setDraft((f) => ({ ...f, city: v === ALL_CITY_VALUE ? undefined : v }))}
            placeholder={ALL_CITIES}
            searchPlaceholder="Cari kota atau kabupaten"
            emptyText="Kota atau kabupaten tidak ditemukan"
            leading={<MapPin className="text-text-tertiary" aria-hidden />}
          />
        </div>
      </div>
      <div className="px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] md:px-6 md:pb-6">
        <Button size="lg" block onClick={() => onApply(draft)} disabled={total === 0}>
          {total === undefined ? "Tampilkan acara" : total === 0 ? "Tidak ada acara yang cocok" : `Tampilkan ${total} acara`}
        </Button>
      </div>
    </div>
  );
}

/**
 * Panel "Semua filter". Mobile: Drawer dari bawah. Tablet dan desktop: Dialog.
 * Tombol "Tampilkan N acara" menerapkan filter ke URL.
 */
export function FilterPanel({
  open,
  onOpenChange,
  filters,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Filters;
  onApply: (f: Filters) => void;
}) {
  const desktop = useIsDesktop();
  const apply = (f: Filters) => {
    onApply(f);
    onOpenChange(false);
  };

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85dvh] flex-col gap-0 p-0 sm:max-w-[520px]">
          {open && <PanelBody initial={filters} onApply={apply} Title={DialogTitle} />}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh]">{open && <PanelBody initial={filters} onApply={apply} Title={DrawerTitle} />}</DrawerContent>
    </Drawer>
  );
}

/** Tombol "Semua filter" (desktop) dengan ikon. */
export function AllFiltersChip({ onClick, count }: { onClick: () => void; count: number }) {
  return (
    <Chip onClick={onClick} leading={<SlidersHorizontal className="size-4" aria-hidden />}>
      Semua filter
      {count > 0 && (
        <span className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-extrabold text-foreground">
          {count}
        </span>
      )}
    </Chip>
  );
}

/** Tombol filter bulat hitam di header mobile, dengan angka filter aktif. */
export function FilterButton({ onClick, count }: { onClick: () => void; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={count ? `Filter, ${count} aktif` : "Filter"}
      className="press relative flex size-12 shrink-0 items-center justify-center rounded-full bg-inverse text-inverse-foreground"
    >
      <SlidersHorizontal className="size-5" aria-hidden />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border-2 border-background bg-primary text-[11px] font-extrabold text-foreground">
          {count}
        </span>
      )}
    </button>
  );
}
