"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, setCsrfToken } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";

import { organizerAuthApi } from "./api";

export function useWorkspaceMe() {
  return useQuery({
    queryKey: qk.orgMe,
    queryFn: async () => {
      try {
        return await organizerAuthApi.me();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });
}

export function useWorkspaceLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      organizerAuthApi.login(username, password),
    onSuccess: (res) => { setCsrfToken(res.data.csrfToken); qc.setQueryData(qk.orgMe, res.data); },
  });
}

export function useChangeTemporaryPassword() {
  const qc = useQueryClient();
  return useMutation({
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
    onSuccess: () => qc.clear(),
  });
}
