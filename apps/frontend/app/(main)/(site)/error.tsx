"use client";

import { Button } from "@/components/ui/button";
import { StateView } from "@/components/elements/state-view";

/** Keadaan "Gagal memuat" untuk halaman di grup ini. */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <StateView
      tone="error"
      illustration="failed-load"
      title="Halaman gagal dimuat"
      description="Periksa koneksi Anda lalu coba lagi. Data Anda tetap aman."
      action={<Button onClick={reset}>Coba lagi</Button>}
    />
  );
}
