import { z } from "zod";
import { dataResponse, readResponse } from "@/lib/api/response";
import { api, ApiError, setCsrfToken, wrap } from "@/lib/api/client";
import { FIX } from "@/modules/_mock/fixtures";
import { readMock, writeMock } from "@/modules/_mock/store";
import {
  mockSession,
  mockLogin,
  mockChangePassword,
  passwordDigest,
} from "./mock-session";

/**
 * Login organizer dan panitia di organizer.gatherly.xyz. Pita desain 14.
 * Semua pending (issue B28): akun username + password, terpisah dari akun peserta.
 */

export type WorkspaceRole = "organizer" | "committee";

const workspaceMeResponse = z.object({
  role: z.enum(["organizer", "committee"]),
  username: z.string().min(1),
  name: z.string().min(1),
  mustChangePassword: z.boolean(),
  organizer: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    username: z.string().min(1),
    frozen: z.boolean(),
    frozenReason: z.string().nullable().optional(),
  }),
  csrfToken: z.string().min(1),
});
export type WorkspaceMe = z.infer<typeof workspaceMeResponse>;

const pending = { pending: true } as const;

export const organizerAuthApi = {
  async me(cookie?: string, signal?: AbortSignal) {
    const res = await api.get<{ data: WorkspaceMe }>("/workspace/auth/me", {
      cookie,
      signal,
      ...pending,
      mock: () => wrap(mockSession()),
    });
    const { data } = readResponse(dataResponse(workspaceMeResponse), res);
    setCsrfToken(data.csrfToken);
    return data;
  },
  login: async (username: string, password: string) =>
    readResponse(
      dataResponse(workspaceMeResponse),
      await api.post<{ data: WorkspaceMe }>(
        "/workspace/auth/login",
        { username, password },
        {
          ...pending,
          mock: async () => wrap(await mockLogin(username, password)),
        },
      ),
    ),
  /** Login pertama: ganti password sementara. */
  changeTemporaryPassword: (newPassword: string) =>
    api.post<void>(
      "/workspace/auth/password/first",
      { newPassword },
      { ...pending, mock: () => mockChangePassword(newPassword) },
    ),
  forgotPassword: (usernameOrEmail: string) =>
    api.post<{ data: { isCommittee: boolean; emailMasked?: string } }>(
      "/workspace/auth/password/forgot",
      { usernameOrEmail },
      {
        ...pending,
        mock: () => {
          writeMock("reset-token", {
            token: crypto.randomUUID(),
            username: usernameOrEmail,
            expiresAt: Date.now() + 1_800_000,
          });
          return wrap({
            isCommittee: readMock("team", FIX.team).some(
              (member) => member.username === usernameOrEmail,
            ),
            emailMasked: "r••••@kolektifsawah.id",
          });
        },
      },
    ),
  resetPassword: (token: string, password: string) =>
    api.post<void>(
      "/workspace/auth/password/reset",
      { token, password },
      {
        ...pending,
        mock: async () => {
          const reset = readMock<{
            token: string;
            username: string;
            expiresAt: number;
          } | null>("reset-token", null);
          if (
            !reset ||
            reset.token !== token ||
            reset.expiresAt < Date.now() ||
            reset.username !== FIX.organizer.username
          )
            throw new ApiError(
              422,
              "TOKEN_EXPIRED",
              "Tautan tidak valid atau kedaluwarsa. Minta tautan baru.",
            );
          if (password.length < 12)
            throw new ApiError(
              422,
              "VALIDATION_ERROR",
              "Gunakan minimal 12 karakter.",
            );
          writeMock(`credential:${reset.username}`, {
            digest: await passwordDigest(password),
            temporary: false,
            expiresAt: "",
          });
          writeMock("reset-token", null);
          writeMock("workspace-session", null);
        },
      },
    ),
  logout: () =>
    api.post<void>("/workspace/auth/logout", undefined, {
      ...pending,
      mock: () => {
        writeMock("workspace-session", null);
        setCsrfToken(null);
      },
    }),
};
