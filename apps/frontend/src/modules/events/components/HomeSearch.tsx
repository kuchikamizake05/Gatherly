"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useOnline } from "@/hooks/use-online";
import { Alert } from "@/components/elements/Alert";
import { MobileSearch, SearchBar } from "@/components/elements/EventSearch";
import { FilterButton, FilterPanel, type Filters } from "@/components/elements/EventFilters";
import { Button } from "@/components/ui/button";
import { useCity } from "@/modules/events/use-city";

/** Bagian interaktif beranda (pita 03 A, B). Sisanya dirender di server oleh HomeView. */

export const filtersHref = (f: Filters) => {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "") params.set(k, String(v));
  return `/events?${params.toString()}`;
};

export function HomeSearch() {
  const router = useRouter();
  const [filterOpen, setFilterOpen] = useState(false);
  return (
    <>
      <div className="hidden w-full max-w-[760px] pt-3 md:block">
        <SearchBar />
      </div>
      <div className="flex w-full items-center gap-2 pt-1.5 md:hidden">
        <MobileSearch />
        <FilterButton onClick={() => setFilterOpen(true)} count={0} />
        <FilterPanel open={filterOpen} onOpenChange={setFilterOpen} filters={{}} onApply={(f) => router.push(filtersHref(f))} />
      </div>
    </>
  );
}

/** Pita 03 E4. Daftar acara tetap tampil dari muatan terakhir. */
export function HomeOffline() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 pt-4 md:px-10">
      <Alert tone="offline" title="Anda sedang luring">
        <span className="md:hidden">Menampilkan acara yang terakhir dimuat.</span>
        <span className="hidden md:inline">Menampilkan acara yang terakhir dimuat. Pemesanan tiket memerlukan koneksi internet.</span>
      </Alert>
    </div>
  );
}

/** Tombol di state kosong beranda untuk kembali ke semua kota. */
export function AllCitiesButton() {
  const { setCity } = useCity();
  return <Button onClick={() => setCity(undefined)}>Lihat semua kota</Button>;
}
