/**
 * Satu pintu untuk semua request ke backend.
 *
 * - Cookie sesi dikirim otomatis (credentials: "include").
 * - Mutasi menyertakan header X-CSRF-Token dari GET /auth/me.
 * - Error backend `{ error: { code, message, fields } }` dilempar sebagai ApiError.
 * - Endpoint yang belum dibuat backend memakai `mock`. Lihat `shouldMock`.
 */

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "CSRF_INVALID"
  | "NOT_FOUND"
  | "SOLD_OUT"
  | "SALES_CLOSED"
  | "IDEMPOTENCY_CONFLICT"
  | "ORDER_NOT_PAYABLE"
  | "TICKET_ALREADY_USED"
  | "WRONG_EVENT"
  | "CHECKIN_CLOSED"
  | "INVALID_TICKET"
  | "PROVIDER_UNAVAILABLE"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | (string & {});

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    message: string,
    public fields?: Record<string, string>,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type Paginated<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number };
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";
const MOCK_ALL = process.env.NEXT_PUBLIC_API_MOCK === "true";

let csrfToken: string | null = null;
export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type RequestOptions<T> = {
  method?: Method;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  /** Data contoh dari desain, dipakai saat endpoint belum ada atau mode mock aktif. */
  mock?: () => T | Promise<T>;
  /**
   * true bila endpoint belum dibuat backend (issue B28 sampai B42).
   * Selama true, request selalu memakai `mock`. Ubah ke false begitu endpoint asli siap.
   */
  pending?: boolean;
  /** Teruskan cookie dari Server Component. */
  cookie?: string;
  signal?: AbortSignal;
};

function shouldMock(options: RequestOptions<unknown>) {
  return Boolean(options.mock) && (MOCK_ALL || options.pending === true);
}

const mockDelay = () => new Promise((resolve) => setTimeout(resolve, 350));

function buildUrl(path: string, query?: RequestOptions<unknown>["query"]) {
  const base =
    typeof window === "undefined"
      ? `${process.env.API_INTERNAL_URL ?? "http://localhost:4000"}/api/v1`
      : API_URL;
  const url = `${base}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function apiRequest<T>(path: string, options: RequestOptions<T> = {}): Promise<T> {
  if (shouldMock(options as RequestOptions<unknown>)) {
    await mockDelay();
    return options.mock!();
  }

  const method = options.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (method !== "GET" && csrfToken) headers["X-CSRF-Token"] = csrfToken;
  if (options.cookie) headers.cookie = options.cookie;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      credentials: "include",
      body:
        options.body === undefined
          ? undefined
          : isForm
            ? (options.body as FormData)
            : JSON.stringify(options.body),
      signal: options.signal,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Koneksi terputus. Periksa internet Anda lalu coba lagi.");
  }

  if (response.status === 204) return undefined as T;

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const error = json?.error ?? {};
    throw new ApiError(
      response.status,
      error.code ?? "UNKNOWN",
      error.message ?? "Terjadi kesalahan. Silakan coba lagi.",
      error.fields,
      error.details,
    );
  }
  return json as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions<T>, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions<T>, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions<T>, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions<T>, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: Omit<RequestOptions<T>, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "DELETE" }),
};

/** Membungkus data mock dalam bentuk respons backend. */
export const wrap = <T>(data: T) => ({ data });
export const page = <T>(data: T[], pageNo = 1, limit = 20): Paginated<T> => ({
  data,
  meta: { page: pageNo, limit, total: data.length },
});
