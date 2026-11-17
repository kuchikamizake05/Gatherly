"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useUntilHydrated } from "@/hooks/use-hydrated";
import { ApiError, setCsrfToken } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";

import { organizerAuthApi } from "./api";

export function useWorkspaceMe() {
  return useUntilHydrated(
    useQuery({
      queryKey: qk.orgMe,
      queryFn: async ({ signal }) => {
        try {
          return await organizerAuthApi.me(undefined, signal);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) return null;
          throw error;
        }
      },
      staleTime: 30_000,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    }),
  );
}

export function useWorkspaceLogin() {
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: ({
      username,
      password,
    }: {
      username: string;
      password: string;
    }) => organizerAuthApi.login(username, password),
    onSuccess: async (res) => {
      await qc.cancelQueries();
      setCsrfToken(res.data.csrfToken);
      qc.removeQueries({
        predicate: (query) =>
          JSON.stringify(query.queryKey) !== JSON.stringify(qk.orgMe),
      });
      qc.setQueryData(qk.orgMe, res.data);
    },
  });
}

export function useChangeTemporaryPassword() {
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: organizerAuthApi.changeTemporaryPassword,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.orgMe }),
  });
}

export function useWorkspaceForgotPassword() {
  return useMutation({ mutationFn: organizerAuthApi.forgotPassword });
}

export function useWorkspaceResetPassword() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      organizerAuthApi.resetPassword(token, password),
  });
}

export function useWorkspaceLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: organizerAuthApi.logout,
    onSuccess: async () => {
      setCsrfToken(null);
      await qc.cancelQueries();
      qc.clear();
      qc.setQueryData(qk.orgMe, null);
      try {
        localStorage.setItem("gatherly.workspace.logout", crypto.randomUUID());
      } catch {}
    },
  });
}
