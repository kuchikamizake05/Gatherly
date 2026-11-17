import { ApiError } from "@/lib/api/client";

type Change = Record<string, unknown>;
type Store = Record<string, Record<string, Change>>;
const key = "gatherly_admin_demo_changes_v1";

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "{}");
  } catch {
    return {};
  }
}

/** Session-scoped changes to fixtures. Only used inside pending mock callbacks. */
export function mockChange(scope: string, id: string, change: Change) {
  mockScenario(scope);
  if (!navigator.onLine)
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Periksa koneksi Anda lalu coba lagi.",
    );
  const state = read();
  state[scope] ??= {};
  state[scope][id] = { ...state[scope][id], ...change };
  sessionStorage.setItem(key, JSON.stringify(state));
}

export function mockRow<T extends { id: string }>(scope: string, row: T): T {
  return { ...row, ...read()[scope]?.[row.id] };
}

/** Explicit mock-only scenarios for reproducible UI testing; no real API is intercepted. */
export function mockScenario(scope: string) {
  if (!navigator.onLine)
    throw new ApiError(0, "NETWORK_ERROR", "Koneksi terputus.");
  const scenario = sessionStorage.getItem(`gatherly_admin_scenario_${scope}`);
  if (scenario === "error")
    throw new ApiError(503, "UNAVAILABLE", "Layanan tidak tersedia.");
  return scenario;
}
