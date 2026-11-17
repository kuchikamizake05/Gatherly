"use client";

import { useState } from "react";
import { Clock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format, isBefore, subMonths } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { ApiError } from "@/lib/api/client";
import { formatRupiah } from "@/lib/format";
import { useOnline } from "@/hooks/use-online";
import type { Order } from "@/modules/orders/types";
import type { TicketDetail } from "@/modules/tickets/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/elements/Alert";
import { ResponsiveDialog } from "@/components/elements/ResponsiveDialog";

import { useRefunds, useRequestRefund } from "../hooks";
import type { Refund, RefundStatus } from "../types";

/**
 * Pengajuan pengembalian dana dari halaman e-tiket. Pita 07 baris G.
 * - G1 RefundOrderBlock: tombol dan batas pengajuan di kartu Pesanan
 * - G2, G3 RefundDialog: pilih tiket, alasan, rincian, error
 * - G4 RefundNotice dan status di kartu Pesanan
 */

const STATUS: Record<
  RefundStatus,
  {
    label: string;
    tone: "warning" | "info" | "success" | "danger";
    note: string;
  }
> = {
  requested: {
    label: "Menunggu persetujuan",
    tone: "warning",
    note: "Menunggu persetujuan admin Gatherlyy, hasilnya dikirim ke email Anda.",
  },
  approved: {
    label: "Sedang diproses",
    tone: "info",
    note: "Disetujui. Dana sedang dikembalikan ke metode bayar asal dalam 3 sampai 7 hari kerja.",
  },
  processing: {
    label: "Sedang diproses",
    tone: "info",
    note: "Dana sedang dikembalikan ke metode bayar asal dalam 3 sampai 7 hari kerja.",
  },
  manual_required: {
    label: "Ditransfer manual",
    tone: "info",
    note: "Admin Gatherlyy akan mentransfer dana secara manual dan menghubungi Anda lewat email.",
  },
  refunded: {
    label: "Dana dikembalikan",
    tone: "success",
    note: "Dana sudah dikembalikan ke metode bayar asal.",
  },
  rejected: {
    label: "Ditolak",
    tone: "danger",
    note: "Pengajuan ditolak admin Gatherlyy.",
  },
};

const ACTIVE: RefundStatus[] = [
  "requested",
  "approved",
  "processing",
  "manual_required",
];

/** Batas pengajuan: satu bulan kalender sebelum acara dimulai. */
export const refundDeadline = (startsAt: string) =>
  subMonths(new Date(startsAt), 1);

const ticketLabel = (n: number) => `${n} tiket`;

/** Pengajuan terbaru untuk pesanan ini, termasuk tiket yang sedang atau sudah diajukan. */
export function useOrderRefund(orderId: string, enabled: boolean) {
  const refunds = useRefunds({ enabled });
  const forOrder = (refunds.data ?? []).filter(
    (r) => r.orderId === orderId && r.kind === "buyer",
  );
  const latest = forOrder[0];
  const blocked = new Set(
    forOrder.filter((r) => r.status !== "rejected").flatMap((r) => r.ticketIds),
  );
  const wholeOrderBlocked = forOrder.some(
    (r) => r.status !== "rejected" && r.ticketIds.length === 0,
  );
  return { latest, blocked, wholeOrderBlocked };
}

function refundTickets(refund: Refund, tickets: TicketDetail[]) {
  const picked = refund.ticketIds.length
    ? tickets.filter((t) => refund.ticketIds.includes(t.id))
    : tickets;
  return picked.map((t) => t.attendeeName).join(", ");
}

/** G4: pemberitahuan di atas tiket selama pengajuan masih berjalan. */
export function RefundNotice({
  refund,
  tickets,
}: {
  refund?: Refund;
  tickets: TicketDetail[];
}) {
  if (!refund || !ACTIVE.includes(refund.status)) return null;
  const count = refund.ticketIds.length || tickets.length;
  return (
    <Alert tone="warning" title="Pengembalian dana diajukan">
      {ticketLabel(count)} ({refundTickets(refund, tickets)}), perkiraan{" "}
      {formatRupiah(refund.amount)}. {STATUS[refund.status].note}
    </Alert>
  );
}

