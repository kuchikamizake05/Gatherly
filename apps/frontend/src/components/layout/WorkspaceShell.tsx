"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { OfflineBanner } from "@/components/elements/OfflineBanner";

/**
 * Kerangka ruang kerja organizer dan admin: sidebar + topbar.
 * Desktop: sidebar bisa diciutkan (diingat di perangkat). Tablet: tampil ciut.
 * Mobile: sidebar menjadi laci kiri dari tombol menu di topbar.
 * Detail visual: pita 15 (organizer) dan 21 (admin).
 */

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  external?: boolean;
  onClick?: () => void;
};

type WorkspaceShellProps = {
  app: "organizer" | "admin";
  account: { name: string; caption: string; initials: string };
  nav: NavItem[];
  bottomNav: NavItem[];
  crumb?: ReactNode;
  children: ReactNode;
};

const STORAGE_KEY = "gatherly.sidebar.collapsed";

/**
 * Status ciut sidebar desktop, diingat di perangkat. `animate` baru true setelah status tersimpan
 * diterapkan, supaya sidebar tidak terlihat melipat sendiri saat halaman dibuka.
 */
function useCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {}
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const toggle = () =>
    setCollapsed((v) => {
      try {
        localStorage.setItem(STORAGE_KEY, v ? "0" : "1");
      } catch {}
      return !v;
    });
  return [collapsed, toggle, animate] as const;
}

function isActive(pathname: string, href: string) {
  // Awalan folder rute dibuang hanya bila utuh, supaya "/organizers" di admin tidak terpotong jadi "s".
  const path = pathname.replace(/^\/(organizer|admin)(?=\/|$)/, "") || "/";
  return href === "/"
    ? path === "/"
    : path === href || path.startsWith(`${href}/`);
}

function AppBadge({ app }: { app: WorkspaceShellProps["app"] }) {
  return (
    <span
      className={cn(
        "rounded-sm px-2 py-0.5 text-xs font-extrabold",
        app === "admin"
          ? "bg-danger text-inverse-foreground"
          : "bg-inverse text-inverse-foreground",
      )}
    >
      {app}
    </span>
  );
}

