import { api, wrap } from "@/lib/api/client";
import { FIX } from "@/modules/_mock/fixtures";

/** Akun saya di gatherly.xyz. Pita desain 12. Semua endpoint pending (issue B36). */

export type Account = {
  name: string;
  email: string;
  phone: string | null;
  joinedAt: string;
  passwordChangedAt: string | null;
  hasPassword: boolean;
  googleEmail: string | null;
  activeDevices: number;
  notifications: { reminders: boolean; recommendations: boolean };
};

export type UpdateProfileInput = { name: string; phone: string | null };
export type ChangePasswordInput = { currentPassword?: string; newPassword: string };

const mockAccount: Account = {
  name: FIX.buyer.name,
  email: FIX.buyer.email,
  phone: FIX.buyer.phone,
  joinedAt: FIX.buyer.joinedAt,
  passwordChangedAt: "2026-08-16T02:00:00Z",
  hasPassword: true,
  googleEmail: FIX.buyer.googleEmail,
  activeDevices: 3,
  notifications: { reminders: true, recommendations: false },
};

const pending = { pending: true } as const;

export const accountApi = {
  get: () => api.get<{ data: Account }>("/account", { ...pending, mock: () => wrap(mockAccount) }),
  updateProfile: (input: UpdateProfileInput) =>
    api.patch<{ data: Account }>("/account", input, { ...pending, mock: () => wrap({ ...mockAccount, ...input }) }),
  changePassword: (input: ChangePasswordInput) =>
    api.post<void>("/account/password", input, { ...pending, mock: () => undefined }),
  unlinkGoogle: () => api.delete<void>("/account/google", { ...pending, mock: () => undefined }),
  signOutOtherDevices: () => api.post<void>("/account/sessions/revoke-others", undefined, { ...pending, mock: () => undefined }),
  updateNotifications: (input: Account["notifications"]) =>
    api.patch<void>("/account/notifications", input, { ...pending, mock: () => undefined }),
  /** Ditolak (409) bila masih punya tiket untuk acara yang akan datang. */
  deleteAccount: (confirmation: string) =>
    api.post<void>("/account/delete", { confirmation }, { ...pending, mock: () => undefined }),
};
