"use client";

import { WifiOff } from "lucide-react";

import { useOnline } from "@/hooks/use-online";

/**
 * Banner luring di bawah navbar atau topbar. Selebar layar.
 * Isi yang sudah dimuat tetap terlihat. Tombol yang butuh koneksi (Beli tiket, Bayar, Simpan)
 * dinonaktifkan oleh masing-masing halaman lewat useOnline().
 */
export function OfflineBanner({ message = "Anda sedang luring. Isi yang sudah dimuat tetap dapat dibaca." }: { message?: string }) {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="flex w-full items-center gap-3 bg-warning-tint px-4 py-3 text-sm font-semibold text-warning-ink md:px-8">
      <WifiOff className="size-[18px] shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
