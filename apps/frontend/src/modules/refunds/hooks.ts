"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { refundsApi } from "./api";
import type { RefundInput } from "./types";

export const refundKeys = { list: ["refunds"] as const };

export function useRefunds({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: refundKeys.list, queryFn: async () => (await refundsApi.list()).data, enabled });
}

export function useRequestRefund(orderId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, unitPrice, ticketCount }: { input: RefundInput; unitPrice: number; ticketCount: number }) =>
      refundsApi.request(orderId, input, unitPrice, ticketCount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: refundKeys.list });
      qc.invalidateQueries({ queryKey: ["order", orderId] });
    },
  });
}
