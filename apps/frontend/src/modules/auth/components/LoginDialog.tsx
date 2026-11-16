"use client";

import type { ReactNode } from "react";

import { useIsDesktop } from "@/hooks/use-media-query";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";

import { LoginForm } from "./LoginForm";

/**
 * Masuk tanpa meninggalkan halaman. Pita 04 C2: membeli saat belum masuk.
 * Desktop: Dialog. Mobile: Drawer dari bawah. Setelah kode OTP benar, pengguna kembali ke returnTo.
 */
export function LoginDialog({
  open,
  onOpenChange,
  returnTo,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Halaman tujuan setelah masuk, termasuk pilihan tiket di query, misalnya /events/x?ticket=y&qty=2. */
  returnTo: string;
  description?: ReactNode;
}) {
  const desktop = useIsDesktop();
  const Title = desktop ? DialogTitle : DrawerTitle;
  const Description = desktop ? DialogDescription : DrawerDescription;

  const body = (
    <LoginForm
      embedded
      returnTo={returnTo}
      heading={
        <div className="flex flex-col gap-1.5">
          <Title className="text-[22px]">Masuk untuk melanjutkan</Title>
          {description && <Description className="text-sm">{description}</Description>}
        </div>
      }
    />
  );

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto p-7 sm:max-w-[460px]">{body}</DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh]">
        <div className="overflow-y-auto px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">{body}</div>
      </DrawerContent>
    </Drawer>
  );
}
