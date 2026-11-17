"use client";

import { Check } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { formatRupiah } from "@/lib/format";
import { useMe } from "@/modules/auth/hooks";
import { useOrder } from "@/modules/orders/hooks";
import { paymentMethod } from "@/modules/orders/payment-methods";
import { PrintDocument, PrintSheet, useAutoPrint } from "@/components/elements/PrintPage";
import { StateView } from "@/components/elements/StateView";
import { orderAmounts } from "../pricing";

/** Bukti pembayaran. Pita 06 G3, satu halaman A4. */

const dateTime = (iso: string) => `${format(new Date(iso), "d MMM yyyy, HH.mm", { locale: localeId })} WIB`;

function Box({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="flex flex-1 flex-col gap-3 rounded-lg bg-surface p-5">
      <p className="text-[13px] font-extrabold">{title}</p>
      <dl className="flex flex-col gap-2.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5">
            <dt className="text-[11px] text-text-tertiary">{k}</dt>
            <dd className="text-[13px] font-semibold break-words">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ReceiptPrintView({ orderId }: { orderId: string }) {
  const order = useOrder(orderId);
  const me = useMe();
  const o = order.data;
  const paid = o?.paymentStatus === "paid";
  useAutoPrint(!!o && paid);

  if (order.isPending) return <div className="min-h-dvh bg-surface-2" aria-busy />;
  if (!o)
    return <StateView layout="screen" tone="error" illustration="failed-load" title="Bukti pembayaran gagal dimuat" description="Periksa koneksi internet Anda, lalu buka lagi halaman ini." />;
  if (!paid)
    return <StateView layout="screen" illustration="waiting" title="Pesanan belum dibayar" description="Bukti pembayaran tersedia setelah pembayaran berhasil." />;

  const buyer = o.buyer ?? (me.data ? { name: me.data.user.name, email: me.data.user.email } : undefined);
  const { subtotal, fee, total } = orderAmounts(o);
  const issued = o.paidAt ?? o.createdAt ?? new Date().toISOString();

  return (
    <PrintDocument title="Bukti pembayaran">
      <PrintSheet
        label="Bukti pembayaran"
        footerLeft="Gatherly, halo@gatherly.xyz"
        footerRight={`Diterbitkan ${format(new Date(issued), "d MMM yyyy", { locale: localeId })}`}
      >
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-[28px] leading-tight font-extrabold">Bukti pembayaran</h1>
            <p className="text-[13px] text-text-secondary">Pesanan #{o.orderCode ?? o.id}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-tint px-3 py-1.5 text-[13px] font-bold text-success-ink">
            <Check className="size-4" aria-hidden />
            Lunas
          </span>
        </div>

        <div className="flex gap-4 pt-[8mm]">
          <Box
            title="Pembayaran"
            rows={[
              ["Tanggal bayar", o.paidAt ? dateTime(o.paidAt) : "-"],
              ["Metode", paymentMethod(o.paymentMethod)?.name ?? "-"],
              ["ID transaksi", o.transactionId ?? "-"],
            ]}
          />
          <Box
            title="Pembeli"
            rows={[
              ["Nama", buyer?.name ?? "-"],
              ["Email", buyer?.email ?? "-"],
              ["WhatsApp", o.contactPhone ?? "-"],
            ]}
          />
        </div>

        <table className="mt-[8mm] w-full overflow-hidden rounded-lg border border-border text-[12px]">
          <thead className="bg-surface text-left text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-bold">Item</th>
              <th className="px-4 py-3 text-center font-bold">Qty</th>
              <th className="px-4 py-3 text-right font-bold">Harga</th>
              <th className="px-4 py-3 text-right font-bold">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border">
              <td className="px-4 py-3">
                {o.event.title}, {o.ticketType.name} ({format(new Date(o.event.startsAt), "EEE, d MMM yyyy", { locale: localeId })})
              </td>
              <td className="px-4 py-3 text-center">{o.quantity}</td>
              <td className="px-4 py-3 text-right">{formatRupiah(o.ticketType.unitPrice)}</td>
              <td className="px-4 py-3 text-right">{formatRupiah(subtotal)}</td>
            </tr>
            <tr className="border-t border-border">
              <td className="px-4 py-3">Biaya layanan</td>
              <td className="px-4 py-3 text-center">1</td>
              <td className="px-4 py-3 text-right">{formatRupiah(fee)}</td>
              <td className="px-4 py-3 text-right">{formatRupiah(fee)}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex items-baseline justify-between border-b border-border px-1 pt-[8mm] pb-[5mm]">
          <span className="text-base font-extrabold">Total dibayar</span>
          <span className="text-[26px] font-extrabold">{formatRupiah(total)}</span>
        </div>

        <p className="mt-auto pb-[6mm] text-[11px] leading-relaxed text-text-secondary">
          Dokumen ini adalah bukti pembayaran yang sah tanpa tanda tangan. Bukti ini bukan tiket masuk, e-tiket dikirim terpisah ke email tiap peserta.
        </p>
      </PrintSheet>
    </PrintDocument>
  );
}
