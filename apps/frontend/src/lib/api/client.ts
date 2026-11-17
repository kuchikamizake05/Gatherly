/**
 * Satu pintu untuk semua request ke backend.
 *
 * - Cookie sesi dikirim otomatis (credentials: "include").
 * - Mutasi menyertakan header X-CSRF-Token dari GET /auth/me.
 * - Error backend `{ error: { code, message, fields } }` dilempar sebagai ApiError.
 * - Mock hanya aktif bila NEXT_PUBLIC_API_MOCK=true, termasuk untuk endpoint pending.
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

const API_URL = (process.env.NEXT_PUBLIC_API_URL?.trim() || "/api/v1").replace(
  /\/$/,
  "",
);
const MOCK_ALL = process.env.NEXT_PUBLIC_API_MOCK === "true";

export const SESSION_EXPIRED_EVENT = "gatherly:session-expired";

let csrfToken: string | null = null;
export function setCsrfToken(token: string | null) {
  // SSR requests must never share one user's CSRF token with another request.
  if (typeof window !== "undefined") csrfToken = token;
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type RequestOptions<T> = {
  method?: Method;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  /** Data contoh, hanya dieksekusi dalam mode mock eksplisit. */
  mock?: () => T | Promise<T>;
  /**
   * true bila endpoint belum dibuat backend (issue B28 sampai B42).
   * Metadata kontrak backend. Flag ini tidak mengaktifkan mock atau menyamarkan kegagalan API.
   */
  pending?: boolean;
  /** Teruskan cookie dari Server Component. */
  cookie?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

function shouldMock(options: RequestOptions<unknown>) {
  return Boolean(options.mock) && MOCK_ALL;
}

const mockDelay = () => new Promise((resolve) => setTimeout(resolve, 350));

