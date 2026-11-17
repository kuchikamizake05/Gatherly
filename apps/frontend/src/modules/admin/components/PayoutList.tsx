"use client";

import { DateTimePicker } from "@/components/elements/DateTimePicker";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAdminPayouts, useMarkTransferred } from "@/modules/admin/hooks";
import type { AdminPayout } from "@/modules/admin/api";
import { StateView } from "@/components/elements/StateView";
import { DangerConfirmDialog } from "@/components/elements/DangerConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  formatRupiah,
  formatDateTimeCompact,
  formatDateShort,
} from "@/lib/format";
import {
  AdminCard,
  AdminPage,
  AdminQueryState,
  AdminTabs,
  AdminOnline,
  AdminQueue,
  AdminListSkeleton,
} from "./AdminPage";

const schema = z.object({
  reference: z
    .string()
    .trim()
    .min(1, "Masukkan nomor referensi transfer.")
    .max(100, "Referensi maksimal 100 karakter."),
  date: z
    .string()
    .min(1, "Pilih tanggal transfer.")
    .refine(
      (value) =>
        Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.now(),
      "Tanggal transfer tidak boleh di masa depan.",
    ),
});
const tabs = [
  { value: "requested", label: "Perlu ditransfer" },
  { value: "transferred", label: "Selesai" },
] as const;

export function PayoutList() {
  const [tab, setTab] = useState<"requested" | "transferred">("requested");
  const query = useAdminPayouts({ tab });
  const mark = useMarkTransferred();
  const [selected, setSelected] = useState<AdminPayout | null>(null);
  const [notice, setNotice] = useState("");
  const {
    register,
    control,
    reset,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { reference: "", date: "" },
  });
  const values = watch();
  const submit = handleSubmit(
    async (values) => {
      if (!selected || mark.isPending) return;
      try {
        await mark.mutateAsync({
          id: selected.id,
          reference: values.reference,
          transferredAt: new Date(values.date).toISOString(),
        });
        setSelected(null);
        setNotice("Pencairan selesai dicatat");
      } catch {
        /* Error remains visible in the confirmation. */
      }
    },
    () =>
      document
        .querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.scrollIntoView({ block: "center" }),
  );
  if (!query.data || query.isPending || query.isError)
    return <AdminQueryState query={query} label="Pencairan" />;
  const rows = query.data.data.filter((row) => row.status === tab);
  return (
    <AdminOnline query={query} label="Pencairan">
      <AdminPage
        title="Pencairan dana"
        description="Transfer paling lambat 3 hari kerja sejak diajukan."
      >
        <AdminTabs
          value={tab}
          onChange={setTab}
          items={tabs}
          counts={query.data.counts}
        />
        {notice && (
          <p
            role="status"
            className="rounded-lg bg-success-tint p-4 text-sm text-success-ink"
          >
            {notice}
          </p>
        )}
        <AdminCard>
          {query.isPlaceholderData ? (
            <AdminListSkeleton label="Pencairan" />
          ) : rows.length ? (
            <AdminQueue
              columns={[
                { label: "Nomor", className: "hidden xl:table-cell" },
                { label: "Organizer" },
                { label: "Acara", className: "hidden xl:table-cell" },
                { label: "Jumlah" },
                { label: "Diajukan", className: "hidden xl:table-cell" },
                { label: "Tindakan", className: "w-44" },
              ]}
              rows={rows.map((row) => {
                const action =
                  row.status === "requested" ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelected(row);
                        reset({ reference: "", date: "" });
                        mark.reset();
                      }}
                    >
                      Proses pencairan
                    </Button>
                  ) : (
                    <span className="break-all text-xs text-text-secondary">
                      {row.transferReference}
                      <br />
                      {formatDateShort(row.transferredAt)}
                    </span>
                  );
                // Backend belum mengirim nomor pencairan, jadi pakai potongan id. Acara bisa sudah dihapus.
                const number =
                  row.number || `#${row.id.slice(-6).toUpperCase()}`;
                const eventTitle = row.eventTitle || "Acara tidak ditemukan";
                return {
                  id: row.id,
                  cells: [
                    number,
                    <strong key="name">{row.organizerName}</strong>,
                    row.eventTitle ? (
                      eventTitle
                    ) : (
                      <span key="event" className="text-text-tertiary">
                        {eventTitle}
                      </span>
                    ),
                    <strong key="amount">{formatRupiah(row.amount)}</strong>,
                    formatDateTimeCompact(row.requestedAt),
                    action,
                  ],
                  number,
                  title: row.organizerName,
                  status: (
                    <strong className="text-sm">
                      {formatRupiah(row.amount)}
                    </strong>
                  ),
                  meta: `${eventTitle}, diajukan ${formatDateTimeCompact(row.requestedAt)}`,
                  action,
                };
              })}
            />
          ) : (
            <StateView
              layout="section"
              illustration="success"
              title={
                tab === "requested"
                  ? "Antrean pencairan kosong"
                  : "Belum ada pencairan selesai"
              }
              description="Pencairan dengan status ini akan muncul di sini."
            />
          )}
        </AdminCard>
        <DangerConfirmDialog
          open={!!selected}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          title="Tandai sudah ditransfer?"
          description="Transfer dilakukan manual lewat internet banking. Catat nomor referensi setelah berhasil."
          confirmLabel="Tandai selesai"
          confirmVariant="primary"
          loading={mark.isPending}
          canConfirm={schema.safeParse(values).success}
          error={
            mark.isError
              ? "Pencairan gagal dicatat. Muat ulang dan periksa status sebelum mencoba lagi."
              : undefined
          }
          onConfirm={() => void submit()}
        >
          {selected && (
            <dl className="space-y-3 text-sm">
              {[
                ["Organizer", selected.organizerName],
                ["Acara", selected.eventTitle],
                ["Jumlah", formatRupiah(selected.amount)],
                ["Rekening", selected.bank],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-text-secondary">{label}</dt>
                  <dd className="min-w-0 break-words text-right font-semibold">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <Field
            label="Nomor referensi transfer"
            htmlFor="transfer-reference"
            error={errors.reference?.message}
          >
            <Input
              id="transfer-reference"
              aria-invalid={!!errors.reference}
              {...register("reference")}
            />
          </Field>
          <Field
            label="Tanggal transfer"
            htmlFor="transfer-date"
            error={errors.date?.message}
          >
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <DateTimePicker
                  id="transfer-date"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={!!errors.date}
                />
              )}
            />
          </Field>
        </DangerConfirmDialog>
      </AdminPage>
    </AdminOnline>
  );
}
