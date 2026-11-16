"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { qk } from "@/lib/api/query-keys";

import { accountApi, type Account } from "./api";

/**
 * Akun saya. Setiap perubahan langsung diterapkan ke cache supaya halaman berubah tanpa memuat ulang,
 * lalu data disegarkan dari server. Notifikasi optimistis dan dikembalikan bila gagal (pita 12 D).
 */

export function useAccount() {
  return useQuery({ queryKey: qk.account, queryFn: async () => (await accountApi.get()).data });
}

function usePatchAccount() {
  const qc = useQueryClient();
  return {
    patch: (fn: (a: Account) => Account) => qc.setQueryData<Account>(qk.account, (a) => (a ? fn(a) : a)),
    refresh: () => {
      qc.invalidateQueries({ queryKey: qk.account });
      qc.invalidateQueries({ queryKey: qk.me });
    },
    qc,
  };
}

export function useUpdateProfile() {
  const { patch, refresh } = usePatchAccount();
  return useMutation({
    mutationFn: async (input: { name: string; phone: string | null; avatar?: File | null }) => {
      let avatarUrl: string | undefined;
      if (input.avatar) avatarUrl = (await accountApi.uploadAvatar(input.avatar)).data.avatarUrl;
      const { data } = await accountApi.updateProfile({ name: input.name, phone: input.phone });
      return { ...data, ...(avatarUrl ? { avatarUrl } : {}) };
    },
    onSuccess: (data) => {
      patch((a) => ({ ...a, name: data.name, phone: data.phone, avatarUrl: data.avatarUrl ?? a.avatarUrl }));
      refresh();
    },
  });
}

export function useChangePassword() {
  const { patch, refresh } = usePatchAccount();
  return useMutation({
    mutationFn: accountApi.changePassword,
    onSuccess: () => {
      patch((a) => ({ ...a, hasPassword: true, passwordChangedAt: new Date().toISOString(), activeDevices: 1 }));
      refresh();
    },
  });
}

export function useUnlinkGoogle() {
  const { patch, refresh } = usePatchAccount();
  return useMutation({
    mutationFn: () => accountApi.unlinkGoogle(),
    onSuccess: () => {
      patch((a) => ({ ...a, googleEmail: null }));
      refresh();
    },
  });
}

export function useSignOutOtherDevices() {
  const { patch, refresh } = usePatchAccount();
  return useMutation({
    mutationFn: async () => (await accountApi.signOutOtherDevices()).data,
    onSuccess: () => {
      patch((a) => ({ ...a, activeDevices: 1 }));
      refresh();
    },
  });
}

export function useUpdateNotifications() {
  const { qc, refresh } = usePatchAccount();
  return useMutation({
    mutationFn: accountApi.updateNotifications,
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: qk.account });
      const previous = qc.getQueryData<Account>(qk.account);
      qc.setQueryData<Account>(qk.account, (a) => (a ? { ...a, notifications: next } : a));
      return { previous };
    },
    onError: (_e, _next, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.account, ctx.previous);
    },
    onSettled: refresh,
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: accountApi.deleteAccount,
    onSuccess: () => {
      qc.setQueryData(qk.me, null);
      qc.removeQueries({ queryKey: qk.account });
      qc.removeQueries({ queryKey: qk.tickets });
      qc.removeQueries({ queryKey: qk.orders });
    },
  });
}
