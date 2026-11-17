"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { qk } from "@/lib/api/query-keys";

import { eventsApi } from "./api";
import type { EventQuery, ReportInput } from "./types";

export function useEvents(query: EventQuery = {}) {
  return useQuery({ queryKey: qk.events(query), queryFn: () => eventsApi.list(query), placeholderData: keepPreviousData });
}

/** Pilihan kota di pencarian. Jarang berubah, jadi disimpan lima menit. */
export function useCities() {
  return useQuery({ queryKey: ["events", "cities"] as const, queryFn: async () => (await eventsApi.cities()).data, staleTime: 300_000 });
}

/** Saran pencarian. Kirim kata kunci yang sudah ditunda (debounce) dari komponen. */
export function useEventSuggestions(q: string) {
  return useQuery({
    queryKey: ["events", "suggest", q] as const,
    queryFn: async () => (await eventsApi.suggest(q)).data,
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useEvent(slug: string) {
  return useQuery({ queryKey: qk.event(slug), queryFn: async () => (await eventsApi.detail(slug)).data });
}

export function useSavedEvents({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: qk.saved, queryFn: () => eventsApi.saved(), enabled });
}

/** Simpan atau hapus dari Disimpan. Toast dengan tombol Batalkan diatur di komponen. */
export function useToggleSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, saved }: { slug: string; saved: boolean }) =>
      saved ? eventsApi.save(slug) : eventsApi.unsave(slug),
    onSuccess: (_res, { slug }) => {
      qc.invalidateQueries({ queryKey: qk.saved });
      qc.invalidateQueries({ queryKey: qk.event(slug) });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useOrganizerProfile(username: string) {
  return useQuery({
    queryKey: qk.organizerProfile(username),
    queryFn: async () => (await eventsApi.organizerProfile(username)).data,
  });
}

export function useReportEvent(slug: string) {
  return useMutation({ mutationFn: (input: ReportInput) => eventsApi.report(slug, input) });
}
