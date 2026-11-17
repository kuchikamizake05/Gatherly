"use client";

import { useMemo, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { ComboboxOption } from "@/components/elements/Combobox";
import { shortProvince, useRegionData } from "@/lib/regions";

import { ALL_CITIES, CITY_COOKIE } from "./city";
import { useCities } from "./hooks";

const listeners = new Set<() => void>();

function readCookie() {
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${CITY_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CITY_COOKIE.length + 1)) || undefined : undefined;
}

export function writeCityCookie(city: string | undefined) {
  document.cookie = city
    ? `${CITY_COOKIE}=${encodeURIComponent(city)}; path=/; max-age=31536000; samesite=lax`
    : `${CITY_COOKIE}=; path=/; max-age=0; samesite=lax`;
  listeners.forEach((fn) => fn());
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Kota dari cookie. Di server dan saat hydration bernilai undefined. */
export function useCityCookie() {
  return useSyncExternalStore(subscribe, readCookie, () => undefined);
}

/** Kota aktif dan cara mengubahnya. Di /events kota ikut ditulis ke URL, di halaman lain halaman dimuat ulang. */
export function useCity() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const cookie = useCityCookie();
  const city = search.get("city") || cookie;

  const setCity = (next: string | undefined) => {
    writeCityCookie(next);
    if (pathname === "/events") {
      const params = new URLSearchParams(search.toString());
      if (next) params.set("city", next);
      else params.delete("city");
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    } else router.refresh();
  };

  return { city, setCity };
}

/** Nilai "Semua kota" di daftar pilihan. */
export const ALL_CITY_VALUE = "__all";

/**
 * Daftar pilihan kota: Semua kota, kota yang punya acara (dengan jumlahnya),
 * lalu semua kabupaten dan kota di Indonesia (dengan provinsinya) dari lib/regions.
 */
export function useCityOptions(current?: string): ComboboxOption[] {
  const cities = useCities();
  const regions = useRegionData();
  return useMemo(() => {
    const withEvents = cities.data ?? [];
    const seen = new Set(withEvents.map((c) => c.name));
    const rest: ComboboxOption[] = [];
    for (const p of regions.data?.provinces ?? [])
      for (const name of regions.data?.regencies[p.id] ?? [])
        if (!seen.has(name)) {
          seen.add(name);
          rest.push({ value: name, label: name, hint: shortProvince(p.name) });
        }
    rest.sort((a, b) => a.label.localeCompare(b.label, "id"));
    // Kota terpilih yang tidak ada di data wilayah (misalnya dari tautan) tetap ditampilkan.
    if (current && !seen.has(current)) rest.unshift({ value: current, label: current });
    return [
      { value: ALL_CITY_VALUE, label: ALL_CITIES },
      ...withEvents.map((c) => ({ value: c.name, label: c.name, hint: `${c.count} acara` })),
      ...rest,
    ];
  }, [cities.data, regions.data, current]);
}
