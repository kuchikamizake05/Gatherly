"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { qk } from "@/lib/api/query-keys";

import { accountApi } from "./api";

export function useAccount() {
  return useQuery({ queryKey: qk.account, queryFn: async () => (await accountApi.get()).data });
}

function useAccountMutation<T>(fn: (input: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.account });
      qc.invalidateQueries({ queryKey: qk.me });
    },
  });
}

export const useUpdateProfile = () => useAccountMutation(accountApi.updateProfile);
export const useChangePassword = () => useAccountMutation(accountApi.changePassword);
export const useUnlinkGoogle = () => useAccountMutation(() => accountApi.unlinkGoogle());
export const useSignOutOtherDevices = () => useAccountMutation(() => accountApi.signOutOtherDevices());
export const useUpdateNotifications = () => useAccountMutation(accountApi.updateNotifications);
export const useDeleteAccount = () => useAccountMutation(accountApi.deleteAccount);
