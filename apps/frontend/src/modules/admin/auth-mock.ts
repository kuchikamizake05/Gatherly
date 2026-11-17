import { ApiError, wrap } from "@/lib/api/client";

const sessionKey = "gatherly_admin_demo_session";
const challengeKey = "gatherly_admin_demo_challenge";
const demoUser = {
  id: "adm_nadia",
  name: "Nadia",
  email: "nadia@gatherly.xyz",
  csrfToken: "mock-csrf",
};

/** Only called by pending mock adapters, never by the real authentication API. */
export const adminAuthMock = {
  login(email: string, password: string) {
    if (!navigator.onLine)
      throw new ApiError(0, "NETWORK_ERROR", "Koneksi terputus.");
    if (email === "locked@gatherly.xyz")
      throw new ApiError(423, "ACCOUNT_LOCKED", "Akun dikunci.");
    if (email === "disabled@gatherly.xyz")
      throw new ApiError(403, "ACCOUNT_DISABLED", "Akun dinonaktifkan.");
    if (email === "limited@gatherly.xyz")
      throw new ApiError(429, "RATE_LIMITED", "Terlalu banyak percobaan.");
    if (email !== demoUser.email || password !== "GatherlyDemo123!")
      throw new ApiError(
        401,
        "UNAUTHENTICATED",
        "Email atau password tidak sesuai.",
      );
    const challengeId = crypto.randomUUID();
    sessionStorage.setItem(
      challengeKey,
      JSON.stringify({ id: challengeId, expiresAt: Date.now() + 600_000 }),
    );
    return wrap({ challengeId });
  },
  verify(
    challengeId: string,
    code: string,
    backup: boolean,
    rememberDevice = false,
  ) {
    if (!navigator.onLine)
      throw new ApiError(0, "NETWORK_ERROR", "Koneksi terputus.");
    const raw = sessionStorage.getItem(challengeKey);
    const challenge = raw
      ? (JSON.parse(raw) as { id: string; expiresAt: number })
      : null;
    if (
      !challenge ||
      challenge.id !== challengeId ||
      challenge.expiresAt <= Date.now()
    )
      throw new ApiError(401, "CHALLENGE_EXPIRED", "Sesi verifikasi berakhir.");
    if (code !== (backup ? "DEMO-BACKUP-01" : "123456"))
      throw new ApiError(409, "INVALID_CODE", "Kode tidak sesuai.");
    if (backup && sessionStorage.getItem("gatherly_admin_backup_used"))
      throw new ApiError(409, "INVALID_CODE", "Kode sudah digunakan.");
    if (backup) sessionStorage.setItem("gatherly_admin_backup_used", "true");
    if (rememberDevice)
      localStorage.setItem(
        "gatherly_admin_demo_remember",
        String(Date.now() + 7 * 86400000),
      );
    sessionStorage.removeItem(challengeKey);
    sessionStorage.setItem(
      sessionKey,
      JSON.stringify({
        ...demoUser,
        expiresAt: Date.now() + 8 * 3600000,
        lastActiveAt: Date.now(),
      }),
    );
    return wrap(demoUser);
  },
  me() {
    if (
      typeof window === "undefined" ||
      (!sessionStorage.getItem(sessionKey) &&
        Number(localStorage.getItem("gatherly_admin_demo_remember")) <=
          Date.now())
    )
      throw new ApiError(401, "UNAUTHENTICATED", "Sesi berakhir.");
    const raw = sessionStorage.getItem(sessionKey);
    if (raw) {
      let session: { expiresAt: number; lastActiveAt: number };
      try {
        session = JSON.parse(raw);
      } catch {
        sessionStorage.removeItem(sessionKey);
        throw new ApiError(401, "SESSION_EXPIRED", "Sesi berakhir.");
      }
      if (
        !session.expiresAt ||
        session.expiresAt <= Date.now() ||
        session.lastActiveAt + 30 * 60000 <= Date.now()
      ) {
        sessionStorage.removeItem(sessionKey);
        throw new ApiError(401, "SESSION_EXPIRED", "Sesi berakhir.");
      }
      sessionStorage.setItem(
        sessionKey,
        JSON.stringify({ ...session, lastActiveAt: Date.now() }),
      );
    }
    return wrap(demoUser);
  },
  logout() {
    sessionStorage.removeItem(sessionKey);
    sessionStorage.removeItem(challengeKey);
    localStorage.removeItem("gatherly_admin_demo_remember");
  },
};
