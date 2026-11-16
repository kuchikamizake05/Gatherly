"use client";

import { useState, type ReactNode } from "react";
import { CalendarDays, CalendarPlus, Download } from "lucide-react";

import { useIsDesktop } from "@/hooks/use-media-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import type { TicketEvent } from "@/modules/tickets/types";
import { downloadIcs, googleCalendarUrl } from "@/modules/tickets/utils";

/** Tambah ke kalender. Pita 06 C2: Popover di desktop, Drawer di mobile. */
export function CalendarMenu({ event, orderId, children }: { event: TicketEvent; orderId: string; children: ReactNode }) {
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const pageUrl = typeof window === "undefined" ? "" : window.location.href;

  const items = [
    {
      label: "Google Calendar",
      note: "Buka di tab baru",
      icon: <CalendarDays className="size-5" aria-hidden />,
      onClick: () => window.open(googleCalendarUrl(event, pageUrl), "_blank", "noopener"),
    },
    {
      label: "Apple Calendar",
      note: "Unduh .ics",
      icon: <CalendarPlus className="size-5" aria-hidden />,
      onClick: () => downloadIcs(event, pageUrl, orderId),
    },
    {
      label: "Outlook",
      note: "Unduh .ics",
      icon: <Download className="size-5" aria-hidden />,
      onClick: () => downloadIcs(event, pageUrl, orderId),
    },
  ];

  const list = (
    <ul className="flex flex-col gap-0.5">
      {items.map((it) => (
        <li key={it.label}>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              it.onClick();
            }}
            className="press flex h-[52px] w-full items-center gap-3 rounded-md px-3 text-left [@media(hover:hover)]:hover:bg-surface"
          >
            {it.icon}
            <span className="flex flex-col">
              <span className="text-sm font-bold">{it.label}</span>
              <span className="text-xs text-text-tertiary">{it.note}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );

  if (desktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent align="start" className="w-[260px] p-2">
          {list}
        </PopoverContent>
      </Popover>
    );
  }
  return (
    <>
      <span onClickCapture={() => setOpen(true)} className="contents">
        {children}
      </span>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <div className="flex flex-col gap-3 px-4 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
            <DrawerTitle className="px-2 text-lg">Tambah ke kalender</DrawerTitle>
            {list}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