function buildUrl(path: string, query?: RequestOptions<unknown>["query"]) {
  const base =
    typeof window === "undefined"
      ? `${(process.env.API_INTERNAL_URL?.trim() || "http://localhost:4000").replace(/\/$/, "")}/api/v1`
      : API_URL;
  const url = `${base}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "")
      params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

function sessionExpired(
  path: string,
  status: number,
  requestCsrf: string | null,
) {
  if (
    requestCsrf !== csrfToken ||
    status !== 401 ||
    typeof window === "undefined" ||
    /\/auth\/(login|register|otp|verify|password\/(forgot|reset))/.test(path)
  )
    return;
  setCsrfToken(null);
  const scope = /^\/(workspace|organizer|committee)(\/|$)/.test(path)
    ? "workspace"
    : path.startsWith("/admin")
      ? "admin"
      : "buyer";
  window.dispatchEvent(
    new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { scope } }),
  );
}
function statusMessage(status: number) {
  if (status === 401) return "Sesi Anda telah berakhir. Silakan masuk kembali.";
  if (status === 403) return "Anda tidak memiliki akses untuk tindakan ini.";
  if (status === 404 || status === 501)
    return "Layanan atau data yang diminta belum tersedia.";
  if (status === 429)
    return "Terlalu banyak permintaan. Tunggu beberapa saat lalu coba lagi.";
  if (status >= 500)
    return "Layanan sedang bermasalah. Silakan coba lagi beberapa saat lagi.";
  return "Permintaan belum dapat diproses. Periksa isian Anda lalu coba lagi.";
}
function responseError(
  path: string,
  status: number,
  json: unknown,
  requestId: string | null,
  requestCsrf: string | null,
) {
  sessionExpired(path, status, requestCsrf);
  const body =
    json && typeof json === "object" && "error" in json ? json.error : null;
  const error =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const fields =
    error.fields && typeof error.fields === "object"
      ? Object.fromEntries(
          Object.entries(error.fields).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string",
          ),
        )
      : undefined;
  return new ApiError(
    status,
    typeof error.code === "string" ? error.code : "HTTP_ERROR",
    status >= 500 || typeof error.message !== "string"
      ? statusMessage(status)
      : error.message,
    fields,
    {
      ...(error.details && typeof error.details === "object"
        ? error.details
        : {}),
      ...(requestId ? { requestId } : {}),
    },
  );
}
function invalidResponse() {
  return new ApiError(
    502,
    "INVALID_RESPONSE",
    "Respons layanan belum dapat dibaca. Silakan coba lagi atau hubungi bantuan.",
  );
}
export async function apiRequest<T>(
  path: string,
  options: RequestOptions<T> = {},
): Promise<T> {
  if (options.signal?.aborted)
    throw new ApiError(0, "ABORTED", "Permintaan dibatalkan.");
  if (shouldMock(options as RequestOptions<unknown>)) {
    await mockDelay();
    if (options.signal?.aborted)
      throw new ApiError(0, "ABORTED", "Permintaan dibatalkan.");
    return options.mock!();
  }
  const requestCsrf = csrfToken;
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...options.headers,
  };
  const isForm =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body !== undefined && !isForm)
    headers["Content-Type"] = "application/json";
  if (method !== "GET" && csrfToken) headers["X-CSRF-Token"] = csrfToken;
  if (options.cookie) headers.cookie = options.cookie;
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 20_000);
  try {
    const response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      credentials: "include",
      body:
        options.body === undefined
          ? undefined
          : isForm
            ? (options.body as FormData)
            : JSON.stringify(options.body),
      signal: controller.signal,
      cache: "no-store",
    });
    if (response.status === 204 || response.status === 205)
      return undefined as T;
    const raw = await response.text();
    let json: unknown;
    try {
      json = raw ? JSON.parse(raw) : undefined;
    } catch {
      if (response.ok) throw invalidResponse();
    }
    if (!response.ok)
      throw responseError(
        path,
        response.status,
        json,
        response.headers.get("X-Request-Id"),
        requestCsrf,
      );
    if (json === undefined && method === "GET") throw invalidResponse();
    return json as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (options.signal?.aborted)
      throw new ApiError(0, "ABORTED", "Permintaan dibatalkan.");
    if (timedOut)
      throw new ApiError(
        0,
        "REQUEST_TIMEOUT",
        "Respons layanan terlalu lama. Periksa status terbaru sebelum mengulangi tindakan ini.",
      );
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Koneksi terputus. Periksa internet Anda lalu coba lagi.",
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

export const api = {
  get: <T>(
    path: string,
    options?: Omit<RequestOptions<T>, "method" | "body">,
  ) => apiRequest<T>(path, { ...options, method: "GET" }),
  post: <T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions<T>, "method" | "body">,
  ) => apiRequest<T>(path, { ...options, method: "POST", body }),
  patch: <T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions<T>, "method" | "body">,
  ) => apiRequest<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions<T>, "method" | "body">,
  ) => apiRequest<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(
    path: string,
    options?: Omit<RequestOptions<T>, "method" | "body">,
  ) => apiRequest<T>(path, { ...options, method: "DELETE" }),
};

/**
 * Unggah satu berkas dengan progres (XHR, karena fetch belum punya progres unggah).
 * Cookie sesi dan header CSRF ikut terkirim. Dipakai FileUpload: dokumen pengajuan, poster acara, logo.
 *
 * upload<{ data: UploadedFile }>("/organizer-applications/documents", file, { field: "file", onProgress, signal })
 */
export function upload<T>(
  path: string,
  file: File,
  options: {
    field?: string;
    extra?: Record<string, string>;
    onProgress?: (percent: number) => void;
    signal?: AbortSignal;
    mock?: () => T | Promise<T>;
    pending?: boolean;
  } = {},
): Promise<T> {
  if (options.mock && MOCK_ALL) {
    // Simulasi progres supaya tampilan unggah bisa dicek tanpa backend.
    return new Promise<T>((resolve, reject) => {
      let p = 0;
      const id = setInterval(() => {
        if (options.signal?.aborted) {
          clearInterval(id);
          reject(new ApiError(0, "ABORTED", "Unggahan dibatalkan."));
          return;
        }
        p = Math.min(100, p + 20);
        options.onProgress?.(p);
        if (p === 100) {
          clearInterval(id);
          try {
            resolve(options.mock!());
          } catch (error) {
            reject(error);
          }
        }
      }, 120);
    });
  }

  return new Promise<T>((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new ApiError(0, "ABORTED", "Unggahan dibatalkan."));
      return;
    }
    const requestCsrf = csrfToken;
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const cleanup = () => options.signal?.removeEventListener("abort", abort);
    const fail = (error: unknown) => {
      cleanup();
      reject(error);
    };
    xhr.open("POST", buildUrl(path));
    xhr.timeout = 60_000;
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");
    if (csrfToken) xhr.setRequestHeader("X-CSRF-Token", csrfToken);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        options.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let json: unknown;
      try {
        json = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        if (xhr.status >= 200 && xhr.status < 300) {
          fail(invalidResponse());
          return;
        }
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        cleanup();
        if (json === undefined && xhr.status !== 204) {
          reject(invalidResponse());
          return;
        }
        resolve(json as T);
        return;
      }
      fail(
        responseError(
          path,
          xhr.status,
          json,
          xhr.getResponseHeader("X-Request-Id"),
          requestCsrf,
        ),
      );
    };
    xhr.onerror = () =>
      fail(
        new ApiError(
          0,
          "NETWORK_ERROR",
          "Koneksi terputus. Periksa internet Anda lalu coba lagi.",
        ),
      );
    xhr.ontimeout = () =>
      fail(
        new ApiError(
          0,
          "REQUEST_TIMEOUT",
          "Unggahan terlalu lama. Periksa status berkas sebelum mencoba lagi.",
        ),
      );
    xhr.onabort = () =>
      fail(new ApiError(0, "ABORTED", "Unggahan dibatalkan."));
    options.signal?.addEventListener("abort", abort, { once: true });
    const body = new FormData();
    body.append(options.field ?? "file", file);
    for (const [key, value] of Object.entries(options.extra ?? {}))
      body.append(key, value);
    xhr.send(body);
  });
}

/** Membungkus data mock dalam bentuk respons backend. */
export const wrap = <T>(data: T) => ({ data });
export const page = <T>(data: T[], pageNo = 1, limit = 20): Paginated<T> => ({
  data,
  meta: { page: pageNo, limit, total: data.length },
});
