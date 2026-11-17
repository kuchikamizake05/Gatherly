"use client";

import { StateView } from "@/components/elements/StateView";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";

// Full workspace loading/error states for bands 15 through 19.
export function QueryState({
  loading,
  error,
  retry,
}: {
  loading?: boolean;
  error?: Error | null;
  retry: () => unknown;
}) {
  if (loading)
    return (
      <div
        className="flex w-full flex-1 flex-col gap-5 p-4 md:p-8"
        aria-busy="true"
        aria-label="Memuat halaman"
      >
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="min-h-80 flex-1" />
      </div>
    );
  const invalid =
    error instanceof ApiError && error.code === "INVALID_RESPONSE";
  const forbidden = error instanceof ApiError && error.status === 403;
  const missing = error instanceof ApiError && error.status === 404;
  return (
    <StateView
      illustration={missing ? "not-found" : "failed-load"}
      tone="error"
      title={
        forbidden
          ? "Akses tidak tersedia"
          : missing
            ? "Data tidak ditemukan"
            : "Halaman gagal dimuat"
      }
      description={
        forbidden
          ? "Penugasan Anda mungkin sudah dicabut. Hubungi organizer untuk memeriksa akses."
          : invalid
            ? error.message
            : "Periksa koneksi Anda, lalu coba lagi."
      }
      action={<Button onClick={() => void retry()}>Coba lagi</Button>}
    />
  );
}
