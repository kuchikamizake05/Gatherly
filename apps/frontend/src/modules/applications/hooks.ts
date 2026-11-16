"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { applicationsApi, type ApplicationInput } from "./api";

/** Cek username 0,5 detik setelah berhenti mengetik. Debounce dilakukan di komponen. */
export function useUsernameCheck(username: string, enabled = true) {
  return useQuery({
    queryKey: ["application-username", username],
    queryFn: async () => (await applicationsApi.checkUsername(username)).data,
    enabled: enabled && username.length >= 4,
    staleTime: 10_000,
  });
}

export function useSubmitApplication() {
  return useMutation({ mutationFn: (input: ApplicationInput) => applicationsApi.submit(input) });
}

export function useOpenApplication() {
  return useMutation({
    mutationFn: async ({ number, email }: { number: string; email: string }) => (await applicationsApi.open(number, email)).data,
  });
}

export function useSubmitApplicationFix() {
  return useMutation({
    mutationFn: ({ number, input }: { number: string; input: Partial<ApplicationInput> }) => applicationsApi.submitFix(number, input),
  });
}
