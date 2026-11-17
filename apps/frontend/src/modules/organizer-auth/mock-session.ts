import { ApiError } from "@/lib/api/client";
import type { TeamMember } from "@/modules/team/api";
import { FIX } from "@/modules/_mock/fixtures";
import { readMock, writeMock } from "@/modules/_mock/store";
import type { WorkspaceMe } from "./api";

export const DEMO_PASSWORD = "GatherlyDemo2026!";
export async function passwordDigest(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function mockSession() {
  const session = readMock<WorkspaceMe | null>("workspace-session", null);
  if (!session)
    throw new ApiError(
      401,
      "UNAUTHENTICATED",
      "Sesi Anda telah berakhir. Silakan masuk kembali.",
    );
  if (session.role === "committee") {
    const member = readMock("team", FIX.team).find(
      (m) => m.username === session.username,
    );
    if (!member || member.status === "inactive")
      throw new ApiError(
        401,
        "UNAUTHENTICATED",
        "Akses akun telah dicabut. Hubungi organizer.",
      );
  }
  return session;
}
export async function mockLogin(username: string, password: string) {
  const attempts = readMock("workspace-attempts", { count: 0, until: 0 });
  if (attempts.until > Date.now())
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "Terlalu banyak percobaan. Coba lagi dalam 10 menit.",
    );
  const members = readMock("team", FIX.team);
  const member = members.find((item) => item.username === username);
  const organizer = username === FIX.organizer.username;
  const credential = readMock<{
    digest: string;
    expiresAt: string;
    temporary: boolean;
  } | null>(`credential:${username}`, null);
  const valid = credential
    ? (await passwordDigest(password)) === credential.digest
    : password === DEMO_PASSWORD;
  if ((!organizer && !member) || !valid) {
    const count =
      attempts.until && attempts.until <= Date.now() ? 1 : attempts.count + 1;
    writeMock("workspace-attempts", {
      count,
      until: count >= 5 ? Date.now() + 600_000 : 0,
    });
    throw new ApiError(
      count >= 5 ? 429 : 401,
      "INVALID_CREDENTIALS",
      count >= 5
        ? "Terlalu banyak percobaan. Coba lagi dalam 10 menit."
        : "Username atau password tidak cocok.",
    );
  }
  if (member?.status === "inactive")
    throw new ApiError(
      403,
      "ACCOUNT_INACTIVE",
      "Akun Anda dinonaktifkan. Hubungi organizer.",
    );
  if (credential?.temporary && Date.parse(credential.expiresAt) < Date.now())
    throw new ApiError(
      403,
      "TEMPORARY_PASSWORD_EXPIRED",
      "Password sementara kedaluwarsa. Hubungi organizer untuk meminta password baru.",
    );
  writeMock("workspace-attempts", { count: 0, until: 0 });
  const session: WorkspaceMe = {
    role: organizer ? "organizer" : "committee",
    username,
    name: organizer ? FIX.organizer.pic.name : member!.name,
    mustChangePassword:
      credential?.temporary ?? member?.status === "never_logged_in",
    organizer: {
      id: FIX.organizer.id,
      name: FIX.organizer.name,
      username: FIX.organizer.username,
      frozen: false,
    },
    csrfToken: "mock-csrf",
  };
  return writeMock("workspace-session", session);
}
export async function mockChangePassword(password: string, current?: string) {
  const session = mockSession();
  const credential = readMock<{ digest: string } | null>(
    `credential:${session.username}`,
    null,
  );
  const previous = credential?.digest ?? (await passwordDigest(DEMO_PASSWORD));
  if (current && (await passwordDigest(current)) !== previous) {
    const attempts = readMock("password-attempts", { count: 0, until: 0 });
    const count =
      attempts.until && attempts.until <= Date.now() ? 1 : attempts.count + 1;
    writeMock("password-attempts", {
      count,
      until: count >= 5 ? Date.now() + 600_000 : 0,
    });
    throw new ApiError(
      count >= 5 ? 429 : 422,
      "WRONG_PASSWORD",
      count >= 5
        ? "Coba lagi dalam 10 menit."
        : "Password saat ini tidak cocok.",
    );
  }
  const lock = readMock("password-attempts", { count: 0, until: 0 });
  if (lock.until > Date.now())
    throw new ApiError(429, "RATE_LIMITED", "Coba lagi dalam 10 menit.");
  const digest = await passwordDigest(password);
  if (password.length < 12 || digest === previous)
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      "Gunakan minimal 12 karakter dan password yang berbeda.",
    );
  writeMock(`credential:${session.username}`, {
    digest,
    temporary: false,
    expiresAt: "",
  });
  writeMock("password-attempts", { count: 0, until: 0 });
  if (session.role === "committee")
    writeMock(
      "team",
      readMock<TeamMember[]>("team", FIX.team).map((member) =>
        member.username === session.username
          ? { ...member, status: "active" }
          : member,
      ),
    );
  writeMock("workspace-session", { ...session, mustChangePassword: false });
}