/** G1 dan G4: bagian pengembalian dana di kartu Pesanan. */
export function RefundOrderBlock({
  order,
  tickets,
}: {
  order: Order;
  tickets: TicketDetail[];
}) {
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const { latest, blocked, wholeOrderBlocked } = useOrderRefund(order.id, true);

  if (
    order.paymentStatus !== "paid" ||
    order.ticketType.unitPrice === 0 ||
    order.event.status === "cancelled"
  )
    return null;

  const deadline = refundDeadline(order.event.startsAt);
  const open_ = isBefore(new Date(), deadline);
  const eligible = tickets.filter(
    (t) =>
      t.checkInStatus === "unused" && !blocked.has(t.id) && !wholeOrderBlocked,
  );

  return (
    <div className="mt-1 flex flex-col gap-2 border-t border-border pt-3.5">
      {latest && (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-text-tertiary">
              Pengembalian dana
            </span>
            <Badge tone={STATUS[latest.status].tone}>
              {latest.status === "requested" && (
                <Clock className="size-3" aria-hidden />
              )}
              {STATUS[latest.status].label}
            </Badge>
          </div>
          <p className="text-[13px] text-text-tertiary">
            Diajukan{" "}
            {format(new Date(latest.requestedAt), "d MMM yyyy, HH.mm", {
              locale: localeId,
            })}{" "}
            WIB untuk {refundTickets(latest, tickets)}.
            {latest.status === "rejected" && latest.decisionNote
              ? ` Catatan admin: ${latest.decisionNote}`
              : ""}
          </p>
        </>
      )}
      {eligible.length > 0 &&
        (open_ ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(true)}
              disabled={!online}
            >
              <RotateCcw className="size-4" aria-hidden />
              Ajukan pengembalian dana
            </Button>
            <p className="text-[13px] text-text-tertiary">
              Bisa diajukan sampai{" "}
              {format(deadline, "d MMM yyyy", { locale: localeId })}. Biaya
              layanan tidak dikembalikan.
            </p>
          </>
        ) : (
          !latest && (
            <p className="text-[13px] leading-relaxed text-text-secondary">
              Pengembalian dana hanya bisa diajukan sampai{" "}
              {format(deadline, "d MMM yyyy", { locale: localeId })}, satu bulan
              sebelum acara. Hubungi penyelenggara bila Anda butuh bantuan.
            </p>
          )
        ))}
      {open && (
        <RefundDialog
          open={open}
          onOpenChange={setOpen}
          order={order}
          tickets={eligible}
          allTickets={tickets}
        />
      )}
    </div>
  );
}

const ERRORS: Record<string, string> = {
  REFUND_DEADLINE: "Batas pengajuan pengembalian dana sudah lewat.",
  NOT_REFUNDABLE:
    "Tiket sudah dipakai atau pesanan belum dibayar, jadi tidak bisa dikembalikan.",
  INVALID_TICKETS:
    "Pilihan tiket tidak sesuai. Muat ulang halaman, lalu coba lagi.",
  REFUND_OVERFLOW:
    "Pilihan tiket tidak sesuai. Muat ulang halaman, lalu coba lagi.",
};

