"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAdminReport, useCloseReport } from "@/modules/admin/hooks";
import { StateView } from "@/components/elements/StateView";
import { DangerConfirmDialog } from "@/components/elements/DangerConfirmDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { useOnline } from "@/hooks/use-online";
import { formatDateLong } from "@/lib/format";
import {
  AdminCard,
  AdminPage,
  AdminQueryState,
  reportReasons,
  publicHref,
} from "./AdminPage";

const schema = z.object({
  note: z
    .string()
    .trim()
    .min(1, "Tuliskan catatan penanganan.")
    .max(2000, "Catatan maksimal 2.000 karakter."),
});
export function ReportDetail({ id }: { id: string }) {
  const query = useAdminReport(id);
  const close = useCloseReport();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { note: "" },
  });
  const submit = handleSubmit(async (values) => {
    if (!online || close.isPending) return;
    try {
      await close.mutateAsync({ id, note: values.note });
      setOpen(false);
      setDone(true);
    } catch {
      /* Keep the note and allow retry after an error. */
    }
  });
  if (!online || !query.data || query.isPending || query.isError)
    return <AdminQueryState query={query} label="Laporan" back="/reports" />;
  const data = query.data;
  if (done || data.status === "done")
    return (
      <StateView
        illustration="success"
        title="Laporan ditutup"
        description={data.resolutionNote ?? "Catatan penanganan tersimpan."}
        action={
          <Button asChild>
            <Link href="/reports">Kembali ke laporan</Link>
          </Button>
        }
      />
    );
  return (
    <AdminPage
      title="Laporan acara"
      description="Dilaporkan oleh peserta acara."
    >
      <Link
        href="/reports"
        className="flex min-h-11 items-center text-sm font-bold"
      >
        Kembali ke laporan
      </Link>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <AdminCard title="Laporan">
            <dl className="space-y-4 text-sm">
              {[
                ["Alasan", reportReasons[data.reason]],
                ["Masuk", formatDateLong(data.createdAt)],
                [
                  "Pelapor",
                  `${data.reporter.email}${data.reporter.isTicketHolder ? ", pemegang tiket" : ""}`,
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-text-secondary">{label}</dt>
                  <dd className="min-w-0 break-words text-right font-semibold">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <h2 className="mt-6 text-sm font-bold">Catatan pelapor</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              {data.note}
            </p>
          </AdminCard>
          <AdminCard title="Acara terkait">
            <h2 className="font-bold">{data.eventTitle}</h2>
            <p className="mt-2 text-sm text-text-secondary">
              {data.organizer.name}, @{data.organizer.username}
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              {formatDateLong(data.event.startsAt)}
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              {data.event.soldLabel}
            </p>
            <Button className="mt-4" variant="outline" asChild>
              <a
                href={publicHref(`/events/${data.event.slug}`)}
                target="_blank"
                rel="noreferrer"
              >
                Lihat halaman acara
              </a>
            </Button>
          </AdminCard>
        </div>
        <div className="space-y-6">
          <AdminCard title="Tindakan">
            <p className="mb-4 text-sm leading-relaxed text-text-secondary">
              Bekukan organizer bila laporan terbukti. Penjualan di semua
              acaranya berhenti dan tiket yang sudah terjual tetap berlaku.
            </p>
            <div className="flex flex-col gap-3">
              <Button variant="danger" asChild>
                <Link href={`/organizers/${data.organizer.id}?action=freeze`}>
                  Bekukan organizer
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  close.reset();
                  setOpen(true);
                }}
              >
                Tutup laporan
              </Button>
            </div>
          </AdminCard>
          <AdminCard title="Laporan lain">
            <p className="text-sm text-text-secondary">
              {data.organizer.recentReports} laporan lain untuk{" "}
              {data.organizer.name} dalam 30 hari terakhir.
            </p>
          </AdminCard>
        </div>
      </div>
      <DangerConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Tutup laporan?"
        description="Catatan penanganan wajib diisi dan akan tersimpan di riwayat laporan."
        confirmLabel="Tutup laporan"
        confirmVariant="primary"
        loading={close.isPending}
        canConfirm={schema.safeParse({ note: watch("note") }).success}
        error={
          close.isError
            ? "Laporan gagal ditutup. Periksa status lalu coba lagi."
            : undefined
        }
        onConfirm={() => void submit()}
      >
        <Field
          label="Catatan penanganan"
          htmlFor="resolution-note"
          error={errors.note?.message}
        >
          <Textarea
            id="resolution-note"
            {...register("note")}
            aria-invalid={!!errors.note}
          />
        </Field>
      </DangerConfirmDialog>
    </AdminPage>
  );
}
