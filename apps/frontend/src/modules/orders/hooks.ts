"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { qk } from "@/lib/api/query-keys";

import { ordersApi } from "./api";
import { useRealtime } from "@/hooks/use-realtime";
import type { CreateOrderInput, Order } from "./types";

const isTerminal = (o?: Order) =>
  !!o && (o.paymentStatus === "paid" ? o.issuanceStatus === "issued" : o.paymentStatus !== "pending");

/**
 * Status pesanan. Polling tiap 5 detik selama belum final (kontrak API),
 * berhenti saat dibayar dan e-tiket terbit, gagal, atau kedaluwarsa.
 */
export function useOrder(id: string, { poll = false } = {}) {
  const connected=useRealtime("order",id,poll);
  return useQuery({
    queryKey: qk.order(id),
    queryFn: async () => (await ordersApi.get(id)).data,
    refetchInterval: (query) => (poll && !connected && !isTerminal(query.state.data) ? 5_000 : false),
    refetchIntervalInBackground: false,
  });
}

export function useOrders() {
  return useQuery({ queryKey: qk.orders, queryFn: () => ordersApi.list() });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: CreateOrderInput; idempotencyKey: string }) =>
      ordersApi.create(input, idempotencyKey),
  });
}

export function usePaymentSession() {
  return useMutation({
    mutationFn: ({ orderId, method }: { orderId: string; method: string }) => ordersApi.paymentSession(orderId, method),
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => ordersApi.cancel(orderId),
    onSuccess: (_res, orderId) => {
      qc.invalidateQueries({ queryKey: qk.order(orderId) });
      qc.invalidateQueries({ queryKey: qk.orders });
    },
  });
}
