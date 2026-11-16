"use client";

import type { ReactNode } from "react";
import { CalendarCheck, CalendarDays, CircleHelp, ExternalLink, LayoutDashboard, LogOut, Settings, Store } from "lucide-react";
import { useRouter } from "next/navigation";

import { WorkspaceShell, type NavItem } from "@/components/layout/workspace-shell";
import { useWorkspaceLogout, useWorkspaceMe } from "@/modules/organizer-auth/hooks";

export function OrganizerShell({ children }: { children: ReactNode }) {
  const { data: me } = useWorkspaceMe();
  const logout = useWorkspaceLogout();
  const router = useRouter();
  if (!me) return null;

  const isCommittee = me.role === "committee";
  const nav: NavItem[] = isCommittee
    ? [{ href: "/", label: "Acara ditugaskan", icon: CalendarCheck }]
    : [
        { href: "/", label: "Dashboard", icon: LayoutDashboard },
        { href: "/events", label: "Acara", icon: CalendarDays },
        { href: "/profile", label: "Profil organizer", icon: Store },
        { href: "/settings", label: "Pengaturan", icon: Settings },
      ];
  const bottomNav: NavItem[] = [
    ...(isCommittee ? [] : [{ href: `https://gatherly.xyz/organizers/${me.organizer.username}`, label: "Halaman publik", icon: ExternalLink, external: true }]),
    { href: "mailto:mitra@gatherly.xyz", label: "Bantuan", icon: CircleHelp, external: true },
    { href: "#", label: "Keluar", icon: LogOut, onClick: () => logout.mutate(undefined, { onSuccess: () => router.replace("/login") }) },
  ];

  return (
    <WorkspaceShell
      app="organizer"
      account={{
        name: me.organizer.name,
        caption: isCommittee ? `Panitia, ${me.username}` : `@${me.organizer.username}`,
        initials: me.organizer.name.split(" ").map((w) => w[0]).slice(0, 2).join(""),
      }}
      nav={nav}
      bottomNav={bottomNav}
    >
      {children}
    </WorkspaceShell>
  );
}
