import Image from "next/image";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { OfflineBanner } from "@/components/elements/OfflineBanner";
import { CloseButton } from "./AuthUi";

/**
 * Halaman masuk, daftar, verifikasi, dan lupa password. Pita 10 dan 11.
 * Desktop: form di kiri, panel kuning dengan kolase poster di kanan.
 * Tablet: form di tengah tanpa panel. Mobile: tombol tutup di kiri atas, aksi utama menempel di bawah.
 */

const UNSPLASH = (id: string) => `https://images.unsplash.com/${id}?w=600&q=80&auto=format&fit=crop`;

/** Posisi dan rotasi sama dengan frame "Brand side" di desain (lebar 640, tinggi 900). */
const POSTERS = [
  { id: "photo-1597849457406-442b94770a95", x: 60, y: 120, w: 210, h: 280, r: 8 },
  { id: "photo-1777898160741-64eac6fe6627", x: 300, y: 70, w: 230, h: 300, r: -6 },
  { id: "photo-1781876780729-37760c303520", x: 150, y: 430, w: 240, h: 300, r: -4 },
  { id: "photo-1719299246410-df8d0f0845ee", x: 400, y: 470, w: 200, h: 260, r: 6 },
];

function BrandPanel() {
  return (
    <aside aria-hidden className="relative hidden overflow-hidden bg-primary xl:block">
      <div className="absolute top-1/2 left-1/2 h-[900px] w-[640px] -translate-x-1/2 -translate-y-1/2">
        {POSTERS.map((p) => (
          <div
            key={p.id}
            className="absolute origin-top-left overflow-hidden rounded-xl border-[3px] border-foreground bg-surface-2"
            style={{ left: p.x, top: p.y, width: p.w, height: p.h, transform: `rotate(${p.r}deg)` }}
          >
            <Image src={UNSPLASH(p.id)} alt="" fill sizes="240px" className="object-cover" />
          </div>
        ))}
        <div className="absolute top-[760px] left-12 flex w-[544px] flex-col gap-1.5">
          <p className="text-[30px] leading-tight font-extrabold text-foreground">Titik kumpul untuk acara komunitas.</p>
          <p className="text-base text-primary-ink">Konser, lokakarya, lari malam, hingga temu komunitas di sekitar Anda.</p>
        </div>
      </div>
    </aside>
  );
}

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh xl:grid-cols-[minmax(0,1fr)_640px]">
      <div className="flex min-h-dvh flex-col">
        <OfflineBanner />
        <div className="flex flex-1 flex-col px-5 pt-3 md:px-20 md:pt-10">
          <div className="hidden md:block">
            <Link href="/" aria-label="Gatherlyy, ke beranda" className="flex w-fit items-center gap-2">
              <Image src="/gatherly-symbol-ink.svg" alt="" width={28} height={28} priority />
              <span className="text-[22px] font-extrabold">gatherly</span>
            </Link>
          </div>
          <div className="md:hidden">
            <Suspense>
              <CloseButton />
            </Suspense>
          </div>
          <div className="flex flex-1 flex-col md:items-center md:justify-center md:py-10">
            <div className="flex w-full flex-1 flex-col md:max-w-[420px] md:flex-none">{children}</div>
          </div>
        </div>
      </div>
      <BrandPanel />
    </div>
  );
}
