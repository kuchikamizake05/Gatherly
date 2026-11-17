"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, setCsrfToken } from "@/lib/api/client";
import { qk } from "@/lib/api/query-keys";
import type { FieldFlag } from "@/modules/applications/api";

import { adminApi as a, type ApplicationTab, type OrganizerTab } from "./api";

export function useAdminMe() {
  return useQuery({
    queryKey: qk.adminMe,
    queryFn: async () => {
      try {
        return await a.me();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
  });
}

export const useAdminLogin = () =>
  useMutation({ mutationFn: ({ email, password }: { email: string; password: string }) => a.login(email, password) });

export function useAdminVerifyTotp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ challengeId, code, rememberDevice }: { challengeId: string; code: string; rememberDevice: boolean }) =>
      a.verifyTotp(challengeId, code, rememberDevice),
    onSuccess: (res) => { setCsrfToken(res.data.csrfToken); qc.setQueryData(qk.adminMe, res.data); },
  });
}

export function useAdminBackupCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ challengeId, code }: { challengeId: string; code: string }) => a.verifyBackupCode(challengeId, code),
    onSuccess: (res) => { setCsrfToken(res.data.csrfToken); qc.setQueryData(qk.adminMe, res.data); },
  });
}

export const useAdminLogout = () => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: a.logout, onSuccess: () => qc.clear() });
};

export const useApplications = (params: { tab?: ApplicationTab; q?: string; type?: string; page?: number }) =>
  useQuery({ queryKey: qk.adminApplications(params), queryFn: () => a.applications(params) });
export const useApplicationReview = (id: string) =>
  useQuery({ queryKey: qk.adminApplication(id), queryFn: async () => (await a.application(id)).data });

function useAdminMutation<T>(fn: (input: T) => Promise<unknown>, scope: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", scope] }) });
}

export const useApproveApplication = () => useAdminMutation((id: string) => a.approve(id), "applications");
export const useRequestFix = () =>
  useAdminMutation(({ id, flags }: { id: string; flags: FieldFlag[] }) => a.requestFix(id, flags), "applications");
export const useRejectApplication = () =>
  useAdminMutation(({ id, reason }: { id: string; reason: string }) => a.reject(id, reason), "applications");

export const useAdminOrganizers = (params: { tab?: OrganizerTab; q?: string; page?: number }) =>
  useQuery({ queryKey: qk.adminOrganizers(params), queryFn: () => a.organizers(params) });
export const useAdminOrganizer = (id: string) =>
  useQuery({ queryKey: qk.adminOrganizer(id), queryFn: async () => (await a.organizer(id)).data });
export const useFreezeOrganizer = () =>
  useAdminMutation(({ id, reason }: { id: string; reason: string }) => a.freeze(id, reason), "organizers");
export const useUnfreezeOrganizer = () => useAdminMutation((id: string) => a.unfreeze(id), "organizers");
export const useResendAccess = () => useAdminMutation((id: string) => a.resendAccess(id), "organizers");

export const useAdminPayouts = (params: { tab?: "requested" | "transferred"; page?: number }) =>
  useQuery({ queryKey: qk.adminPayouts(params), queryFn: () => a.payouts(params) });
export const useMarkTransferred = () =>
  useAdminMutation(
    ({ id, reference, transferredAt }: { id: string; reference: string; transferredAt: string }) =>
      a.markTransferred(id, reference, transferredAt),
    "payouts",
  );

export const useAdminReports = (params: { tab?: "new" | "done"; page?: number }) =>
  useQuery({ queryKey: qk.adminReports(params), queryFn: () => a.reports(params) });
export const useAdminReport = (id: string) =>
  useQuery({ queryKey: qk.adminReport(id), queryFn: async () => (await a.report(id)).data });
export const useCloseReport = () =>
  useAdminMutation(({ id, note }: { id: string; note: string }) => a.closeReport(id, note), "reports");
