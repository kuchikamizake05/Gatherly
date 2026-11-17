"use client";

import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { get, set } from "idb-keyval";

import { ApiError } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";

import { ticketsApi } from "./api";
import type { TicketDetail } from "./types";

/**
 * E-tiket disimpan di perangkat (IndexedDB) setiap kali berhasil dimuat, supaya tetap bisa
 * ditunjukkan di pintu masuk saat tidak ada sinyal (pita 06 H4). Data lain tidak disimpan.
 */
const cacheKey = (id: string) => `gatherly:ticket:${id}`;

async function fetchTicket(id: string): Promise<TicketDetail & { fromDevice?: boolean }> {
  try {
    const { data } = await ticketsApi.get(id);
    set(cacheKey(id), data).catch(() => undefined);
    return data;
  } catch (error) {
    const saved = await get<TicketDetail>(cacheKey(id)).catch(() => undefined);
    if (saved) return { ...saved, fromDevice: true };
    throw error;
  }
}

export function useTickets() {
  return useQuery({ queryKey: qk.tickets, queryFn: () => ticketsApi.list() });
}

export function useTicket(id: string) {
  return useQuery({ queryKey: qk.ticket(id), queryFn: () => fetchTicket(id) });
}

/** Detail semua tiket dalam satu pesanan (untuk QR tiap peserta dan halaman cetak). */
export function useTicketDetails(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({ queryKey: qk.ticket(id), queryFn: () => fetchTicket(id) })),
  });
}

/** Tiket dari tautan e-tiket yang dibagikan. Ikut disimpan di perangkat seperti e-tiket biasa. */
export function useSharedTicket(token: string) {
  return useQuery({
    queryKey: ["ticket", "shared", token] as const,
    queryFn: async (): Promise<TicketDetail & { fromDevice?: boolean }> => {
      const key = `gatherly:shared-ticket:${token}`;
      try {
        const { data } = await ticketsApi.shared(token);
        set(key, data).catch(() => undefined);
        return data;
      } catch (error) {
        // Token salah tetap 404. Hanya gangguan jaringan yang memakai salinan di perangkat.
        if (error instanceof ApiError && error.status === 404) throw error;
        const saved = await get<TicketDetail>(key).catch(() => undefined);
        if (saved) return { ...saved, fromDevice: true };
        throw error;
      }
    },
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });
}

export function useResendTickets() {
  return useMutation({ mutationFn: (orderId: string) => ticketsApi.resend(orderId) });
}
