"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ShieldCheck, Ticket } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";
import type { TicketDetail } from "@/modules/tickets/types";
import { ticketState } from "@/modules/tickets/utils";

/**
 * Kartu e-tiket. Komponen "E-Ticket" di pita 02, dipakai di halaman e-tiket (pita 06) dan halaman cetak (G).
 * QR dibuat dari qrPayload (data, bukan URL). Tiket yang sudah dipakai, lewat, atau batal diredupkan.
 */

function QrImage({ payload, dimmed }: { payload: string; dimmed: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(payload, { margin: 0, width: 480, errorCorrectionLevel: "M", color: { dark: "#111113", light: "#ffffff" } })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [payload]);
  return (
    <div className="flex size-[240px] items-center justify-center rounded-md bg-white p-2 print:size-[260px]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Kode QR e-tiket" className={cn("size-full", dimmed && "opacity-25 grayscale")} />
      ) : (
        <span className="skeleton size-full rounded" aria-hidden />
      )}
    </div>
  );
}

function StatusBadge({ ticket }: { ticket: TicketDetail }) {
  const state = ticketState(ticket);
  const label =
    state === "unused"
      ? "Belum dipakai"
      : state === "used"
        ? `Sudah dipakai${ticket.checkedInAt ? `, ${formatTime(ticket.checkedInAt)}` : ""}`
        : state === "past"
          ? "Acara sudah lewat"
          : "Tidak berlaku";
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-xs font-bold",
        state === "unused" ? "bg-success-tint text-success-ink" : "bg-surface-2 text-text-secondary",
      )}
    >
      <ShieldCheck className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

export function ETicketCard({ ticket, showStatus = true, className }: { ticket: TicketDetail; showStatus?: boolean; className?: string }) {
  const state = ticketState(ticket);
  return (
    <article
      aria-label={`E-tiket ${ticket.attendeeName}`}
      className={cn("flex w-full max-w-[400px] flex-col overflow-hidden rounded-xl border border-border-strong bg-background", className)}
    >
      <div className="flex flex-col gap-3.5 bg-primary px-[22px] pt-[22px] pb-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">E-tiket Gatherlyy</span>
          <Ticket className="size-[18px]" aria-hidden />
        </div>
        <h2 className="text-2xl leading-tight font-extrabold tracking-tight">{ticket.event.title}</h2>
        <dl className="flex gap-6">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-semibold text-primary-ink">Tanggal</dt>
            <dd className="text-[15px] font-extrabold">{format(new Date(ticket.event.startsAt), "EEE, d MMM", { locale: localeId })}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-semibold text-primary-ink">Jam</dt>
            <dd className="text-[15px] font-extrabold">{formatTime(ticket.event.startsAt)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs font-semibold text-primary-ink">Tiket</dt>
            <dd className="text-[15px] font-extrabold">{ticket.ticketTypeName}</dd>
          </div>
        </dl>
      </div>
      {/* Garis sobekan */}
      <div className="relative h-5 bg-background" aria-hidden>
        <span className="absolute top-1/2 right-[18px] left-[18px] border-t-2 border-dashed border-border" />
      </div>
      <div className="flex flex-col items-center gap-3.5 px-[22px] pt-2 pb-6">
        <QrImage payload={ticket.qrPayload} dimmed={state !== "unused"} />
        <p className="text-lg font-extrabold tracking-wide tabular-nums">{ticket.ticketCode}</p>
        <p className="-mt-2 text-[15px] font-semibold text-text-secondary">{ticket.attendeeName}</p>
        {showStatus && <StatusBadge ticket={ticket} />}
      </div>
    </article>
  );
}
