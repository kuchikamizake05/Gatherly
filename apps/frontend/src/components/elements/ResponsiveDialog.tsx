"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

// Shared confirmations and forms, design bands 16, 17, 18 and 19.
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  if (mobile)
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {/* Yang digulir pembungkus di dalam, bukan DrawerContent. Lapisan pantulan vaul (::after)
            ikut tergulir bila DrawerContent sendiri overflow-y-auto, jadi muncul ruang kosong panjang. */}
        <DrawerContent className="max-h-[90dvh]">
          <div className="-mx-5 flex min-h-0 flex-1 flex-col overflow-y-auto px-5">
            <DrawerTitle>{title}</DrawerTitle>
            {description && (
              <DrawerDescription className="mt-2">
                {description}
              </DrawerDescription>
            )}
            <div className="mt-5 space-y-4">{children}</div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle className="pr-8">{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
        {children}
      </DialogContent>
    </Dialog>
  );
}
