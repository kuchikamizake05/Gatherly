"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Compass, Heart, Ticket, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { useMe } from "@/modules/auth/hooks";
import { Button } from "@/components/ui/button";
import { OfflineBanner } from "@/components/elements/OfflineBanner";
import { AccountMenu } from "@/components/elements/AccountMenu";
import { InstagramIcon, TikTokIcon, XIcon } from "@/components/elements/BrandIcons";
import { ProgressiveBlur } from "@/components/elements/ProgressiveBlur";
import { MAIL } from "@/lib/site";

/**
 * Kerangka situs utama Gatherly. Sesuai layar di pita 03 A1 (desktop, tablet, mobile).
 * - Tablet dan desktop: navbar dengan logo, kapsul Jelajahi dan Tiketku, lalu Masuk + Daftar atau menu akun.
 * - Mobile: header logo + Masuk, tab bar mengambang di bawah (Jelajahi, Tiketku, Disimpan, Akun).
 * Kapsul dan tab bar tanpa titik atau badge.
 */

const isExplore = (p: string) => p === "/" || p.startsWith("/events") || p.startsWith("/organizers");

const NAV = [
  { href: "/", label: "Jelajahi", icon: Compass, match: isExplore },
  { href: "/tickets", label: "Tiketku", icon: Ticket, match: (p: string) => (p.startsWith("/tickets") && !p.startsWith("/tickets/shared")) || p.startsWith("/orders") },
];

const TABS = [
  ...NAV,
  { href: "/saved", label: "Disimpan", icon: Heart, match: (p: string) => p.startsWith("/saved") },
  { href: "/account", label: "Akun", icon: User, match: (p: string) => p.startsWith("/account") },
];

