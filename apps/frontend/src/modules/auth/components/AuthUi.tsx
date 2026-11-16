"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";

import { cn } from "@/lib/utils";

/** Potongan UI yang dipakai bersama oleh halaman di grup (auth). Pita 10 dan 11. */

/** returnTo hanya boleh path di dalam situs, supaya tidak bisa dipakai mengalihkan ke situs lain. */
export function useReturnTo(fallback = "/") {
  const search = useSearchParams();
  const raw = search.get("returnTo") ?? "";
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}

export function withReturnTo(path: string, returnTo: string) {
  return returnTo && returnTo !== "/" ? `${path}${path.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(returnTo)}` : path;
}

export function CloseButton() {
  const router = useRouter();
  const returnTo = useReturnTo();
  return (
    <button
      type="button"
      onClick={() => router.replace(returnTo)}
      aria-label="Tutup"
      className="press -ml-2 flex size-11 items-center justify-center rounded-full"
    >
      <X className="size-6" />
    </button>
  );
}

export function AuthHeading({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 pt-2 pb-2 md:pt-0">
      <h1 className="text-[32px] leading-tight font-extrabold tracking-tight md:text-4xl">{title}</h1>
      {children && <p className="text-[15px] leading-relaxed text-text-secondary md:text-base">{children}</p>}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="press flex w-fit items-center gap-2 text-sm font-semibold text-text-secondary">
      <ArrowLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
}

export function GoogleButton({ href, children, disabled }: { href: string; children: ReactNode; disabled?: boolean }) {
  return (
    <a
      href={disabled ? undefined : href}
      aria-disabled={disabled || undefined}
      className={cn(
        "press flex h-12 w-full items-center justify-center gap-2.5 rounded-full border border-border-strong bg-background text-[15px] font-bold",
        disabled ? "pointer-events-none opacity-50" : "[@media(hover:hover)]:hover:bg-surface",
      )}
    >
      {/* Logo Google dari thesvg.org */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brands/google.svg" alt="" width={20} height={20} className="size-5" />
      {children}
    </a>
  );
}

export function OrDivider({ children = "atau gunakan email" }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      <span className="text-[13px] text-text-tertiary">{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/**
 * Tombol utama dan tautan ganti halaman. Di mobile menempel di bawah layar,
 * di tablet dan desktop tetap di bawah form.
 */
export function AuthActions({ children, embedded = false }: { children: ReactNode; embedded?: boolean }) {
  if (embedded) return <div className="flex flex-col gap-3 pt-1">{children}</div>;
  return (
    <div className="sticky bottom-0 mt-auto flex flex-col gap-3 bg-background pt-4 pb-[max(16px,env(safe-area-inset-bottom))] md:static md:mt-0 md:pt-0 md:pb-0">
      {children}
    </div>
  );
}

export function SwitchLink({ text, label, href }: { text: string; label: string; href: string }) {
  return (
    <p className="text-center text-sm text-text-secondary md:pt-1 md:text-left">
      {text}{" "}
      <Link href={href} className="font-extrabold text-foreground underline-offset-4 [@media(hover:hover)]:hover:underline">
        {label}
      </Link>
    </p>
  );
}
