"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { applicationsApi } from "./api";

/** Cek username 0,5 detik setelah berhenti mengetik. Debounce dilakukan di komponen. */
export function useUsernameCheck(username: string) {
  return useQuery({
    queryKey: ["application-username", username],
    queryFn: async () => (await applicationsApi.checkUsername(username)).data,
    enabled: username.length >= 3,
    staleTime: 10_000,
  });
}

export function useSubmitApplication() {
  return useMutation({ mutationFn: applicationsApi.submit });
}

export function useOpenApplication() {
  return useMutation({
    mutationFn: ({ number, email }: { number: string; email: string }) => applicationsApi.open(number, email),
  });
}

export function useSubmitApplicationFix() {
  return useMutation({
    mutationFn: ({ number, form }: { number: string; form: FormData }) => applicationsApi.submitFix(number, form),
  });
}
