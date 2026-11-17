import { api, setCsrfToken, wrap } from "@/lib/api/client";
import { FIX } from "@/modules/_mock/fixtures";

import type { LoginInput, Me, OtpChallenge, RegisterInput, VerifyInput } from "./types";

/**
 * Auth peserta di situs utama. Pita desain 10 dan 11.
 * Endpoint register, login, verify, resend, me, dan logout sudah ada di backend.
 * Lupa password belum ada (issue B36), jadi masih pending.
 */

const mockMe: Me = {
  user: {
    id: FIX.buyer.id,
    name: FIX.buyer.name,
    email: FIX.buyer.email,
    phone: FIX.buyer.phone,
    hasPassword: true,
    googleLinked: true,
    createdAt: FIX.buyer.joinedAt,
  },
  organizerId: null,
  hasCommitteeAssignments: false,
  csrfToken: "mock-csrf",
};

const mockChallenge = (): OtpChallenge => ({
  challengeId: "ch_mock",
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  resendAt: new Date(Date.now() + 60_000).toISOString(),
  emailMasked: "a••••@mail.ugm.ac.id",
});

export const authApi = {
  async me(cookie?: string) {
    const res = await api.get<{ data: Me }>("/auth/me", { cookie, mock: () => wrap(mockMe) });
    setCsrfToken(res.data.csrfToken);
    return res.data;
  },
  register: (input: RegisterInput) =>
    api.post<{ data: OtpChallenge }>("/auth/register", input, { mock: () => wrap(mockChallenge()) }),
  // Sesi baru membawa token CSRF baru. Tanpa ini, aksi pertama setelah masuk (misalnya Keluar) ditolak sampai halaman dimuat ulang.
  async verifyRegister(input: VerifyInput) {
    const res = await api.post<{ data: Me }>("/auth/register/verify", input, { mock: () => wrap(mockMe) });
    setCsrfToken(res.data.csrfToken);
    return res;
  },
  login: (input: LoginInput) =>
    api.post<{ data: OtpChallenge }>("/auth/login", input, { mock: () => wrap(mockChallenge()) }),
  // Sesi baru membawa token CSRF baru. Tanpa ini, aksi pertama setelah masuk (misalnya Keluar) ditolak sampai halaman dimuat ulang.
  async verifyLogin(input: VerifyInput) {
    const res = await api.post<{ data: Me }>("/auth/login/verify", input, { mock: () => wrap(mockMe) });
    setCsrfToken(res.data.csrfToken);
    return res;
  },
  resendOtp: (challengeId: string) =>
    api.post<{ data: OtpChallenge }>("/auth/otp/resend", { challengeId }, { mock: () => wrap(mockChallenge()) }),
  logout: () => api.post<void>("/auth/logout", undefined, { mock: () => undefined }),
  /** Arahkan browser ke sini untuk masuk dengan Google. */
  googleUrl: (returnTo = "/") => `/api/v1/auth/google?returnTo=${encodeURIComponent(returnTo)}`,

  // B36 password recovery
  forgotPassword: (email: string) =>
    api.post<void>("/auth/password/forgot", { email }, { mock: () => undefined }),
  resetPassword: (token: string, password: string) =>
    api.post<void>("/auth/password/reset", { token, password }, { mock: () => undefined }),
};