function NavList({
  items,
  collapsed,
  onNavigate,
}: {
  items: NavItem[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const active =
          !item.external && !item.onClick && isActive(pathname, item.href);
        const inner = (
          <>
            <item.icon
              className={cn(
                "size-5 shrink-0",
                active ? "text-foreground" : "text-text-secondary",
              )}
              aria-hidden
            />
            {!collapsed && (
              <span className="flex-1 truncate">{item.label}</span>
            )}
            {!collapsed && item.badge !== undefined && (
              <span className="rounded-full bg-inverse px-2 text-xs font-bold text-inverse-foreground">
                {item.badge}
              </span>
            )}
          </>
        );
        const cls = cn(
          "press flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-[15px] transition-colors",
          collapsed && "justify-center px-0",
          active
            ? "bg-primary font-extrabold"
            : "font-semibold text-text-secondary [@media(hover:hover)]:hover:bg-surface-2",
        );
        return (
          <li key={item.label} title={collapsed ? item.label : undefined}>
            {item.onClick ? (
              <button
                type="button"
                onClick={item.onClick}
                className={cls}
                aria-label={collapsed ? item.label : undefined}
              >
                {inner}
              </button>
            ) : (
              <Link
                href={item.href}
                className={cls}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? item.label : undefined}
                target={item.external ? "_blank" : undefined}
                onClick={onNavigate}
              >
                {inner}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SidebarBody({
  app,
  account,
  nav,
  bottomNav,
  collapsed,
  onToggle,
  onNavigate,
}: Omit<WorkspaceShellProps, "children" | "crumb"> & {
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col justify-between gap-6 p-5">
      <div className="flex flex-col gap-6">
        <div
          className={cn(
            "flex items-center gap-2",
            collapsed ? "flex-col" : "justify-between",
          )}
        >
          <div className="flex items-center gap-2">
            <Image
              src="/gatherly-symbol-ink.svg"
              alt="Gatherlyy"
              width={28}
              height={28}
            />
            {!collapsed && <AppBadge app={app} />}
          </div>
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              className="press hidden size-11 items-center justify-center rounded-md text-text-secondary xl:flex [@media(hover:hover)]:hover:bg-surface-2"
              aria-label={collapsed ? "Buka sidebar" : "Ciutkan sidebar"}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-5" />
              ) : (
                <PanelLeftClose className="size-5" />
              )}
            </button>
          )}
        </div>
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg bg-surface p-3",
            collapsed && "justify-center p-2",
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-inverse text-xs font-extrabold text-inverse-foreground">
            {account.initials}
          </span>
          {!collapsed && (
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-extrabold">
                {account.name}
              </span>
              <span className="truncate text-xs text-text-secondary">
                {account.caption}
              </span>
            </span>
          )}
        </div>
        <nav aria-label="Navigasi utama">
          <NavList items={nav} collapsed={collapsed} onNavigate={onNavigate} />
        </nav>
      </div>
      <NavList
        items={bottomNav}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
    </div>
  );
}

export function WorkspaceShell({
  app,
  account,
  nav,
  bottomNav,
  crumb,
  children,
}: WorkspaceShellProps) {
  const [collapsed, toggle, animate] = useCollapsed();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  // Tanpa crumb khusus, header menampilkan nama menu yang sedang dibuka (desain band 20 sampai 24).
  const title =
    crumb ?? nav.find((item) => !item.external && !item.onClick && isActive(pathname, item.href))?.label;

  return (
    <div className="flex min-h-dvh bg-surface">
      {/* Tablet: selalu ciut. Desktop: bisa diciutkan. */}
      {/* Desktop: lebar wadah bergeser 264 <-> 76 px (ease-in-out 200 ms), sidebar penuh dan rail
          saling berganti (150 ms). Isi tidak berubah bentuk selama animasi karena lebarnya tetap. */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 overflow-hidden border-r border-border bg-background md:block",
          animate && "transition-[width] duration-200 ease-in-out motion-reduce:transition-none",
          collapsed ? "md:w-[76px]" : "md:w-[76px] xl:w-[264px]",
        )}
      >
        <div className="h-full xl:hidden">
          <SidebarBody
            app={app}
            account={account}
            nav={nav}
            bottomNav={bottomNav}
            collapsed
          />
        </div>
        <div className="relative hidden h-full xl:block">
          <div
            inert={collapsed}
            className={cn(
              "absolute inset-y-0 left-0 w-[264px] transition-opacity duration-150 ease-out motion-reduce:transition-none",
              collapsed ? "opacity-0" : "opacity-100 delay-50",
            )}
          >
            <SidebarBody
              app={app}
              account={account}
              nav={nav}
              bottomNav={bottomNav}
              collapsed={false}
              onToggle={toggle}
            />
          </div>
          <div
            inert={!collapsed}
            className={cn(
              "absolute inset-y-0 left-0 w-[76px] transition-opacity duration-150 ease-out motion-reduce:transition-none",
              collapsed ? "opacity-100 delay-50" : "opacity-0",
            )}
          >
            <SidebarBody
              app={app}
              account={account}
              nav={nav}
              bottomNav={bottomNav}
              collapsed
              onToggle={toggle}
            />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background px-4 md:h-[68px] md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="press flex size-10 items-center justify-center rounded-md md:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Buka menu"
            >
              <Menu className="size-6" />
            </button>
            <span className="flex items-center gap-2 md:hidden">
              <Image
                src="/gatherly-symbol-ink.svg"
                alt="Gatherlyy"
                width={24}
                height={24}
              />
              <AppBadge app={app} />
            </span>
            <span className="hidden truncate text-sm font-semibold text-text-secondary md:block">
              {title}
            </span>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Buka sidebar"
              className="press hidden size-11 items-center justify-center rounded-md md:flex xl:hidden"
            >
              <PanelLeftOpen className="size-5" />
            </button>
          </div>
          <span className="flex size-8 items-center justify-center rounded-full bg-primary-tint text-xs font-extrabold text-primary-ink">
            {account.initials}
          </span>
        </header>
        <OfflineBanner />
        {/* flex kolom supaya StateView dan halaman bisa mengisi tinggi penuh. */}
        <main className="flex w-full flex-1 flex-col">{children}</main>
      </div>

      <Drawer direction="left" open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="p-0">
          <DrawerTitle className="sr-only">Menu</DrawerTitle>
          <SidebarBody
            app={app}
            account={account}
            nav={nav}
            bottomNav={bottomNav}
            collapsed={false}
            onNavigate={() => setDrawerOpen(false)}
          />
        </DrawerContent>
      </Drawer>
    </div>
  );
}
