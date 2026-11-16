"use client";

import { useSyncExternalStore } from "react";

/**
 * true bila media query cocok. Saat render server selalu false (anggap mobile).
 * Dipakai untuk memilih Drawer (mobile) atau Dialog (tablet dan desktop).
 */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (callback) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** md ke atas (768 px), sama dengan breakpoint di design/frontend-rules.md. */
export const useIsDesktop = () => useMediaQuery("(min-width: 768px)");
