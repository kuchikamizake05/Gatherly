import { api, wrap } from "@/lib/api/client";
import { FIX } from "@/modules/_mock/fixtures";

/**
 * Tim dan akun panitia di Pengaturan, Tim. Pita desain 18. Semua pending (issue B28).
 */

export type MemberStatus = "owner" | "active" | "never_logged_in" | "inactive";

export type TeamMember = {
  id: string;
  name: string;
  username: string;
  assignedEvents: number;
  status: MemberStatus;
};

export type CreateMemberInput = { name: string; username: string; eventIds: string[] };

/** Password sementara hanya ditampilkan sekali. */
export type Credentials = { username: string; temporaryPassword: string; expiresAt: string };

const pending = { pending: true } as const;
const base = "/organizer/team";

const owner: TeamMember = {
  id: "owner",
  name: `${FIX.organizer.pic.name} (Anda)`,
  username: FIX.organizer.username,
  assignedEvents: -1,
  status: "owner",
};

const creds = (username: string): Credentials => ({
  username,
  temporaryPassword: "Kp8#vR2mQx",
  expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
});

export const teamApi = {
  list: () => api.get<{ data: TeamMember[] }>(base, { ...pending, mock: () => wrap([owner, ...FIX.team]) }),
  create: (input: CreateMemberInput) =>
    api.post<{ data: Credentials }>(base, input, { ...pending, mock: () => wrap(creds(input.username)) }),
  resetPassword: (id: string) =>
    api.post<{ data: Credentials }>(`${base}/${id}/reset-password`, undefined, { ...pending, mock: () => wrap(creds("dimas.sawah")) }),
  setAssignments: (id: string, eventIds: string[]) =>
    api.put<void>(`${base}/${id}/assignments`, { eventIds }, { ...pending, mock: () => undefined }),
  deactivate: (id: string) => api.post<void>(`${base}/${id}/deactivate`, undefined, { ...pending, mock: () => undefined }),
  reactivate: (id: string) => api.post<void>(`${base}/${id}/reactivate`, undefined, { ...pending, mock: () => undefined }),
  remove: (id: string) => api.delete<void>(`${base}/${id}`, { ...pending, mock: () => undefined }),
  checkUsername: (username: string) =>
    api.get<{ data: { available: boolean } }>(`${base}/username`, {
      query: { username },
      ...pending,
      mock: () => wrap({ available: !FIX.team.some((m) => m.username === username) }),
    }),
};
