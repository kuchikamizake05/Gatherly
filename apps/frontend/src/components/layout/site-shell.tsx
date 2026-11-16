"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useMe } from "@/modules/auth/hooks";
import { Button } from "@/components/ui/button";
import { OfflineBanner } from "@/components/elements/offline-banner";

/**
 * Kerangka gatherly.xyz: navbar + footer.
 * Navbar: logo, kapsul Jelajahi dan Tiketku (tanpa titik atau badge), lalu Masuk atau avatar.
 * Detail visual: pita 03 dan "Eksplorasi · Navbar baru" di file desain.
 * TODO: menu akun (pita 12 A), versi mobile, dan footer lengkap.
 */

const NAV = [
  { href: "/", label: "Jelajahi", match: (p: string) => p === "/" || p.startsWith("/events") },
  { href: "/tickets", label: "Tiketku", match: (p: string) => p.startsWith("/tickets") },
];

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: me } = useMe();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 md:h-[72px] md:px-8 xl:px-12">
          <Link href="/" aria-label="Gatherly, ke beranda" className="shrink-0">
            <Image src="/gatherly-horizontal-ink.svg" alt="Gatherly" width={128} height={32} priority />
          </Link>
          <nav aria-label="Navigasi utama" className="hidden rounded-full bg-surface-2 p-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "press rounded-full px-5 py-2 text-sm font-bold transition-colors",
                  item.match(pathname) ? "bg-primary text-primary-foreground" : "text-text-secondary [@media(hover:hover)]:hover:text-foreground",
                )}
                aria-current={item.match(pathname) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {me ? (
            <Link
              href="/account"
              className="press flex size-10 items-center justify-center rounded-full bg-primary-tint text-sm font-extrabold text-primary-ink"
              aria-label="Akun saya"
            >
              {initials(me.user.name)}
            </Link>
          ) : (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/login?returnTo=${encodeURIComponent(pathname)}`}>Masuk</Link>
            </Button>
          )}
        </div>
        <OfflineBanner />
      </header>
      {/* flex kolom supaya StateView dan halaman bisa mengisi tinggi penuh. */}
      <main className="flex w-full flex-1 flex-col">{children}</main>
      <footer className="bg-inverse text-inverse-foreground">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-10 md:px-8 xl:px-12">
          <p className="text-sm text-neutral-300">Titik kumpul untuk acara komunitas.</p>
          <Link href="/become-organizer" className="w-fit text-sm font-bold text-primary underline-offset-4 hover:underline">
            Jual tiket di Gatherly
          </Link>
          <p className="text-xs text-neutral-400">© 2026 Gatherly</p>
        </div>
      </footer>
    </div>
  );
}
