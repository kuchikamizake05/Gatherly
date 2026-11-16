"use client";

import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { get, set } from "idb-keyval";

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

export function useResendTickets() {
  return useMutation({ mutationFn: (orderId: string) => ticketsApi.resend(orderId) });
}
