"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

import { useIsDesktop } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * Konfirmasi tindakan berbahaya. Pita 17 G2 (batalkan acara), juga hapus akun (12), batalkan pesanan (05, 07),
 * nonaktifkan organizer (22). Desktop: Dialog. Mobile: Drawer dari bawah.
 *
 * - confirmText: bila diisi, tombol merah baru aktif setelah teks itu diketik persis sama.
 * - children: isian tambahan di atas kolom ketik, misalnya "Alasan pembatalan".
 * - canConfirm: syarat tambahan dari pemanggil, misalnya alasan wajib diisi.
 *
 * <DangerConfirmDialog
 *   open={open} onOpenChange={setOpen}
 *   title="Batalkan Festival Jazz di Sawah?"
 *   description="Semua 168 pemegang tiket akan menerima pengembalian dana penuh..."
 *   confirmText="Festival Jazz di Sawah"
 *   confirmLabel="Batalkan acara"
 *   onConfirm={cancelEvent} loading={cancel.isPending}
 * />
 */

type DangerConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  /** Teks yang harus diketik ulang. Kosongkan untuk konfirmasi biasa. */
  confirmText?: string;
  canConfirm?: boolean;
  loading?: boolean;
  /** Pesan gagal dari server, tampil di atas tombol. */
  error?: ReactNode;
  children?: ReactNode;
};

export function DangerConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Kembali",
  onConfirm,
  confirmText,
  canConfirm = true,
  loading = false,
  error,
  children,
}: DangerConfirmDialogProps) {
  const desktop = useIsDesktop();
  const [typed, setTyped] = useState("");
  const inputId = useId();

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const matches = !confirmText || typed.trim() === confirmText.trim();
  const enabled = matches && canConfirm && !loading;
  const Title = desktop ? DialogTitle : DrawerTitle;
  const Description = desktop ? DialogDescription : DrawerDescription;

  const body = (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (enabled) onConfirm();
      }}
    >
      <div className="flex flex-col gap-2">
        <Title className="text-[22px]">{title}</Title>
        <Description className="text-[15px] font-medium">{description}</Description>
      </div>
      {children}
      {confirmText && (
        <Field label={<>Ketik “{confirmText}” untuk melanjutkan</>} htmlFor={inputId}>
          <Input
            id={inputId}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={confirmText}
          />
        </Field>
      )}
      {error && <p className="text-[13px] text-danger-ink" role="alert">{error}</p>}
      <div className="flex flex-col-reverse gap-2.5 md:flex-row md:justify-end">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
          {cancelLabel}
        </Button>
        <Button type="submit" variant="dangerSolid" disabled={!enabled} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </form>
  );

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false} className="p-7 sm:max-w-[520px]">
          {body}
        </DialogContent>
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
