"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { qk } from "@/lib/api/query-keys";

import { ticketsApi } from "./api";

export function useTickets() {
  return useQuery({ queryKey: qk.tickets, queryFn: () => ticketsApi.list() });
}

export function useTicket(id: string) {
  return useQuery({ queryKey: qk.ticket(id), queryFn: async () => (await ticketsApi.get(id)).data });
}

export function useResendTickets() {
  return useMutation({ mutationFn: (orderId: string) => ticketsApi.resend(orderId) });
}
