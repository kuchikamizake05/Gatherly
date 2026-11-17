"use client";

import { useSyncExternalStore } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

const subscribe = () => () => {};

/**
 * false di server dan saat hydration, true setelahnya. Komponen yang dipasang
 * belakangan lewat navigasi di browser langsung mendapat true.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/**
 * Selama hydration, query diperlakukan masih memuat. Data sesi bisa sudah ada di
 * cache sebelum bagian halaman selesai di-hydrate, sehingga render pertama berbeda
 * dengan HTML server (React error 418). Setelah hydration, data asli langsung dipakai.
 */
export function useUntilHydrated<T, E>(
  query: UseQueryResult<T, E>,
): UseQueryResult<T, E> {
  const hydrated = useHydrated();
  if (hydrated) return query;
  return {
    ...query,
    data: undefined,
    error: null,
    isError: false,
    isPending: true,
    isLoading: true,
    isSuccess: false,
    status: "pending",
  } as unknown as UseQueryResult<T, E>;
}
