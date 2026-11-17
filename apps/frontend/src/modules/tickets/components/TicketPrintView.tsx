"use client";

import { useMemo } from "react";

import { formatDateLong, formatTimeRange } from "@/lib/format";
import { useOrder } from "@/modules/orders/hooks";
import { useTicketDetails, useTickets } from "@/modules/tickets/hooks";
import type { TicketDetail } from "@/modules/tickets/types";
import { PrintDocument, PrintSheet, useAutoPrint } from "@/components/elements/PrintPage";
import { StateView } from "@/components/elements/StateView";

import { ETicketCard } from "./ETicketCard";
import { SITE_DOMAIN } from "@/lib/site";

/** PDF e-tiket. Pita 06 G1 dan G2: satu tiket per halaman A4. */
export function TicketPrintView({ orderId }: { orderId: string }) {
  const list = useTickets();
  const order = useOrder(orderId);
  const ids = useMemo(() => (list.data?.data ?? []).filter((t) => t.orderId === orderId).map((t) => t.id), [list.data, orderId]);
  const details = useTicketDetails(ids.length ? ids : order.data?.ticketIds ?? []);
  const tickets = details.map((q) => q.data).filter(Boolean) as TicketDetail[];
  const ready = details.length > 0 && details.every((q) => q.isSuccess);

  // Beri waktu QR (dibuat di browser) selesai digambar sebelum dialog cetak muncul.
  useAutoPrint(ready);

  if (!ready && (list.isError || details.some((q) => q.isError)))
    return <StateView layout="screen" tone="error" illustration="failed-load" title="E-tiket gagal dimuat" description="Periksa koneksi internet Anda, lalu buka lagi halaman ini." />;
  if (!ready) return <div className="min-h-dvh bg-surface-2" aria-busy />;

  return (
    <PrintDocument title="E-tiket">
      {tickets.map((t, i) => (
        <PrintSheet
          key={t.id}
          label={`E-tiket, Pesanan #${t.orderCode}`}
          footerLeft={`Tiket ${i + 1} dari ${tickets.length}, tunjukkan QR di pintu masuk${t.event.minAge ? `, bawa identitas (${t.event.minAge}+)` : ""}`}
          footerRight={SITE_DOMAIN}
        >
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[26px] leading-tight font-extrabold">{t.event.title}</h1>
            <p className="text-[13px] text-text-secondary">
              {formatDateLong(t.event.startsAt)}, {formatTimeRange(t.event.startsAt, t.event.endsAt)}
            </p>
            <p className="text-[13px] text-text-secondary">{[t.event.venueName, t.event.address].filter(Boolean).join(", ")}</p>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <ETicketCard ticket={t} showStatus={false} className="max-w-[360px]" />
          </div>
        </PrintSheet>
      ))}
    </PrintDocument>
  );
}