/** G2 dan G3. Dialog di tablet dan desktop, drawer di mobile. */
function RefundDialog({
  open,
  onOpenChange,
  order,
  tickets,
  allTickets,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  tickets: TicketDetail[];
  allTickets: TicketDetail[];
}) {
  const request = useRequestRefund(order.id);
  const [selected, setSelected] = useState<string[]>(
    tickets.length === 1 ? [tickets[0]!.id] : [],
  );
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState({ tickets: false, reason: false });
  const [serverError, setServerError] = useState("");

  const unitPrice = order.ticketType.unitPrice;
  const estimate = selected.length * unitPrice;
  const trimmed = reason.trim();
  const ticketError =
    touched.tickets && selected.length === 0 ? "Pilih minimal satu tiket" : "";
  const reasonError =
    touched.reason && !trimmed
      ? "Tulis alasan pengembalian dana"
      : touched.reason && trimmed.length < 10
        ? "Alasan minimal 10 karakter. Ceritakan singkat kenapa tiket tidak dipakai."
        : "";

  const toggle = (id: string, on: boolean) => {
    setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
    setTouched((t) => ({ ...t, tickets: true }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ tickets: true, reason: true });
    if (selected.length === 0)
      return document
        .getElementById(`refund-ticket-${tickets[0]?.id}`)
        ?.focus();
    if (trimmed.length < 10)
      return document.getElementById("refund-reason")?.focus();
    setServerError("");
    // Semua tiket pesanan dipilih berarti seluruh pesanan, jadi ticketIds tidak dikirim.
    const whole = selected.length === allTickets.length;
    request.mutate(
      {
        input: { reason: trimmed, ...(whole ? {} : { ticketIds: selected }) },
        unitPrice,
        ticketCount: allTickets.length,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.success("Pengajuan terkirim", {
            description: "Hasil peninjauan dikirim ke email Anda.",
          });
        },
        onError: (error) =>
          setServerError(
            (error instanceof ApiError && ERRORS[error.code]) ||
              (error instanceof ApiError && error.code === "NETWORK_ERROR"
                ? "Koneksi terputus. Periksa internet Anda, lalu coba lagi."
                : "Pengajuan gagal dikirim. Coba lagi dalam beberapa saat."),
          ),
      },
    );
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Ajukan pengembalian dana"
      form
      description={`${order.event.title}, pesanan #${order.orderCode}`}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-5 pt-2">
        <fieldset
          className="flex flex-col gap-1"
          aria-describedby={ticketError ? "refund-tickets-error" : undefined}
        >
          <legend className="pb-1.5 text-sm font-semibold">
            Tiket yang dikembalikan
          </legend>
          {tickets.map((t) => (
            <label
              key={t.id}
              htmlFor={`refund-ticket-${t.id}`}
              className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]"
            >
              <Checkbox
                id={`refund-ticket-${t.id}`}
                checked={selected.includes(t.id)}
                onCheckedChange={(v) => toggle(t.id, v === true)}
                aria-invalid={!!ticketError}
              />
              <span className="min-w-0">
                {t.attendeeName}, {t.ticketTypeName},{" "}
                <span className="text-text-secondary">{t.ticketCode}</span>
              </span>
            </label>
          ))}
          {ticketError && (
            <p
              id="refund-tickets-error"
              role="alert"
              className="text-[13px] text-danger-ink"
            >
              {ticketError}
            </p>
          )}
        </fieldset>

        <Field
          label="Alasan"
          htmlFor="refund-reason"
          error={reasonError}
          helper={`${trimmed.length} dari 1000 karakter`}
        >
          <Textarea
            id="refund-reason"
            value={reason}
            maxLength={1000}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, reason: true }))}
            aria-invalid={!!reasonError}
            placeholder="Misalnya berhalangan hadir karena jadwal kerja di luar kota."
          />
        </Field>

        <dl className="flex flex-col gap-2.5 rounded-md bg-surface p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">
              {selected.length
                ? `${ticketLabel(selected.length)} ${order.ticketType.name}`
                : "Belum ada tiket dipilih"}
            </dt>
            <dd className="font-semibold tabular-nums">
              {formatRupiah(estimate)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">Biaya layanan</dt>
            <dd className="font-semibold">Tidak dikembalikan</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[15px] font-bold">Perkiraan dana kembali</dt>
            <dd className="text-[17px] font-extrabold tabular-nums">
              {formatRupiah(estimate)}
            </dd>
          </div>
        </dl>

        <Alert tone="info" title="Ditinjau admin Gatherlyy">
          Hasil peninjauan dikirim ke email Anda. Setelah disetujui, dana masuk
          ke metode bayar asal dalam 3 sampai 7 hari kerja.
        </Alert>

        {serverError && <Alert title={serverError} />}

        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={request.isPending}
          >
            Batal
          </Button>
          <Button type="submit" loading={request.isPending}>
            {request.isPending ? "Mengirim…" : "Kirim pengajuan"}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
