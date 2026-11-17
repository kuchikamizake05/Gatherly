"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

/**
 * Konfirmasi dan form bersama, pita desain 16 sampai 19.
 * Desktop: dialog di tengah. Mobile: drawer bawah untuk konfirmasi singkat. Dengan `form`, mobile
 * memakai layar penuh tanpa gestur tarik, supaya keyboard tidak menutupi isian dan gulir tidak
 * menutup drawer.
 */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  form = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  form?: boolean;
}) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  if (mobile && form)
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="flex h-dvh max-h-dvh flex-col gap-0 rounded-none border-0 p-0"
        >
          <div className="flex shrink-0 items-start gap-3 border-b border-border px-4 pt-[max(16px,env(safe-area-inset-top))] pb-4">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-lg font-extrabold">
                {title}
              </SheetTitle>
              {description && (
                <SheetDescription className="mt-1 text-sm text-text-secondary">
                  {description}
                </SheetDescription>
              )}
            </div>
            <SheetClose
              aria-label="Tutup"
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border-strong"
            >
              <X className="size-5" />
            </SheetClose>
          </div>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pt-5 pb-[max(24px,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    );
  if (mobile)
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90dvh] overflow-y-auto">
          <DrawerTitle>{title}</DrawerTitle>
          {description && (
            <DrawerDescription className="mt-2">
              {description}
            </DrawerDescription>
          )}
          <div className="mt-5 space-y-4">{children}</div>
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
