"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/elements/Alert";
import { QueryState } from "@/components/elements/QueryState";
import { StatCard } from "@/components/elements/StatCard";
import { DataList } from "@/components/elements/DataList";
import { ResponsiveDialog } from "@/components/elements/ResponsiveDialog";
import { DangerConfirmDialog } from "@/components/elements/DangerConfirmDialog";
import { useOnline } from "@/hooks/use-online";
import { useWorkspaceMe } from "@/modules/organizer-auth/hooks";
import { formatRupiah, formatRupiahShort, formatDateShort } from "@/lib/format";
import {
  useBankAccount,
  useSaveBankAccount,
  usePayouts,
  useRequestPayout,
} from "../hooks";
import type { PayoutRow } from "../api";
const schema = z.object({
  bank: z.string().min(1, "Pilih bank"),
  accountNumber: z
    .string()
    .regex(/^\d{10,16}$/, "Nomor rekening harus terdiri dari 10–16 angka"),
  holderName: z.string().trim().min(1, "Nama pemilik rekening wajib diisi"),
});
const labels = {
  waiting_event: "Menunggu acara selesai",
  available: "Tersedia",
  requested: "Diproses",
  transferred: "Ditransfer",
};
export function PayoutSettings() {
  const bank = useBankAccount();
  const payouts = usePayouts();
  const save = useSaveBankAccount();
  const request = useRequestPayout();
  const me = useWorkspaceMe();
  const online = useOnline();
  const disabled = !online || !!me.data?.organizer.frozen;
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<PayoutRow | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: "onBlur",
  });
  if (bank.isPending || payouts.isPending || bank.isError || payouts.isError)
    return (
      <QueryState
        loading={bank.isPending || payouts.isPending}
        error={bank.error ?? payouts.error}
        retry={() => {
          bank.refetch();
          payouts.refetch();
        }}
      />
    );
  const action = (row: PayoutRow) =>
    row.net === 0 ? (
      <span className="text-sm text-text-secondary">Acara gratis</span>
    ) : row.status === "available" ? (
      <Button
        size="sm"
        disabled={disabled || !bank.data || request.isPending}
        onClick={() => {
          request.reset();
          setSelected(row);
        }}
      >
        Ajukan pencairan
      </Button>
    ) : row.transferReference ? (
      <div className="text-xs">
        <p>{row.transferReference}</p>
        {row.transferredAt && <p>{formatDateShort(row.transferredAt)}</p>}
      </div>
    ) : null;
  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-lg bg-background p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold">Rekening pencairan</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Pendapatan ditransfer ke rekening ini setelah acara selesai.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => {
              reset(
                bank.data ?? { bank: "", accountNumber: "", holderName: "" },
              );
              save.reset();
              setEditing(true);
            }}
          >
            {bank.data ? "Ubah rekening" : "Tambah rekening"}
          </Button>
        </div>
        {bank.data ? (
          <dl className="space-y-1 text-sm">
            <dt className="font-bold">
              {bank.data.bank} •••• {bank.data.accountNumber.slice(-4)}
            </dt>
            <dd>{bank.data.holderName}</dd>
          </dl>
        ) : (
          <Alert tone="info" title="Belum ada rekening">
            Tambahkan rekening untuk mengajukan pencairan.
          </Alert>
        )}
      </section>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <StatCard
          label="Tersedia"
          value={formatRupiahShort(payouts.data.available)}
          caption={formatRupiah(payouts.data.available)}
        />
        <StatCard
          label="Dalam proses"
          value={formatRupiahShort(payouts.data.processing)}
          caption={formatRupiah(payouts.data.processing)}
        />
        <StatCard
          label="Sudah ditransfer"
          value={formatRupiahShort(payouts.data.transferred)}
          caption={formatRupiah(payouts.data.transferred)}
        />
      </div>
      <section className="space-y-4 rounded-lg bg-background p-4 md:p-6">
        <h2 className="text-xl font-extrabold">Pendapatan per acara</h2>
        <p className="text-sm text-text-secondary">
          Pendapatan bersih setelah biaya layanan 5%. Acara gratis tidak
          memiliki pencairan.
        </p>
        <DataList
          rows={payouts.data.rows}
          rowKey={(r) => r.eventId}
          emptyTitle="Belum ada pendapatan acara"
          columns={[
            {
              key: "event",
              title: "Acara",
              render: (r) => (
                <div>
                  <p className="font-bold">{r.eventTitle}</p>
                  <p className="text-xs text-text-secondary">
                    {formatDateShort(r.eventDate)}
                  </p>
                </div>
              ),
            },
            {
              key: "net",
              title: "Bersih",
              numeric: true,
              render: (r) => formatRupiah(r.net),
            },
            {
              key: "status",
              title: "Status",
              render: (r) => <Badge>{labels[r.status]}</Badge>,
            },
            { key: "action", title: "Pencairan", render: action },
          ]}
          mobile={(r) => (
            <div className="space-y-3">
              <p className="font-bold">{r.eventTitle}</p>
              <p className="text-sm">
                {formatDateShort(r.eventDate)} · {formatRupiah(r.net)}
              </p>
              <Badge>{labels[r.status]}</Badge>
              <div>{action(r)}</div>
            </div>
          )}
        />
      </section>
      <ResponsiveDialog
        open={editing}
        onOpenChange={(open) => !save.isPending && setEditing(open)}
        title="Rekening pencairan"
        description="Pastikan nomor dan nama pemilik rekening sudah benar."
      >
        <form
          noValidate
          className="space-y-4"
          onSubmit={handleSubmit((values) =>
            save.mutate(values, {
              onSuccess: () => {
                setEditing(false);
                toast.success("Rekening disimpan");
              },
            }),
          )}
        >
          {save.error && (
            <Alert title="Rekening belum tersimpan">{save.error.message}</Alert>
          )}
          <Field label="Bank" htmlFor="bank" error={errors.bank?.message}>
            <select
              id="bank"
              className="min-h-11 rounded-md border border-border bg-background px-3 text-sm"
              {...register("bank")}
            >
              <option value="">Pilih bank</option>
              {[
                "BCA",
                "BNI",
                "BRI",
                "Mandiri",
                "BSI",
                "CIMB Niaga",
                "Permata",
                "BTN",
                "Danamon",
                "Bank Jago",
              ].map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Nomor rekening"
            htmlFor="bank-number"
            error={errors.accountNumber?.message}
          >
            <Input
              id="bank-number"
              inputMode="numeric"
              autoComplete="off"
              {...register("accountNumber")}
            />
          </Field>
          <Field
            label="Nama pemilik rekening"
            htmlFor="bank-holder"
            error={errors.holderName?.message}
          >
            <Input id="bank-holder" {...register("holderName")} />
          </Field>
          <Button
            className="w-full"
            disabled={disabled || save.isPending}
            type="submit"
          >
            {save.isPending ? "Menyimpan…" : "Simpan rekening"}
          </Button>
        </form>
      </ResponsiveDialog>
      <DangerConfirmDialog
        open={!!selected}
        onOpenChange={(open) =>
          !open && !request.isPending && setSelected(null)
        }
        title="Ajukan pencairan?"
        description={`${selected?.eventTitle ?? "Acara"}: ${formatRupiah(selected?.net ?? 0)} akan diajukan ke ${bank.data?.bank ?? "bank"} •••• ${bank.data?.accountNumber.slice(-4) ?? ""}.`}
        confirmLabel="Ajukan pencairan"
        confirmVariant="primary"
        canConfirm={!disabled && !!bank.data}
        loading={request.isPending}
        error={request.error?.message}
        onConfirm={() =>
          selected &&
          request.mutate(selected.eventId, {
            onSuccess: () => {
              setSelected(null);
              toast.success("Pencairan diajukan");
            },
          })
        }
      />
    </div>
  );
}
