"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { qk } from "@/lib/api/query-keys";

import { checkInApi } from "./api";
import { useRealtime } from "@/hooks/use-realtime";

export function useAssignedEvents() {
  return useQuery({
    queryKey: qk.assigned,
    queryFn: () => checkInApi.assigned(),
  });
}

export function useTicketLookup(eventId: string, q: string) {
  return useQuery({
    queryKey: [...qk.scanTickets(eventId), q],
    queryFn: () => checkInApi.lookup(eventId, q),
    enabled: q.trim().length >= 2,
  });
}

/** Riwayat dan hitungan hadir. Polling tiap 5 detik supaya angka dari semua panitia ikut bertambah. */
export function useScanHistory(
  eventId: string,
  params: { page?: number; rejectedOnly?: boolean } = {},
) {
  const connected = useRealtime("event", eventId);
  return useQuery({
    queryKey: qk.scanHistory(eventId, params),
    queryFn: () => checkInApi.history(eventId, params),
    refetchInterval: connected ? false : 5_000,
  });
}

export function useCheckIn(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { qrPayload: string } | { ticketCode: string }) =>
      checkInApi.checkIn(eventId, input),
    onSettled: () => qc.invalidateQueries({ queryKey: ["scan", eventId] }),
  });
}
