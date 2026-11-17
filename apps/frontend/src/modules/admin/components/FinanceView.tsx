"use client";

import { useState } from "react";
import { DateTimePicker } from "@/components/elements/DateTimePicker";
import { DangerConfirmDialog } from "@/components/elements/DangerConfirmDialog";
import { StateView } from "@/components/elements/StateView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTimeCompact, formatRupiah } from "@/lib/format";
import type { AdminCancellation, AdminRefund } from "@/modules/admin/api";
import {
  useAdminCancellations,
  useAdminRefunds,
  useDecideCancellation,
  useDecideRefund,
  useRefundTransferred,
} from "@/modules/admin/hooks";
import {
  AdminCard,
  AdminListSkeleton,
  AdminOnline,
  AdminPage,
  AdminQueryState,
  AdminQueue,
  AdminTabs,
} from "./AdminPage";

/**
 * Keuangan admin: pembatalan acara dari organizer dan pengembalian dana dari peserta.
 * Backend: GET/POST /admin/cancellations, /admin/refunds, /admin/refunds/:id/transferred.
 */

type Tab = "cancellations" | "review" | "transfer" | "history";
const tabs = [
  { value: "cancellations", label: "Pembatalan acara" },
  { value: "review", label: "Refund perlu ditinjau" },
  { value: "transfer", label: "Refund perlu ditransfer" },
  { value: "history", label: "Riwayat refund" },
] as const;

const REFUND_STATUS: Record<
  AdminRefund["status"],
  { label: string; tone: "info" | "warning" | "success" | "neutral" | "danger" }
> = {
  requested: { label: "Menunggu tinjauan", tone: "info" },
  approved: { label: "Disetujui", tone: "info" },
  processing: { label: "Diproses", tone: "info" },
  manual_required: { label: "Perlu transfer manual", tone: "warning" },
  refunded: { label: "Dikembalikan", tone: "success" },
  rejected: { label: "Ditolak", tone: "neutral" },
};

/** Keputusan yang sedang dikonfirmasi. */
type Decision =
  | { kind: "cancellation"; row: AdminCancellation; approve: boolean }
  | { kind: "refund"; row: AdminRefund; approve: boolean };

const shortId = (id: string) => `#${id.slice(-6).toUpperCase()}`;

