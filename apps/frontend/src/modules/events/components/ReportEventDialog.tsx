"use client";

import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useReportEvent } from "@/modules/events/hooks";
import type { ReportReason } from "@/modules/events/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/elements/Alert";

/** Laporkan acara. Pita 04 G2 dan G3. Desktop: Dialog. Mobile: Drawer. Butuh login (diatur pemanggil). */

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "fraud", label: "Dugaan penipuan" },
  { value: "wrong_info", label: "Informasi acara tidak sesuai" },
  { value: "inappropriate", label: "Konten tidak pantas" },
  { value: "other", label: "Lainnya" },
];

function ReportForm({ slug, onDone, desktop }: { slug: string; onDone: () => void; desktop: boolean }) {
  const report = useReportEvent(slug);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const Title = desktop ? DialogTitle : DrawerTitle;
  const Description = desktop ? DialogDescription : DrawerDescription;
  const noteRequired = reason === "other" && note.trim().length < 10;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!reason || noteRequired) return;
        report.mutate(
          { reason, note: note.trim() },
          {
            onSuccess: () => {
              onDone();
              toast.success("Laporan terkirim. Terima kasih sudah membantu.");
            },
          },
        );
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Title className="text-[22px]">Laporkan acara</Title>
        <Description className="text-[15px] font-medium">
          Pilih alasan yang paling sesuai. Tim Gatherlyy meninjau paling lambat 1 hari kerja.
        </Description>
      </div>

      {report.isError && <Alert title="Laporan gagal dikirim">Periksa koneksi internet Anda, lalu coba lagi.</Alert>}

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Alasan laporan</legend>
        {REASONS.map((r) => (
          <label
            key={r.value}
            className={cn(
              "press flex h-12 cursor-pointer items-center gap-3 rounded-md border px-4 text-[15px] transition-colors",
              reason === r.value ? "border-foreground bg-primary-tint font-bold" : "border-border-strong font-medium",
            )}
          >
            <input
              type="radio"
              name="reason"
              value={r.value}
              checked={reason === r.value}
              onChange={() => setReason(r.value)}
              className="size-[18px] accent-[var(--foreground)]"
            />
            {r.label}
          </label>
        ))}
        {touched && !reason && <p className="text-[13px] text-danger-ink">Pilih salah satu alasan</p>}
      </fieldset>

      <Field
        label="Ceritakan yang terjadi"
        htmlFor="report-note"
        helper="Identitas Anda tidak ditampilkan kepada penyelenggara."
        error={touched && noteRequired ? "Ceritakan minimal 10 karakter untuk alasan Lainnya" : undefined}
      >
        <Textarea
          id="report-note"
          rows={4}
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Contoh: penyelenggara meminta transfer tambahan lewat WhatsApp."
        />
      </Field>

      <div className="flex flex-col-reverse gap-2.5 md:flex-row md:justify-end">
        <Button type="button" variant="ghost" onClick={onDone}>
          Batal
        </Button>
        <Button type="submit" loading={report.isPending}>
          {report.isPending ? "Mengirim…" : "Kirim laporan"}
        </Button>
      </div>
    </form>
  );
}

export function ReportEventDialog({ slug, open, onOpenChange }: { slug: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const desktop = useIsDesktop();
  const close = () => onOpenChange(false);
  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto p-7 sm:max-w-[520px]">
          {open && <ReportForm slug={slug} onDone={close} desktop />}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh]">
        <div className="overflow-y-auto px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          {open && <ReportForm slug={slug} onDone={close} desktop={false} />}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
