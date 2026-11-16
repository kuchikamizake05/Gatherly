"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { qk } from "@/lib/api/query-keys";

import { organizerSettingsApi as s, type BankAccount } from "./api";

export const useOrgProfile = () =>
  useQuery({ queryKey: qk.orgProfile, queryFn: async () => (await s.profile()).data });

export function useUpdateOrgProfile() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: s.updateProfile, onSuccess: () => qc.invalidateQueries({ queryKey: qk.orgProfile }) });
}

export function useChangeOrgPassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      s.changePassword(currentPassword, newPassword),
  });
}

export const useBankAccount = () =>
  useQuery({ queryKey: qk.orgBank, queryFn: async () => (await s.bankAccount()).data });

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

export const usePayouts = () => useQuery({ queryKey: qk.orgPayouts, queryFn: async () => (await s.payouts()).data });

export function useRequestPayout() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: s.requestPayout, onSuccess: () => qc.invalidateQueries({ queryKey: qk.orgPayouts }) });
}