export function FinanceView() {
  const [tab, setTab] = useState<Tab>("cancellations");
  const refunds = useAdminRefunds();
  const cancellations = useAdminCancellations();
  const decideRefund = useDecideRefund();
  const decideCancellation = useDecideCancellation();
  const transferred = useRefundTransferred();

  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [transfer, setTransfer] = useState<AdminRefund | null>(null);
  const [reference, setReference] = useState("");
  const [date, setDate] = useState("");
  const [notice, setNotice] = useState("");

  const failed = cancellations.isError ? cancellations : refunds;
  if (
    !refunds.data ||
    !cancellations.data ||
    refunds.isError ||
    cancellations.isError
  )
    return <AdminQueryState query={failed} label="Keuangan" />;

  const allRefunds = refunds.data.data;
  const review = allRefunds.filter((r) => r.status === "requested");
  const toTransfer = allRefunds.filter((r) => r.status === "manual_required");
  const history = allRefunds.filter(
    (r) => !["requested", "manual_required"].includes(r.status),
  );
  const cancelRows = cancellations.data.data;
  const counts = {
    cancellations: cancelRows.length,
    review: review.length,
    transfer: toTransfer.length,
    history: history.length,
  };

  const openDecision = (next: Decision) => {
    setDecision(next);
    setNote("");
    decideRefund.reset();
    decideCancellation.reset();
  };
  const deciding = decideRefund.isPending || decideCancellation.isPending;
  const decisionError = decideRefund.error ?? decideCancellation.error;
  const confirmDecision = () => {
    if (!decision || note.trim().length < 3) return;
    const input = {
      id: decision.row.id,
      approve: decision.approve,
      note: note.trim(),
    };
    const done = () => {
      setNotice(
        decision.kind === "cancellation"
          ? decision.approve
            ? "Pembatalan acara disetujui"
            : "Pembatalan acara ditolak"
          : decision.approve
            ? "Pengembalian dana disetujui"
            : "Pengembalian dana ditolak",
      );
      setDecision(null);
    };
    if (decision.kind === "cancellation")
      decideCancellation.mutate(input, { onSuccess: done });
    else decideRefund.mutate(input, { onSuccess: done });
  };

  const transferValid =
    reference.trim().length >= 3 &&
    Number.isFinite(Date.parse(date)) &&
    Date.parse(date) <= Date.now();
  const confirmTransfer = () => {
    if (!transfer || !transferValid) return;
    transferred.mutate(
      {
        id: transfer.id,
        reference: reference.trim(),
        transferredAt: new Date(date).toISOString(),
      },
      {
        onSuccess: () => {
          setTransfer(null);
          setNotice("Transfer pengembalian dana dicatat");
        },
      },
    );
  };

  const refundRows = (rows: AdminRefund[]) =>
    rows.map((row) => {
      const status = REFUND_STATUS[row.status];
      const order = row.orderCode ?? `Pesanan ${shortId(row.orderId)}`;
      const event = row.eventTitle ?? `Acara ${shortId(row.eventId)}`;
      const action =
        row.status === "requested" ? (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                openDecision({ kind: "refund", row, approve: false })
              }
            >
              Tolak
            </Button>
            <Button
              size="sm"
              onClick={() =>
                openDecision({ kind: "refund", row, approve: true })
              }
            >
              Setujui
            </Button>
          </div>
        ) : row.status === "manual_required" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTransfer(row);
              setReference("");
              setDate("");
              transferred.reset();
            }}
          >
            Tandai sudah ditransfer
          </Button>
        ) : (
          <Badge tone={status.tone}>{status.label}</Badge>
        );
      return {
        id: row.id,
        cells: [
          <span key="order" className="flex flex-col">
            <strong>{order}</strong>
            <span className="text-xs text-text-secondary">{event}</span>
          </span>,
          <span key="reason" className="text-sm">
            {row.reason}
          </span>,
          <strong key="amount">{formatRupiah(row.amount)}</strong>,
          formatDateTimeCompact(row.requestedAt),
          action,
        ],
        number: order,
        title: event,
        status: <strong className="text-sm">{formatRupiah(row.amount)}</strong>,
        meta: `${row.reason}, diajukan ${formatDateTimeCompact(row.requestedAt)}`,
        action,
      };
    });

  const refundTable = (rows: AdminRefund[], empty: string) =>
    rows.length ? (
      <AdminQueue
        columns={[
          { label: "Pesanan" },
          { label: "Alasan", className: "hidden xl:table-cell" },
          { label: "Jumlah" },
          { label: "Diajukan", className: "hidden xl:table-cell" },
          { label: "Tindakan", className: "w-56 text-right" },
        ]}
        rows={refundRows(rows)}
      />
    ) : (
      <StateView
        layout="section"
        illustration="success"
        title={empty}
        description="Pengajuan dengan status ini akan muncul di sini."
      />
    );

  return (
    <AdminOnline query={refunds} label="Keuangan">
      <AdminPage
        title="Keuangan"
        description="Tinjau pembatalan acara dan pengembalian dana peserta."
      >
        <AdminTabs value={tab} onChange={setTab} items={tabs} counts={counts} />
        {notice && (
          <p
            role="status"
            className="rounded-lg bg-success-tint p-4 text-sm text-success-ink"
          >
            {notice}
          </p>
        )}
        <AdminCard>
          {refunds.isPlaceholderData ? (
            <AdminListSkeleton label="Keuangan" />
          ) : tab === "cancellations" ? (
            cancelRows.length ? (
              <AdminQueue
                columns={[
                  { label: "Acara" },
                  { label: "Alasan", className: "hidden xl:table-cell" },
                  { label: "Diajukan", className: "hidden xl:table-cell" },
                  { label: "Tindakan", className: "w-56 text-right" },
                ]}
                rows={cancelRows.map((row) => {
                  const action = (
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          openDecision({
                            kind: "cancellation",
                            row,
                            approve: false,
                          })
                        }
                      >
                        Tolak
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          openDecision({
                            kind: "cancellation",
                            row,
                            approve: true,
                          })
                        }
                      >
                        Setujui
                      </Button>
                    </div>
                  );
                  const organizer =
                    row.organizerName ??
                    `Organizer ${shortId(row.organizerId)}`;
                  return {
                    id: row.id,
                    cells: [
                      <span key="event" className="flex flex-col">
                        <strong>{row.title}</strong>
                        <span className="text-xs text-text-secondary">
                          {organizer}
                        </span>
                      </span>,
                      <span key="reason" className="text-sm">
                        {row.reason}
                      </span>,
                      formatDateTimeCompact(row.requestedAt),
                      action,
                    ],
                    number: organizer,
                    title: row.title,
                    status: <Badge tone="warning">Menunggu keputusan</Badge>,
                    meta: `${row.reason}, diajukan ${formatDateTimeCompact(row.requestedAt)}`,
                    action,
                  };
                })}
              />
            ) : (
              <StateView
                layout="section"
                illustration="success"
                title="Tidak ada pengajuan pembatalan"
                description="Pengajuan pembatalan acara dari organizer akan muncul di sini."
              />
            )
          ) : tab === "review" ? (
            refundTable(review, "Tidak ada refund yang perlu ditinjau")
          ) : tab === "transfer" ? (
            refundTable(toTransfer, "Tidak ada refund yang perlu ditransfer")
          ) : (
            refundTable(history, "Belum ada riwayat refund")
          )}
        </AdminCard>

        <DangerConfirmDialog
          open={!!decision}
          onOpenChange={(open) => !open && !deciding && setDecision(null)}
          title={
            decision?.kind === "cancellation"
              ? decision.approve
                ? "Setujui pembatalan acara?"
                : "Tolak pembatalan acara?"
              : decision?.approve
                ? "Setujui pengembalian dana?"
                : "Tolak pengembalian dana?"
          }
          description={
            decision?.kind === "cancellation"
              ? decision.approve
                ? `${decision.row.title} akan dibatalkan dan tidak tampil lagi di Jelajahi. Pengembalian dana peserta diproses sesuai kebijakan.`
                : `${decision.row.title} tetap berjalan. Organizer menerima catatan Anda.`
              : decision?.approve
                ? `${formatRupiah(decision.row.amount)} akan dikembalikan ke peserta. Pembayaran yang tidak bisa dikembalikan otomatis akan masuk ke Refund perlu ditransfer.`
                : "Peserta menerima catatan Anda dan tiketnya tetap berlaku."
          }
          confirmLabel={decision?.approve ? "Setujui" : "Tolak"}
          confirmVariant={decision?.approve ? "primary" : "dangerSolid"}
          loading={deciding}
          canConfirm={note.trim().length >= 3}
          error={decisionError?.message}
          onConfirm={confirmDecision}
        >
          <Field
            label="Catatan keputusan"
            htmlFor="decision-note"
            helper={`Minimal 3 karakter, ${note.trim().length}/1000`}
          >
            <Textarea
              id="decision-note"
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </DangerConfirmDialog>

        <DangerConfirmDialog
          open={!!transfer}
          onOpenChange={(open) =>
            !open && !transferred.isPending && setTransfer(null)
          }
          title="Tandai sudah ditransfer?"
          description="Transfer dilakukan manual lewat internet banking. Catat nomor referensi setelah berhasil."
          confirmLabel="Tandai selesai"
          confirmVariant="primary"
          loading={transferred.isPending}
          canConfirm={transferValid}
          error={transferred.error?.message}
          onConfirm={confirmTransfer}
        >
          {transfer && (
            <dl className="space-y-3 text-sm">
              {[
                ["Pesanan", transfer.orderCode ?? shortId(transfer.orderId)],
                ["Jumlah", formatRupiah(transfer.amount)],
                ["Alasan", transfer.reason],
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
            htmlFor="refund-reference"
            helper="Minimal 3 karakter"
          >
            <Input
              id="refund-reference"
              value={reference}
              maxLength={200}
              onChange={(e) => setReference(e.target.value)}
            />
          </Field>
          <Field label="Tanggal transfer" htmlFor="refund-date">
            <DateTimePicker id="refund-date" value={date} onChange={setDate} />
          </Field>
        </DangerConfirmDialog>
      </AdminPage>
    </AdminOnline>
  );
}
