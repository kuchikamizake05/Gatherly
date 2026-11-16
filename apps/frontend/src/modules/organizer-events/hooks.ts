"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { qk } from "@/lib/api/query-keys";

import { organizerEventsApi as apiOrg } from "./api";
import type { EventInput, RefundInput, TicketTypeInput } from "./types";

const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type SummaryRange = keyof typeof RANGE_DAYS | "year";

export function useOrgSummary(range: SummaryRange = "30d") {
  return useQuery({
    queryKey: qk.orgSummary(range),
    queryFn: async () => {
      const to = new Date();
      const from =
        range === "year"
          ? new Date(to.getFullYear(), 0, 1)
          : new Date(to.getTime() - RANGE_DAYS[range] * 86_400_000);
      return (await apiOrg.summary(from.toISOString(), to.toISOString())).data;
    },
  });
}

export function useOrgEvents(status?: string) {
  return useQuery({ queryKey: qk.orgEvents(status), queryFn: () => apiOrg.list(status) });
}

export function useOrgEvent(id: string) {
  return useQuery({ queryKey: qk.orgEvent(id), queryFn: async () => (await apiOrg.get(id)).data, enabled: !!id });
}

export function useOrgEventSummary(id: string) {
  return useQuery({ queryKey: qk.orgEventSummary(id), queryFn: async () => (await apiOrg.eventSummary(id)).data });
}

export function useOrgEventOrders(id: string, params: { q?: string; paymentStatus?: string; page?: number } = {}) {
  return useQuery({ queryKey: qk.orgEventOrders(id, params), queryFn: () => apiOrg.orders(id, params) });
}

export function useOrgEventOrder(id: string, orderId: string | null) {
  return useQuery({
    queryKey: qk.orgEventOrder(id, orderId ?? ""),
    queryFn: async () => (await apiOrg.order(id, orderId!)).data,
    enabled: !!orderId,
  });
}

export function useOrgEventAttendees(id: string, params: { q?: string; checkInStatus?: string; page?: number } = {}) {
  return useQuery({ queryKey: qk.orgEventAttendees(id, params), queryFn: () => apiOrg.attendees(id, params) });
}

export function useEventCommittee(id: string) {
  return useQuery({ queryKey: qk.orgEventCommittee(id), queryFn: async () => (await apiOrg.committee(id)).data });
}

/** Mutasi yang menyegarkan data acara terkait. */
function useEventMutation<T>(id: string, fn: (input: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org", "event", id] });
      qc.invalidateQueries({ queryKey: ["org", "events"] });
    },
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<EventInput>) => apiOrg.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org", "events"] }),
  });
}

export const useUpdateEvent = (id: string) => useEventMutation(id, (input: Partial<EventInput>) => apiOrg.update(id, input));
export const usePublishEvent = (id: string) => useEventMutation(id, () => apiOrg.publish(id));
export const useAddTicketType = (id: string) => useEventMutation(id, (input: TicketTypeInput) => apiOrg.addTicketType(id, input));
export const useUpdateTicketType = (id: string) =>
  useEventMutation(id, ({ typeId, input }: { typeId: string; input: Partial<TicketTypeInput> }) => apiOrg.updateTicketType(id, typeId, input));
export const useRemoveTicketType = (id: string) => useEventMutation(id, (typeId: string) => apiOrg.removeTicketType(id, typeId));
export const useSetTicketSales = (id: string) =>
  useEventMutation(id, ({ typeId, stopped }: { typeId: string; stopped: boolean }) => apiOrg.setTicketSales(id, typeId, stopped));
export const useCancelEvent = (id: string) =>
  useEventMutation(id, ({ confirmTitle, reason }: { confirmTitle: string; reason: string }) => apiOrg.cancelEvent(id, confirmTitle, reason));
export const useDuplicateEvent = (id: string) => useEventMutation(id, () => apiOrg.duplicate(id));
export const useAssignCommittee = (id: string) => useEventMutation(id, (memberIds: string[]) => apiOrg.assignCommittee(id, memberIds));
export const useRevokeCommittee = (id: string) => useEventMutation(id, (userId: string) => apiOrg.revokeCommittee(id, userId));
export const useRefundOrder = (id: string) =>
  useEventMutation(id, ({ orderId, input }: { orderId: string; input: RefundInput }) => apiOrg.refund(id, orderId, input));

export function useUploadPoster() {
  return useMutation({ mutationFn: (file: Blob) => apiOrg.uploadPoster(file) });
}
