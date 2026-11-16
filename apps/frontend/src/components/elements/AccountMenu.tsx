"use client";

import Link from "next/link";
import { CalendarPlus, Heart, LogOut, Receipt, User } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useMe } from "@/modules/auth/hooks";
import { useSignOut } from "@/modules/auth/use-sign-out";
import { useOrders } from "@/modules/orders/hooks";
import { useSavedEvents } from "@/modules/events/hooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Menu akun di navbar desktop dan tablet. Komponen "Account Menu" di pita 02, dibuka di pita 12 A1.
 * Di mobile, akun dibuka lewat tab "Akun" di tab bar.
 */

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function Item({ href, icon, label, meta, danger, onSelect }: { href?: string; icon: ReactNode; label: string; meta?: ReactNode; danger?: boolean; onSelect?: () => void }) {
  const inner = (
    <>
      <span className={cn("[&_svg]:size-[18px]", danger ? "text-danger-ink" : "text-text-secondary")}>{icon}</span>
      <span className={cn("flex-1 text-sm font-semibold", danger ? "text-danger-ink" : "text-foreground")}>{label}</span>
      {meta && <span className="text-xs font-semibold text-text-tertiary">{meta}</span>}
    </>
  );
  const cls = "flex h-[42px] cursor-pointer items-center gap-3 rounded-md px-3 focus:bg-surface-2 data-[highlighted]:bg-surface-2";
  return href ? (
    <DropdownMenuItem asChild className={cls}>
      <Link href={href}>{inner}</Link>
    </DropdownMenuItem>
  ) : (
    <DropdownMenuItem className={cls} onSelect={onSelect}>
      {inner}
    </DropdownMenuItem>
  );
}

export function AccountMenu() {
  const { data: me } = useMe();
  const orders = useOrders();
  const saved = useSavedEvents();
  const { signOut } = useSignOut();
  if (!me) return null;

  const pending = orders.data?.data.filter((o) => o.paymentStatus === "pending" && o.canResumePayment).length ?? 0;
  const savedCount = saved.data?.meta.total;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="press flex size-10 items-center justify-center rounded-full bg-primary-tint text-sm font-extrabold text-primary-ink"
        aria-label="Menu akun"
      >
        {initials(me.user.name)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-72 rounded-lg p-1.5 shadow-[0_8px_24px_#1111131f]">
        <div className="flex items-center gap-3 p-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-sm font-extrabold text-primary-ink">
            {initials(me.user.name)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-bold">{me.user.name}</span>
            <span className="truncate text-[13px] text-text-tertiary">{me.user.email}</span>
          </span>
        </div>
        <DropdownMenuSeparator />
        <Item href="/tickets" icon={<Receipt />} label="Pesanan saya" meta={pending > 0 ? `${pending} menunggu bayar` : undefined} />
        <Item href="/saved" icon={<Heart />} label="Acara disimpan" meta={savedCount ? String(savedCount) : undefined} />
        <Item href="/become-organizer" icon={<CalendarPlus />} label="Daftar jadi organizer" />
        <DropdownMenuSeparator />
        <Item href="/account" icon={<User />} label="Akun saya" />
        <Item
          icon={<LogOut />}
          label="Keluar"
          danger
          onSelect={signOut}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
