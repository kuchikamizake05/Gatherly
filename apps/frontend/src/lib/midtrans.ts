/**
 * Midtrans Snap. Skrip dimuat sekali saat dibutuhkan, memakai NEXT_PUBLIC_MIDTRANS_CLIENT_KEY.
 * Sandbox dipakai bila NEXT_PUBLIC_MIDTRANS_PRODUCTION bukan "true".
 */

type SnapResult = Record<string, unknown>;
export type SnapCallbacks = {
  onSuccess?: (r: SnapResult) => void;
  onPending?: (r: SnapResult) => void;
  onError?: (r: SnapResult) => void;
  onClose?: () => void;
};

declare global {
  interface Window {
    snap?: { pay: (token: string, callbacks: SnapCallbacks) => void };
  }
}

const PRODUCTION = process.env.NEXT_PUBLIC_MIDTRANS_PRODUCTION === "true";
const SRC = PRODUCTION ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js";

let loading: Promise<void> | null = null;

export function loadSnap() {
  if (typeof window === "undefined") return Promise.reject(new Error("Snap hanya berjalan di browser"));
  if (window.snap) return Promise.resolve();
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SRC;
      script.setAttribute("data-client-key", process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? "");
      script.onload = () => resolve();
      script.onerror = () => {
        loading = null;
        reject(new Error("Gagal memuat Midtrans"));
      };
      document.body.appendChild(script);
    });
  }
  return loading;
}

/** Buka popup Snap. Token mock (mode data contoh) langsung dianggap pending tanpa membuka Snap. */
export async function openSnap(token: string, callbacks: SnapCallbacks) {
  if (token.startsWith("mock-")) {
    callbacks.onPending?.({});
    return;
  }
  await loadSnap();
  window.snap!.pay(token, callbacks);
}