/** Halaman yang punya tombol aksi menempel di bawah layar di mobile, jadi tab bar disembunyikan. */
const HIDE_TAB_BAR = [/^\/events\/[^/]+$/, /^\/checkout/, /^\/orders\//, /^\/tickets\/[^/]+/];
/** Halaman yang punya judul atau tombol sendiri di mobile, tanpa header logo (pita 03 hasil, 04 sampai 09, 12). */
const HIDE_MOBILE_HEADER = [/^\/saved$/, /^\/organizers\/[^/]+$/, /^\/events$/, /^\/events\/[^/]+$/, /^\/checkout/, /^\/orders\//, /^\/tickets/, /^\/account/];

function Logo({ size = 28 }: { size?: number }) {
  return (
    <Link href="/" aria-label="Gatherlyy, ke beranda" className="flex shrink-0 items-center gap-2">
      <Image src="/gatherly-symbol-ink.svg" alt="" width={size} height={size} priority />
      <span className="text-[20px] font-extrabold tracking-tight md:text-[22px]">gatherlyy</span>
    </Link>
  );
}

const glass =
  "border border-white bg-white/70 shadow-[0_8px_24px_#1111131f] backdrop-blur-[20px] supports-[backdrop-filter]:bg-white/70";

function DesktopNav({ pathname, guest }: { pathname: string; guest: boolean }) {
  return (
    <div className="hidden h-[84px] w-full items-center justify-between gap-6 px-6 md:flex xl:px-10">
      <div className="flex w-[260px] items-center">
        <Logo />
      </div>
      <nav aria-label="Navigasi utama" className={cn("flex w-[300px] gap-1 rounded-full p-[5px]", glass)}>
        {NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press flex h-[38px] flex-1 items-center justify-center rounded-full px-[18px] text-[15px] transition-colors",
                active ? "bg-primary font-extrabold text-primary-foreground" : "font-semibold text-text-secondary [@media(hover:hover)]:hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex w-[260px] items-center justify-end gap-2.5">
        {guest ? (
          <>
            <Button asChild variant="ghost">
              <Link href={`/login?returnTo=${encodeURIComponent(pathname)}`}>Masuk</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/register?returnTo=${encodeURIComponent(pathname)}`}>Daftar</Link>
            </Button>
          </>
        ) : (
          <AccountMenu />
        )}
      </div>
    </div>
  );
}

function MobileHeader({ pathname, guest }: { pathname: string; guest: boolean }) {
  return (
    <div className="flex h-14 items-center justify-between pr-3 pl-5 md:hidden">
      <Logo size={26} />
      {guest && (
        <Button asChild variant="ghost" size="sm" className="h-10 text-[15px]">
          <Link href={`/login?returnTo=${encodeURIComponent(pathname)}`}>Masuk</Link>
        </Button>
      )}
    </div>
  );
}

function TabBar({ pathname }: { pathname: string }) {
  return (
    <>
      {/* Blur bertahap di bawah supaya konten tidak terlihat tajam di belakang tab bar. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-28 bg-gradient-to-t from-background/90 to-transparent md:hidden"
      />
      <nav
        aria-label="Navigasi utama"
        className={cn(
          "fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 z-40 flex h-[62px] w-[calc(100%-32px)] max-w-[358px] -translate-x-1/2 gap-1 rounded-[31px] p-[5px] md:hidden",
          glass,
        )}
      >
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press flex flex-1 flex-col items-center justify-center gap-0.5 rounded-[26px] text-[11px] transition-colors",
                active ? "bg-primary font-extrabold text-foreground" : "font-semibold text-text-secondary",
              )}
            >
              <tab.icon className="size-5" aria-hidden />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

const FOOTER_COLUMNS: { title: string; desktopOnly?: boolean; links: { label: string; href: string; mobileOnly?: boolean }[] }[] = [
  {
    title: "Jelajahi",
    links: [
      { label: "Semua acara", href: "/events" },
      { label: "Minggu ini", href: "/events?when=week" },
      { label: "Acara gratis", href: "/events?minPrice=0&maxPrice=0" },
      { label: "Kategori", href: "/#kategori" },
      { label: "Jual tiket", href: "/become-organizer", mobileOnly: true },
    ],
  },
  {
    title: "Organizer",
    desktopOnly: true,
    links: [
      { label: "Jual tiket", href: "/become-organizer" },
      { label: "Cara kerja", href: "/become-organizer#cara-kerja" },
      { label: "Panduan check-in", href: "/become-organizer#check-in" },
    ],
  },
  {
    title: "Gatherlyy",
    links: [
      { label: "Tentang kami", href: "/#tentang" },
      { label: "Pusat bantuan", href: `mailto:${MAIL.halo}` },
      { label: "Syarat & ketentuan", href: "/#syarat" },
      { label: "Kebijakan privasi", href: "/#privasi" },
    ],
  },
];

function Footer({ guest }: { guest: boolean }) {
  return (
    <footer className="pt-20">
      <div className="flex flex-col gap-12 rounded-t-[32px] bg-inverse px-5 pt-14 pb-32 text-inverse-foreground md:px-10 md:pb-8 xl:px-20 xl:pt-16">
        <div className="flex flex-col gap-10 xl:flex-row xl:gap-12">
          <div className="flex flex-col gap-[18px] xl:flex-1">
            <span className="flex items-center gap-2">
              <Image src="/gatherly-symbol-on-dark.svg" alt="" width={26} height={26} />
              <span className="text-[21px] font-extrabold">gatherlyy</span>
            </span>
            <p className="max-w-[340px] text-[15px] leading-relaxed text-neutral-400">
              Titik kumpul acara komunitas. Temukan acara, pesan tiket, dan masuk cukup dengan kode QR.
            </p>
            <div className="flex gap-4 text-neutral-400">
              <a href="https://instagram.com" aria-label="Instagram Gatherlyy" className="press">
                <InstagramIcon />
              </a>
              <a href="https://tiktok.com" aria-label="TikTok Gatherlyy" className="press">
                <TikTokIcon />
              </a>
              <a href="https://x.com" aria-label="X Gatherlyy" className="press">
                <XIcon />
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 xl:flex xl:gap-12">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title} className={cn("flex-col gap-3.5 xl:w-[180px]", col.desktopOnly ? "hidden md:flex" : "flex")}>
                <p className="text-sm font-semibold text-neutral-500">{col.title}</p>
                {col.links.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className={cn("w-fit text-[15px] font-medium text-neutral-200 [@media(hover:hover)]:hover:text-white", link.mobileOnly && "md:hidden")}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-5 border-t border-white/10 pt-6">
          <p className="text-sm text-neutral-500">© 2026 Gatherlyy</p>
          <div className="flex items-center gap-6">
            {guest && (
              <Link href="/login" className="hidden text-sm font-medium text-neutral-400 md:inline [@media(hover:hover)]:hover:text-white">
                Masuk
              </Link>
            )}
            <Button asChild size="sm" className="h-10">
              <Link href="/become-organizer">
                <Ticket aria-hidden />
                <span className="md:hidden">Jual tiket</span>
                <span className="hidden md:inline">Jual tiket di Gatherlyy</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: me } = useMe();
  const guest = !me;
  const hideTabBar = HIDE_TAB_BAR.some((re) => re.test(pathname));
  const hideMobileHeader = HIDE_MOBILE_HEADER.some((re) => re.test(pathname));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 isolate">
        {/* Blur bertahap yang menjulur 32 px di bawah header, tanpa tepi tegas. */}
        {/* Di mobile hanya bila header logo tampil. Halaman tanpa header punya header sendiri yang tidak boleh ikut buram. */}
        <ProgressiveBlur className={cn("top-0 -bottom-8 -z-10", hideMobileHeader && "hidden md:block")} />
        <DesktopNav pathname={pathname} guest={guest} />
        {!hideMobileHeader && <MobileHeader pathname={pathname} guest={guest} />}
        <OfflineBanner />
      </header>
      {/* flex kolom supaya StateView dan halaman bisa mengisi tinggi penuh. */}
      {/* --bottom-bar: tinggi tab bar mobile, dipakai StateView supaya tombolnya tidak tertutup. */}
      {/* Konten minimal setinggi layar dikurangi header (56 px mobile, 84 px desktop), jadi footer selalu di bawah lipatan. */}
      <main
        className={cn(
          "flex w-full flex-1 flex-col md:min-h-[calc(100dvh-84px)]",
          hideMobileHeader ? "min-h-dvh" : "min-h-[calc(100dvh-56px)]",
          !hideTabBar && "[--bottom-bar:94px] md:[--bottom-bar:0px]",
        )}
      >
        {children}
      </main>
      <Footer guest={guest} />
      {!hideTabBar && <TabBar pathname={pathname} />}
    </div>
  );
}
