"use client";

import { useState } from "react";

import { useOnline } from "@/hooks/use-online";
import { useEvents } from "@/modules/events/hooks";
import { categoryName } from "@/modules/events/categories";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/elements/Alert";
import { EventCard, EventCardSkeleton } from "@/components/elements/EventCard";
import { BackButton, MobileSearch, SearchBar } from "@/components/elements/EventSearch";
import { PriceFilter } from "@/components/elements/FilterChips";
import { StateView } from "@/components/elements/StateView";
import {
  ActiveFilters,
  AllFiltersChip,
  CategoryChip,
  DateChip,
  FilterButton,
  FilterPanel,
  SortChip,
  useEventFilters,
} from "@/components/elements/EventFilters";

/**
 * Hasil pencarian, hasil filter, dan daftar per kategori. Pita 03 baris B4, C, D2, E.
 * Semua filter dibaca dari URL lewat useEventFilters.
 */

const PAGE_SIZE = 8;
const CITY = "Yogyakarta";

export function EventSearchResults() {
  const { filters, set, update, activeCount } = useEventFilters();
  const online = useOnline();
  const [pages, setPages] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const events = useEvents({ ...filters, limit: PAGE_SIZE * pages });

  const list = events.data?.data ?? [];
  const total = events.data?.meta.total ?? 0;
  const category = categoryName(filters.category);
  const heading = filters.q
    ? `${total} acara untuk “${filters.q}” di ${CITY}`
    : category
      ? `${total} acara ${category} di ${CITY}`
      : `${total} acara di ${CITY}`;

  const resetPages = <T,>(fn: (v: T) => void) => (v: T) => {
    setPages(1);
    fn(v);
  };
  const apply = resetPages(set);
  const patch = resetPages(update);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col pb-14 md:px-6 md:pb-20 xl:px-10">
      {/* Mobile: kembali, kolom cari, tombol filter */}
      <div className="flex items-center gap-2 pt-[max(4px,env(safe-area-inset-top))] pr-4 pb-2 pl-2 md:hidden">
        <BackButton href="/" />
        <MobileSearch value={filters.q ?? category ?? ""} />
        <FilterButton onClick={() => setFilterOpen(true)} count={activeCount} />
      </div>
      <FilterPanel open={filterOpen} onOpenChange={setFilterOpen} filters={filters} onApply={apply} />

      {/* Tablet dan desktop: kolom cari dan bar filter */}
      <div className="hidden w-full pt-6 md:block">
        <SearchBar defaultValue={filters.q ?? ""} />
      </div>
      <div className="hidden items-center justify-between gap-4 pt-5 md:flex">
        <div className="flex flex-wrap items-center gap-2">
          <DateChip filters={filters} onChange={patch} />
          <PriceFilter
            value={{ min: filters.minPrice, max: filters.maxPrice }}
            onChange={(r) => patch({ minPrice: r.min, maxPrice: r.max })}
          />
          <CategoryChip filters={filters} onChange={patch} />
          <AllFiltersChip onClick={() => setFilterOpen(true)} count={activeCount} />
        </div>
        <SortChip filters={filters} onChange={patch} />
      </div>

      {!online && (
        <Alert tone="offline" title="Anda sedang luring" className="mx-5 mt-2 w-auto md:mx-0 md:mt-6">
          Menampilkan acara yang terakhir dimuat.
        </Alert>
      )}

      <div className="flex flex-col gap-3 px-5 pt-1 md:flex-row md:items-center md:justify-between md:gap-6 md:px-0 md:pt-7">
        <ActiveFilters filters={filters} onChange={apply} className="order-1 md:order-2 md:justify-end" />
        {!events.isPending && !(events.isError && !events.data) && (
          <h1 className="order-2 text-xl font-extrabold tracking-tight md:order-1 md:text-[22px]">
            <span className="md:hidden">{total} acara</span>
            <span className="hidden md:inline">{heading}</span>
          </h1>
        )}
      </div>

      {events.isPending ? (
        <ResultsSkeleton />
      ) : events.isError && !events.data ? (
        <StateView
          tone="error"
          illustration="failed-load"
          title="Daftar acara gagal dimuat"
          description="Periksa koneksi internet Anda, lalu coba lagi. Kata kunci dan filter Anda tetap tersimpan."
          action={
            <Button onClick={() => events.refetch()} loading={events.isRefetching}>
              Coba lagi
            </Button>
          }
        />
      ) : total === 0 ? (
        <StateView
          illustration="no-results"
          title="Tidak ada acara yang cocok"
          description={
            <>
              Periksa ejaan kata kunci atau hapus sebagian filter.
              <span className="hidden md:inline"> Anda juga dapat mencari di kota lain.</span>
            </>
          }
          action={
            activeCount > 0 ? (
              <Button variant="outline" onClick={() => apply({ q: filters.q, sort: filters.sort })}>
                Hapus semua filter
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="hidden gap-6 pt-6 md:grid md:grid-cols-2 xl:grid-cols-4">
            {list.map((event, i) => (
              <li key={event.slug}>
                <EventCard event={event} priority={i < 4} />
              </li>
            ))}
          </ul>
          <ul className="flex flex-col gap-4 px-5 pt-4 md:hidden">
            {list.map((event, i) => (
              <li key={event.slug}>
                <EventCard layout="row" event={event} showSave={false} priority={i < 4} />
              </li>
            ))}
          </ul>
          {list.length < total && (
            <div className="flex flex-col items-center gap-2.5 px-5 pt-10">
              <p className="text-[13px] text-text-tertiary">
                Menampilkan {list.length} dari {total} acara
              </p>
              <Button variant="outline" onClick={() => setPages((p) => p + 1)} loading={events.isFetching}>
                Muat lebih banyak
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div aria-busy>
      <span className="skeleton mx-5 mt-4 block h-6 w-48 rounded md:mx-0 md:mt-6 md:h-7 md:w-80" />
      <div className="hidden gap-6 pt-6 md:grid md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <EventCardSkeleton key={i} />
        ))}
      </div>
      <div className="flex flex-col gap-4 px-5 pt-4 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <EventCardSkeleton key={i} layout="row" />
        ))}
      </div>
    </div>
  );
}
