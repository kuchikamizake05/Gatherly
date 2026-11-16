"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { StateView } from "@/components/elements/StateView";

/** Keadaan halaman checkout dan status pesanan. Pita 05 baris F. */

export function OrderNotFound() {
  return (
    <StateView
      illustration="not-found"
      title="Pesanan tidak ditemukan"
      description="Pesanan ini tidak ada atau bukan milik akun Anda."
      action={
        <Button asChild>
          <Link href="/tickets">Buka Tiketku</Link>
        </Button>
      }
    />
  );
}

export function OrderLoadError({ onRetry, retrying }: { onRetry: () => void; retrying?: boolean }) {
  return (
    <StateView
      tone="error"
      illustration="failed-load"
      title="Status pesanan gagal dimuat"
      description="Pembayaran Anda tetap aman. Periksa koneksi internet, lalu coba lagi."
      action={
        <Button onClick={onRetry} loading={retrying}>
          Coba lagi
        </Button>
      }
    />
  );
}

export function CheckoutSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-[1120px] gap-8 px-4 pt-6 md:px-6 xl:grid-cols-[minmax(0,680px)_400px] xl:justify-between xl:px-0" aria-busy>
      <div className="flex flex-col gap-5">
        <span className="skeleton hidden h-8 w-full rounded md:block" />
        <span className="skeleton h-9 w-56 rounded" />
        <span className="skeleton h-[180px] w-full rounded-lg" />
        <span className="skeleton h-[280px] w-full rounded-lg" />
      </div>
      <span className="skeleton hidden h-[260px] w-full rounded-xl md:block" />
    </div>
  );
}
