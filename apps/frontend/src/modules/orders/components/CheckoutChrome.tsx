"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { ArrowLeft, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/format";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";

/**
 * Bagian bersama halaman checkout dan status pesanan (pita 05).
 * - CheckoutProgress: empat langkah di tablet dan desktop.
 * - CheckoutMobileHeader: kembali, judul, "Langkah N dari 4", bar progres.
 * - OrderSummary: kartu ringkasan pesanan.
 * - CheckoutLayout: kolom utama dan kolom samping, bar bawah menempel di mobile.
 * - ConfirmDialog: dialog keluar yang tidak berbahaya (baris E2, E3). Untuk batalkan pesanan pakai DangerConfirmDialog.
 */

const STEPS = ["Pilih tiket", "Data peserta", "Bayar", "E-tiket"];

export function CheckoutProgress({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="hidden w-full grid-cols-4 gap-2 md:grid" aria-label="Langkah pemesanan">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className="flex flex-col gap-2" aria-current={current ? "step" : undefined}>
            <span className={cn("h-1 rounded-full", n <= step ? "bg-foreground" : "bg-border")} />
            <span
              className={cn(
                "flex items-center gap-1.5 text-[13px]",
                current ? "font-extrabold" : done ? "font-semibold" : "font-semibold text-text-tertiary",
              )}
            >
              {done && <Check className="size-3.5" aria-hidden />}
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function CheckoutMobileHeader({ title, step, onBack }: { title: string; step: 1 | 2 | 3 | 4; onBack?: () => void }) {
  return (
    <div className="sticky top-0 z-20 bg-background pt-[env(safe-area-inset-top)] md:hidden">
      <div className="flex items-center gap-1 px-2 pt-1">
        {onBack ? (
          <button type="button" onClick={onBack} aria-label="Kembali" className="press flex size-11 items-center justify-center rounded-full">
            <ArrowLeft className="size-6" aria-hidden />
          </button>
        ) : (
          <span className="size-11" />
        )}
        <div className="flex flex-col">
          <span className="text-[17px] font-extrabold">{title}</span>
          <span className="text-xs text-text-tertiary">Langkah {step} dari 4</span>
        </div>
      </div>
      <div className="mx-2 mt-3 h-1 rounded-full bg-border">
        <div className="h-full rounded-full bg-foreground transition-[width] duration-300" style={{ width: `${(step / 4) * 100}%` }} />
      </div>
    </div>
  );
}

type SummaryProps = {
  title: string;
  poster?: string;
  startsAt: string;
  venue: string;
  ticketName: string;
  quantity: number;
  unitPrice: number;
  serviceFeeAmount?: number;
  className?: string;
};

export function OrderSummary({ title, poster, startsAt, venue, ticketName, quantity, unitPrice, serviceFeeAmount, className }: SummaryProps) {
  const subtotal = quantity * unitPrice;
  const fee=serviceFeeAmount ?? Math.round(subtotal*0.05);
  const total=subtotal+fee;
  return (
    <section aria-label="Ringkasan pesanan" className={cn("flex flex-col gap-4 rounded-xl border border-border-strong bg-background p-5 md:p-6", className)}>
      <div className="flex items-center gap-3.5">
        {poster && (
          <span className="relative size-[60px] shrink-0 overflow-hidden rounded-[14px] bg-surface-2 md:size-[72px]">
            <Image src={poster} alt="" fill sizes="72px" className="object-cover" />
          </span>
        )}
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-extrabold">{title}</span>
          <span className="text-[13px] text-text-secondary">{format(new Date(startsAt), "EEE, d MMM yyyy, HH.mm", { locale: localeId })} WIB</span>
          <span className="truncate text-[13px] text-text-tertiary">{venue}</span>
        </span>
      </div>
      <div className="flex flex-col gap-2.5 text-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary">
            {ticketName} × {quantity}
          </span>
          <span className="font-semibold">{formatRupiah(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Biaya layanan</span>
          <span className="font-semibold">{formatRupiah(fee)}</span>
        </div>
      </div>
      <div className="flex items-baseline justify-between border-t border-border pt-3.5">
        <span className="text-base font-bold">Total</span>
        <span className="text-[22px] font-extrabold">{formatRupiah(total)}</span>
      </div>
    </section>
  );
}

/**
 * Tata letak checkout. Desktop: kolom utama 680 + kolom samping 400.
 * Tablet: satu kolom, samping di bawah. Mobile: samping disembunyikan, diganti bar bawah.
 */
export function CheckoutLayout({
  header,
  main,
  side,
  bottomBar,
}: {
  header: ReactNode;
  main: ReactNode;
  side: ReactNode;
  bottomBar: ReactNode;
}) {
  return (
    <div className="flex w-full flex-1 flex-col">
      {header}
      <div className="mx-auto grid w-full max-w-[1120px] gap-8 px-4 pt-5 pb-40 md:px-6 md:pt-6 md:pb-20 xl:grid-cols-[minmax(0,680px)_400px] xl:justify-between xl:gap-10 xl:px-0">
        <div className="flex min-w-0 flex-col gap-6">{main}</div>
        <aside className="hidden flex-col gap-3.5 md:flex xl:sticky xl:top-24 xl:self-start">{side}</aside>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-3 border-t border-border bg-background px-5 pt-3.5 pb-[max(20px,env(safe-area-inset-bottom))] md:hidden">
        {bottomBar}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger = false,
  loading = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** Tombol batal. Bawaan hanya menutup dialog. */
  onCancel?: () => void;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-5 p-6 sm:max-w-[440px]">
        <div className="flex flex-col gap-2">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </div>
        <DialogFooter className="flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onCancel ?? (() => onOpenChange(false))}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? "dangerSolid" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
