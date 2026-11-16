"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { qk } from "@/lib/api/query-keys";

import { eventsApi } from "./api";
import type { EventQuery, ReportInput } from "./types";

export function useEvents(query: EventQuery = {}) {
  return useQuery({ queryKey: qk.events(query), queryFn: () => eventsApi.list(query) });
}

export function useEvent(slug: string) {
  return useQuery({ queryKey: qk.event(slug), queryFn: async () => (await eventsApi.detail(slug)).data });
}

export function useSavedEvents() {
  return useQuery({ queryKey: qk.saved, queryFn: () => eventsApi.saved() });
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
