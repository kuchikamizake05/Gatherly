import { api, setCsrfToken, wrap } from "@/lib/api/client";
import { FIX } from "@/modules/_mock/fixtures";

/**
 * Login organizer dan panitia di organizer.gatherly.xyz. Pita desain 14.
 * Semua pending (issue B28): akun username + password, terpisah dari akun peserta.
 */

export type WorkspaceRole = "organizer" | "committee";

export type WorkspaceMe = {
  role: WorkspaceRole;
  username: string;
  name: string;
  /** true bila masih memakai password sementara, wajib diarahkan ke ganti password. */
  mustChangePassword: boolean;
  organizer: { id: string; name: string; username: string; frozen: boolean; frozenReason?: string | null };
  csrfToken: string;
};

const pending = { pending: false } as const;

const mockOrganizer: WorkspaceMe = {
  role: "organizer",
  username: FIX.organizer.username,
  name: FIX.organizer.pic.name,
  mustChangePassword: false,
  organizer: { id: FIX.organizer.id, name: FIX.organizer.name, username: FIX.organizer.username, frozen: false },
  csrfToken: "mock-csrf",
};

export const organizerAuthApi = {
  async me(cookie?: string) {
    const res = await api.get<{ data: WorkspaceMe }>("/workspace/auth/me", { cookie, ...pending, mock: () => wrap(mockOrganizer) });
    setCsrfToken(res.data.csrfToken);
    return res.data;
  },
  login: (username: string, password: string) =>
    api.post<{ data: WorkspaceMe }>("/workspace/auth/login", { username, password }, {
      ...pending,
      mock: () =>
        wrap(
          username.includes(".")
            ? { ...mockOrganizer, role: "committee" as const, username, name: "Dimas Satria" }
            : mockOrganizer,
        ),
    }),
  /** Login pertama: ganti password sementara. */
  changeTemporaryPassword: (newPassword: string) =>
    api.post<void>("/workspace/auth/password/first", { newPassword }, { ...pending, mock: () => undefined }),
  forgotPassword: (usernameOrEmail: string) =>
    api.post<{ data: { isCommittee: boolean; emailMasked?: string } }>(
      "/workspace/auth/password/forgot",
      { usernameOrEmail },
      { ...pending, mock: () => wrap({ isCommittee: usernameOrEmail.includes("."), emailMasked: "r••••@kolektifsawah.id" }) },
    ),
  resetPassword: (token: string, password: string) =>
    api.post<void>("/workspace/auth/password/reset", { token, password }, { ...pending, mock: () => undefined }),
  logout: () => api.post<void>("/workspace/auth/logout", undefined, { ...pending, mock: () => undefined }),
};
