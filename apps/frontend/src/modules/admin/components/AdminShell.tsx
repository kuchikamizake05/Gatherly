"use client";

import type { ReactNode } from "react";
import { Building2, CircleHelp, Flag, Inbox, LogOut, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";

import { WorkspaceShell, type NavItem } from "@/components/layout/WorkspaceShell";
import { useAdminLogout, useAdminMe } from "@/modules/admin/hooks";
import { MAIL } from "@/lib/site";

export function AdminShell({ children }: { children: ReactNode }) {
  const { data: me } = useAdminMe();
  const logout = useAdminLogout();
  const router = useRouter();
  if (!me) return null;

  const nav: NavItem[] = [
    { href: "/applications", label: "Pengajuan", icon: Inbox },
    { href: "/organizers", label: "Organizer", icon: Building2 },
    { href: "/payouts", label: "Pencairan", icon: Wallet },
    { href: "/reports", label: "Laporan", icon: Flag },
  ];
  const bottomNav: NavItem[] = [
    { href: `mailto:${MAIL.it}`, label: "Bantuan", icon: CircleHelp, external: true },
    { href: "#", label: "Keluar", icon: LogOut, onClick: () => logout.mutate(undefined, { onSuccess: () => router.replace("/login") }) },
  ];

  return (
    <WorkspaceShell
      app="admin"
      account={{ name: "Tim Gatherlyy", caption: me.email, initials: me.name.slice(0, 2).toUpperCase() }}
      nav={nav}
      bottomNav={bottomNav}
    >
      {children}
    </WorkspaceShell>
  );
}
