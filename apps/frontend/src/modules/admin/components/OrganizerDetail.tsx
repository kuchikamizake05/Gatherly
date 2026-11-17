"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useAdminOrganizer,
  useFreezeOrganizer,
  useUnfreezeOrganizer,
  useResendAccess,
} from "@/modules/admin/hooks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { DangerConfirmDialog } from "@/components/elements/DangerConfirmDialog";
import { Alert } from "@/components/elements/Alert";
import { StateView } from "@/components/elements/StateView";
import { auditLabel, collapseRepeats } from "../audit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRupiah, formatDateShort } from "@/lib/format";
import { useOnline } from "@/hooks/use-online";
import { AdminCard, AdminPage, AdminQueryState, publicHref } from "./AdminPage";

const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Tuliskan alasan pembekuan.")
    .max(2000, "Alasan maksimal 2.000 karakter."),
});
export function OrganizerDetail({ id }: { id: string }) {
  const query = useAdminOrganizer(id);
  const freeze = useFreezeOrganizer();
  const unfreeze = useUnfreezeOrganizer();
  const resend = useResendAccess();
  const online = useOnline();
  const [action, setAction] = useState<"freeze" | "unfreeze" | "resend" | null>(
    null,
  );
  const [notice, setNotice] = useState("");
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { reason: "" },
  });
  const reason = watch("reason");
  const busy = freeze.isPending || unfreeze.isPending || resend.isPending;
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("action") === "freeze")
      setAction("freeze");
  }, []);
  if (!online || query.isPending || query.isError || !query.data)
    return (
      <AdminQueryState query={query} label="Organizer" back="/organizers" />
    );
  const data = query.data;
  const frozen = data.status === "frozen";
  async function confirm() {
    if (!online || busy) return;
    try {
      if (action === "freeze") {
        await freeze.mutateAsync({ id, reason: reason.trim() });
        setNotice("Organizer dibekukan");
      } else if (action === "unfreeze") {
        await unfreeze.mutateAsync(id);
        setNotice("Organizer diaktifkan kembali");
      } else {
        await resend.mutateAsync(id);
        setNotice("Akses dikirim ulang");
      }
      setAction(null);
      reset();
    } catch {
      /* Preserve form values; the active mutation error is shown below. */
    }
  }
  const chooseAction = (value: typeof action) => {
    freeze.reset();
    unfreeze.reset();
    resend.reset();
    setAction(value);
  };
  return (
    <AdminPage
      title={data.name}
      description={`@${data.username}, bergabung ${formatDateShort(data.joinedAt)}`}
    >
      <Link
        href="/organizers"
        className="flex min-h-11 items-center text-sm font-bold"
      >
        Kembali ke organizer
      </Link>
      {notice && (
        <p
          role="status"
          className="rounded-lg bg-success-tint p-4 text-sm text-success-ink"
        >
          {notice}
        </p>
      )}
      {frozen && (
        <Alert title="Organizer dibekukan">
          {data.frozenReason ||
            "Penjualan tiket seluruh acara dihentikan sampai organizer diaktifkan kembali."}
        </Alert>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          [
            "Acara aktif",
            data.activeEvents,
            `${data.completedEvents} acara selesai`,
          ],
          [
            "Tiket terjual",
            data.events.reduce((total, event) => total + event.sold, 0),
            `dari ${data.totalEvents} acara`,
          ],
          ["Penjualan kotor", formatRupiah(data.grossSales), "sejak bergabung"],
          [
            "Laporan peserta",
            data.reportCount,
            data.reportCount ? "Perlu ditinjau" : "Tidak ada laporan",
          ],
        ].map(([label, value, note]) => (
          <AdminCard key={label}>
            <p className="text-sm text-text-secondary">{label}</p>
            <p className="mt-3 text-2xl font-extrabold">{value}</p>
            <p className="mt-2 text-xs text-text-secondary">{note}</p>
          </AdminCard>
        ))}
      </div>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Acara dan log aktivitas dalam satu kartu bertab, masing-masing dengan state kosong. */}
        <AdminCard>
          <Tabs defaultValue="events" className="gap-4">
            <TabsList aria-label="Aktivitas organizer">
              <TabsTrigger value="events" count={data.events.length}>
                Acara
              </TabsTrigger>
              <TabsTrigger value="activity" count={data.activity.length}>
                Log aktivitas
              </TabsTrigger>
            </TabsList>
            <TabsContent value="events">
              {data.events.length ? (
                <div className="divide-y divide-border">
                  {data.events.map((event) => (
                    <div
                      key={event.id}
                      className="grid gap-3 py-4 md:grid-cols-[2fr_1fr_auto]"
                    >
                      <strong className="min-w-0 break-words text-sm">
                        {event.title}
                      </strong>
                      <span className="text-xs text-text-secondary">
                        {event.startsAt
                          ? formatDateShort(event.startsAt)
                          : "Belum dijadwalkan"}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {event.sold} dari {event.capacity} tiket
                        <span className="mt-1 block">
                          {event.status === "draft"
                            ? "Draf"
                            : event.status === "scheduled"
                              ? "Dijadwalkan"
                              : "Dijual"}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <StateView
                  layout="section"
                  illustration="no-events"
                  title="Belum ada acara"
                  description="Acara yang dibuat organizer ini akan muncul di sini."
                />
              )}
            </TabsContent>
            <TabsContent value="activity">
              {data.activity.length ? (
                <ul className="space-y-4">
                  {collapseRepeats(data.activity).map((item, index) => (
                    <li key={index} className="text-sm">
                      {auditLabel(item.action)}
                      <span className="mt-1 block text-xs text-text-secondary">
                        {formatDateShort(item.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <StateView
                  layout="section"
                  illustration="no-results"
                  title="Belum ada aktivitas"
                  description="Persetujuan, pembekuan, dan perubahan lain pada organizer ini akan tercatat di sini."
                />
              )}
            </TabsContent>
          </Tabs>
        </AdminCard>
        <AdminCard title="Penanggung jawab">
          <dl className="space-y-5 text-sm">
            {[
              ["Nama", `${data.pic.name}, ${data.pic.role}`],
              ["Email", data.pic.email],
              ["Nomor ponsel", data.pic.phone],
              ["Pengajuan", data.applicationNumber],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-text-secondary">{label}</dt>
                <dd className="min-w-0 break-words text-right font-semibold">
                  {value}
                </dd>
              </div>
            ))}
            <div className="flex justify-between gap-4">
              <dt>Status</dt>
              <dd>
                <Badge tone={frozen ? "danger" : "success"}>
                  {frozen
                    ? "Dibekukan"
                    : data.status === "never_logged_in"
                      ? "Belum pernah masuk"
                      : "Aktif"}
                </Badge>
              </dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-col gap-3">
            <Button variant="outline" asChild>
              <a
                href={publicHref(`/organizers/${data.username}`)}
                target="_blank"
                rel="noreferrer"
              >
                Lihat profil publik
              </a>
            </Button>
            <Button
              variant={frozen ? "primary" : "danger"}
              disabled={busy}
              onClick={() => chooseAction(frozen ? "unfreeze" : "freeze")}
            >
              {frozen ? "Aktifkan kembali" : "Bekukan organizer"}
            </Button>
            {!frozen && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => chooseAction("resend")}
              >
                {data.status === "never_logged_in"
                  ? "Kirim ulang akses"
                  : "Kirim password sementara baru"}
              </Button>
            )}
          </div>
        </AdminCard>
      </div>
      <DangerConfirmDialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open) setAction(null);
        }}
        title={
          action === "freeze"
            ? "Bekukan organizer?"
            : action === "unfreeze"
              ? "Aktifkan kembali organizer?"
              : "Kirim ulang akses?"
        }
        description={
          action === "freeze"
            ? "Penjualan tiket seluruh acara organizer ini akan dihentikan. Tiket yang sudah terjual tetap berlaku."
            : data.name
        }
        confirmLabel={
          action === "freeze"
            ? "Bekukan organizer"
            : action === "unfreeze"
              ? "Aktifkan kembali"
              : "Kirim ulang akses"
        }
        confirmVariant={action === "freeze" ? "dangerSolid" : "primary"}
        confirmText={action === "freeze" ? data.name : undefined}
        canConfirm={action !== "freeze" || schema.safeParse({ reason }).success}
        loading={busy}
        onConfirm={() => void confirm()}
        error={
          freeze.isError || unfreeze.isError || resend.isError
            ? "Tindakan gagal. Periksa koneksi Anda lalu coba lagi."
            : undefined
        }
      >
        {action === "freeze" && (
          <Field
            label="Alasan pembekuan"
            htmlFor="freeze-reason"
            error={errors.reason?.message}
          >
            <Textarea
              id="freeze-reason"
              aria-invalid={!!errors.reason}
              {...register("reason")}
            />
          </Field>
        )}
      </DangerConfirmDialog>
    </AdminPage>
  );
}
