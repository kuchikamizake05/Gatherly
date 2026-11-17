"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/elements/PageHeader";
import { cn } from "@/lib/utils";
export function SettingsNav({ children }: { children: ReactNode }) {
  const path = usePathname().replace(/^\/organizer/, "");
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title="Pengaturan"
        description="Kelola tim, rekening pencairan, dan keamanan akun Anda."
      >
        <nav aria-label="Pengaturan" className="flex flex-wrap gap-x-6">
          {[
            ["team", "Tim"],
            ["payout", "Rekening pencairan"],
            ["security", "Keamanan"],
          ].map(([slug, label]) => (
            <Link
              key={slug}
              href={`/settings/${slug}`}
              aria-current={path === `/settings/${slug}` ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center border-b-2 border-transparent text-sm font-semibold",
                path === `/settings/${slug}` &&
                  "border-foreground font-extrabold",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </PageHeader>
      {children}
    </div>
  );
}
