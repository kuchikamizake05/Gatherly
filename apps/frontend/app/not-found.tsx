import Link from "next/link";

import { Button } from "@/components/ui/button";
import { StateView } from "@/components/elements/StateView";

/** 404 global, dipakai juga saat domain utama membuka /organizer atau /admin. Layar penuh tanpa shell. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh w-full flex-col">
      <StateView
        layout="screen"
        illustration="not-found"
        title="Halaman tidak ditemukan"
        description="Tautan mungkin salah ketik atau halamannya sudah tidak tersedia."
        action={
          <Button asChild>
            <Link href="/">Kembali ke beranda</Link>
          </Button>
        }
      />
    </main>
  );
}
