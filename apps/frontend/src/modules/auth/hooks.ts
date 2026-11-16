"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";

import { authApi } from "./api";

/** Data pengguna yang sedang masuk. null bila tamu. */
export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => {
      try {
        return await authApi.me();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });
}

export function useRegister() {
  return useMutation({ mutationFn: authApi.register });
}

export function useVerifyRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.verifyRegister,
    onSuccess: (res) => qc.setQueryData(qk.me, res.data),
  });
}

export function useLogin() {
  return useMutation({ mutationFn: authApi.login });
}

export function useVerifyLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.verifyLogin,
    onSuccess: (res) => qc.setQueryData(qk.me, res.data),
  });
}

export function useResendOtp() {
  return useMutation({ mutationFn: authApi.resendOtp });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      qc.setQueryData(qk.me, null);
      qc.removeQueries({ queryKey: qk.tickets });
      qc.removeQueries({ queryKey: qk.orders });
    },
  });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: authApi.forgotPassword });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      authApi.resetPassword(token, password),
  });
}
