"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { qk } from "@/lib/api/query-keys";

import { teamApi, type CreateMemberInput } from "./api";

export function useTeam() {
  return useQuery({ queryKey: qk.orgTeam, queryFn: async () => (await teamApi.list()).data });
}

function useTeamMutation<T, R>(fn: (input: T) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: qk.orgTeam }) });
}

export const useCreateMember = () => useTeamMutation((input: CreateMemberInput) => teamApi.create(input));
export const useResetMemberPassword = () => useTeamMutation((id: string) => teamApi.resetPassword(id));
export const useSetMemberAssignments = () =>
  useTeamMutation(({ id, eventIds }: { id: string; eventIds: string[] }) => teamApi.setAssignments(id, eventIds));
export const useDeactivateMember = () => useTeamMutation((id: string) => teamApi.deactivate(id));
export const useReactivateMember = () => useTeamMutation((id: string) => teamApi.reactivate(id));
export const useRemoveMember = () => useTeamMutation((id: string) => teamApi.remove(id));

export function useMemberUsernameCheck(username: string) {
  return useQuery({
    queryKey: ["team-username", username],
    queryFn: async () => (await teamApi.checkUsername(username)).data,
    enabled: username.length >= 3,
  });
}
