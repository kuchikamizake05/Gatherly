"use client";

import Image from "next/image";
import { useEffect, useRef, type ReactNode } from "react";
import { Printer } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Dokumen cetak A4 (pita 06 G). Dipakai halaman cetak e-tiket dan bukti pembayaran.
 * "Unduh PDF" membuka halaman ini, lalu dialog cetak browser muncul otomatis begitu isi siap.
 * Pengguna memilih "Simpan sebagai PDF" di dialog itu. Tidak memakai pustaka PDF.
 */

const PRINT_CSS = `
@page { size: A4; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  .print-toolbar { display: none !important; }
  .print-sheet { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
}
`;

/** Buka dialog cetak sekali, setelah ready true (misalnya semua QR sudah dibuat). */
export function useAutoPrint(ready: boolean) {
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    const id = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(id);
  }, [ready]);
}

export function PrintDocument({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center gap-6 bg-surface-2 py-6 print:block print:bg-white print:py-0">
      <style>{PRINT_CSS}</style>
      <div className="print-toolbar flex w-[210mm] max-w-[calc(100vw-32px)] items-center justify-between gap-4">
        <p className="text-sm text-text-secondary">{title}. Pilih &quot;Simpan sebagai PDF&quot; di dialog cetak.</p>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden />
          Cetak atau simpan PDF
        </Button>
      </div>
      {children}
    </div>
  );
}

/** Satu halaman A4 dengan kepala dan kaki dokumen. */
export function PrintSheet({ label, footerLeft, footerRight, children, className }: { label: string; footerLeft: ReactNode; footerRight: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "print-sheet flex h-[297mm] w-[210mm] max-w-[calc(100vw-32px)] shrink-0 flex-col overflow-hidden bg-white px-[18mm] py-[16mm] text-foreground shadow-[0_2px_12px_rgba(17,17,19,0.08)] break-after-page print:max-w-none",
        className,
      )}
    >
      <header className="flex items-center justify-between border-b border-border pb-[6mm]">
        <span className="flex items-center gap-2">
          <Image src="/gatherly-symbol-ink.svg" alt="" width={24} height={24} />
          <span className="text-lg font-extrabold">gatherlyy</span>
        </span>
        <span className="text-xs text-text-secondary">{label}</span>
      </header>
      <div className="flex flex-1 flex-col pt-[8mm]">{children}</div>
      <footer className="flex items-center justify-between border-t border-border pt-[5mm] text-[11px] text-text-tertiary">
        <span>{footerLeft}</span>
        <span>{footerRight}</span>
      </footer>
    </section>
  );
}
