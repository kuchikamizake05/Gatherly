"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useIdempotencyKey } from "@/hooks/use-idempotency-key";
import { dataResponse, readResponse } from "@/lib/api/response";
import { bankResponse, profileResponse, payoutsResponse } from "./response";
import { qk } from "@/lib/api/query-keys";

import { organizerSettingsApi as s, type BankAccount } from "./api";

export const useOrgProfile = () =>
  useQuery({
    queryKey: qk.orgProfile,
    queryFn: async () =>
      readResponse(dataResponse(profileResponse), await s.profile()).data,
  });

export function useUpdateOrgProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: s.updateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.orgProfile }),
  });
}

export function useChangeOrgPassword() {
  return useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => s.changePassword(currentPassword, newPassword),
  });
}

export const useBankAccount = () =>
  useQuery({
    queryKey: qk.orgBank,
    queryFn: async () =>
      readResponse(dataResponse(bankResponse), await s.bankAccount()).data,
  });

export function useSaveBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BankAccount) => s.saveBankAccount(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.orgBank });
      qc.invalidateQueries({ queryKey: qk.orgPayouts });
    },
  });
}

export const usePayouts = () =>
  useQuery({
    queryKey: qk.orgPayouts,
    queryFn: async () =>
      readResponse(dataResponse(payoutsResponse), await s.payouts()).data,
  });

export function useRequestPayout() {
  const keyFor = useIdempotencyKey();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => s.requestPayout(eventId, keyFor(eventId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.orgPayouts }),
  });
}
