import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/** Halaman masuk dan daftar: form di kiri, panel gambar di kanan (desktop). Pita 10 dan 11. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh xl:grid-cols-2">
      <div className="flex flex-col px-4 py-6 md:px-12">
        <Link href="/" aria-label="Gatherly, ke beranda">
          <Image src="/gatherly-horizontal-ink.svg" alt="Gatherly" width={120} height={30} priority />
        </Link>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">{children}</div>
      </div>
      <div className="hidden bg-primary xl:block" aria-hidden />
    </div>
  );
}
