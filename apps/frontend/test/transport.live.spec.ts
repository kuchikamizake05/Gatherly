import {
  formatTime,
  formatTimeRange,
  formatDateShort,
  formatDateLong,
  formatDateTimeCompact,
} from "../src/lib/format";
import { test, expect } from "@playwright/test";
import { apiRequest, setCsrfToken } from "../src/lib/api/client";
import { organizerAuthApi } from "../src/modules/organizer-auth/api";

test("pending metadata never falls back to a mock in live mode", async () => {
  const original = globalThis.fetch;
  let mocked = false;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: { code: "NOT_FOUND", message: "Endpoint unavailable" },
      }),
      { status: 404 },
    );
  try {
    await expect(
      apiRequest("/workspace/unavailable", {
        pending: true,
        mock: () => {
          mocked = true;
          return { fake: true };
        },
      }),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect(mocked).toBe(false);
  } finally {
    globalThis.fetch = original;
  }
});
test("bounds requests and distinguishes explicit cancellation from timeouts", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, options) =>
    new Promise((_resolve, reject) => {
      options?.signal?.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    });
  try {
    await expect(apiRequest("/slow", { timeoutMs: 20 })).rejects.toMatchObject({
      code: "REQUEST_TIMEOUT",
    });
    const controller = new AbortController();
    controller.abort();
    await expect(
      apiRequest("/cancelled", { signal: controller.signal }),
    ).rejects.toMatchObject({ code: "ABORTED" });
  } finally {
    globalThis.fetch = original;
  }
});
test("does not retain browser CSRF credentials between server requests", async () => {
  const original = globalThis.fetch;
  const headers: HeadersInit[] = [];
  globalThis.fetch = async (_url, options) => {
    headers.push(options?.headers ?? {});
    return new Response(null, { status: 204 });
  };
  try {
    setCsrfToken("first-user-secret");
    await apiRequest("/protected", { method: "POST", cookie: "session=first" });
    await apiRequest("/protected", {
      method: "POST",
      cookie: "session=second",
    });
    for (const value of headers)
      expect(new Headers(value).has("X-CSRF-Token")).toBe(false);
    expect(new Headers(headers[1]).get("cookie")).toBe("session=second");
  } finally {
    globalThis.fetch = original;
  }
});
test("rejects an unknown workspace role returned by the server", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        data: {
          role: "admin",
          username: "unexpected",
          name: "Unexpected",
          mustChangePassword: false,
          organizer: {
            id: "org1",
            name: "Organizer",
            username: "org",
            frozen: false,
          },
          csrfToken: "token",
        },
      }),
      { status: 200 },
    );
  try {
    await expect(
      organizerAuthApi.login("unexpected", "not-a-real-password"),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  } finally {
    globalThis.fetch = original;
  }
});

test("renders WIB consistently when the server timezone differs from Indonesia", () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ["UTC", "America/Los_Angeles"]) {
      process.env.TZ = zone;
      expect(formatTime("2026-11-21T20:30:00Z")).toBe("03.30 WIB");
      expect(formatDateShort("2026-11-21T20:30:00Z")).toBe("Min, 22 Nov 2026");
      expect(formatDateLong("2026-11-21T20:30:00Z")).toBe(
        "Minggu, 22 November 2026",
      );
      expect(formatDateTimeCompact("2026-11-21T20:30:00Z")).toBe(
        "22 Nov, 03.30",
      );
      expect(
        formatTimeRange("2026-11-21T08:00:00Z", "2026-11-21T15:00:00Z"),
      ).toBe("15.00 – 22.00 WIB");
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
