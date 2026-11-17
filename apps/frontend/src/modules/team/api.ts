import { dataResponse, readResponse } from "@/lib/api/response";
import { credentialsResponse } from "./response";
import { api, ApiError, wrap } from "@/lib/api/client";
import { readMock, writeMock } from "@/modules/_mock/store";
import { passwordDigest } from "@/modules/organizer-auth/mock-session";
import { mockAssignments, mockEventIds } from "./mock-assignments";
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
  eventIds?: string[];
  email?: string;
};

export type CreateMemberInput = {
  name: string;
  username: string;
  eventIds: string[];
  email?: string;
};

/** Password sementara hanya ditampilkan sekali. */
export type Credentials = {
  username: string;
  temporaryPassword: string;
  expiresAt: string;
};

const pending = { pending: true } as const;
const base = "/organizer/team";

const owner: TeamMember = {
  id: "owner",
  name: `${FIX.organizer.pic.name} (Anda)`,
  username: FIX.organizer.username,
  assignedEvents: -1,
  status: "owner",
};

const members = () => readMock<TeamMember[]>("team", FIX.team);
const save = (rows: TeamMember[]) => writeMock("team", rows);
const assertMember = (id: string) => {
  const member = members().find((m) => m.id === id);
  if (!member || member.status === "owner")
    throw new ApiError(404, "NOT_FOUND", "Anggota tidak ditemukan.");
  return member;
};
const creds = async (username: string): Promise<Credentials> => {
  const temporaryPassword = `${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}!`;
  const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
  writeMock(`credential:${username}`, {
    digest: await passwordDigest(temporaryPassword),
    expiresAt,
    temporary: true,
  });
  const session = readMock<{ username: string } | null>(
    "workspace-session",
    null,
  );
  if (session?.username === username) writeMock("workspace-session", null);
  return { username, temporaryPassword, expiresAt };
};
function assign(id: string, eventIds: string[]) {
  const member = assertMember(id);
  for (const eventId of mockEventIds()) {
    const current = mockAssignments(eventId).filter((m) => m.userId !== id);
    if (eventIds.includes(eventId))
      current.push({
        userId: id,
        username: member.username,
        name: member.name,
        assignedAt: new Date().toISOString(),
      });
    writeMock(`committee.${eventId}`, current);
  }
  save(
    members().map((m) =>
      m.id === id ? { ...m, eventIds, assignedEvents: eventIds.length } : m,
    ),
  );
}
export const teamApi = {
  list: () =>
    api.get<{ data: TeamMember[] }>(base, {
      ...pending,
      mock: () =>
        wrap([
          owner,
          ...members().map((member) => {
            const eventIds = mockEventIds().filter((id) =>
              mockAssignments(id).some((a) => a.userId === member.id),
            );
            return { ...member, eventIds, assignedEvents: eventIds.length };
          }),
        ]),
    }),
  create: async (input: CreateMemberInput) =>
    readResponse(
      dataResponse(credentialsResponse),
      await api.post<{ data: Credentials }>(base, input, {
        ...pending,
        mock: async () => {
          if (members().length >= 20)
            throw new ApiError(422, "TEAM_LIMIT", "Maksimal 20 akun panitia.");
          if (
            !/^[a-z0-9._]{3,30}$/.test(input.username) ||
            input.username === owner.username ||
            members().some((m) => m.username === input.username)
          )
            throw new ApiError(
              422,
              "USERNAME_TAKEN",
              "Username tidak tersedia.",
            );
          const id = crypto.randomUUID();
          save([
            ...members(),
            {
              id,
              name: input.name,
              username: input.username,
              email: input.email,
              status: "never_logged_in",
              assignedEvents: 0,
              eventIds: [],
            },
          ]);
          assign(id, input.eventIds);
          return wrap(await creds(input.username));
        },
      }),
    ),
  resetPassword: async (id: string) =>
    readResponse(
      dataResponse(credentialsResponse),
      await api.post<{ data: Credentials }>(
        `${base}/${id}/reset-password`,
        undefined,
        {
          ...pending,
          mock: async () => wrap(await creds(assertMember(id).username)),
        },
      ),
    ),
  setAssignments: (id: string, eventIds: string[]) =>
    api.put<void>(
      `${base}/${id}/assignments`,
      { eventIds },
      { ...pending, mock: () => assign(id, eventIds) },
    ),
  deactivate: (id: string) =>
    api.post<void>(`${base}/${id}/deactivate`, undefined, {
      ...pending,
      mock: () => {
        const member = assertMember(id);
        assign(id, []);
        save(
          members().map((m) =>
            m.id === id ? { ...m, status: "inactive" } : m,
          ),
        );
        if (
          readMock<{ username: string } | null>("workspace-session", null)
            ?.username === member.username
        )
          writeMock("workspace-session", null);
      },
    }),
  reactivate: (id: string) =>
    api.post<void>(`${base}/${id}/reactivate`, undefined, {
      ...pending,
      mock: () => {
        assertMember(id);
        save(
          members().map((m) => (m.id === id ? { ...m, status: "active" } : m)),
        );
      },
    }),
  remove: (id: string) =>
    api.delete<void>(`${base}/${id}`, {
      ...pending,
      mock: () => {
        const member = assertMember(id);
        if (member.status !== "inactive")
          throw new ApiError(
            422,
            "MEMBER_ACTIVE",
            "Nonaktifkan akun sebelum menghapusnya.",
          );
        assign(id, []);
        save(members().filter((m) => m.id !== id));
      },
    }),
  checkUsername: (username: string) =>
    api.get<{ data: { available: boolean } }>(`${base}/username`, {
      query: { username },
      ...pending,
      mock: () =>
        wrap({
          available:
            username !== owner.username &&
            !members().some((m) => m.username === username),
        }),
    }),
};
