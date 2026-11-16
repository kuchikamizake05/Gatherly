"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";

import { ApiError } from "@/lib/api/client";
import { formatRupiah } from "@/lib/format";
import { useOnline } from "@/hooks/use-online";
import { useCancelOrder, useOrder } from "@/modules/orders/hooks";
import type { Order } from "@/modules/orders/types";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/elements/Alert";
import { CountdownPill } from "@/components/elements/CountdownPill";
import { Illustration, type IllustrationName } from "@/components/elements/Illustration";

import { CheckoutMobileHeader, CheckoutProgress, ConfirmDialog } from "./CheckoutChrome";
import { CheckoutSkeleton, OrderLoadError, OrderNotFound } from "./OrderStates";

/**
 * Status pesanan. Pita 05 A4, A5, dan baris D (D1 sampai D6).
 * Memantau status tiap 5 detik sampai final (useOrder poll).
 */

type Phase = "waiting" | "verifying" | "preparing" | "issued" | "failed" | "expired";

export function orderPhase(o: Order): Phase {
  if (o.paymentStatus === "paid") return o.issuanceStatus === "issued" ? "issued" : "preparing";
  if (o.reservationStatus === "released" || o.paymentStatus === "expired" || new Date(o.expiresAt).getTime() < Date.now()) return "expired";
  if (o.paymentStatus === "failed") return o.canResumePayment ? "failed" : "expired";
  if (o.isVerifying) return "verifying";
  return "waiting";
}

const ART: Record<Phase, IllustrationName> = {
  waiting: "waiting",
  verifying: "verifying",
  preparing: "preparing",
  issued: "success",
  failed: "failed",
  expired: "expired",
};

export function OrderStatusView({ orderId }: { orderId: string }) {
  const order = useOrder(orderId, { poll: true });
  if (order.isPending) return <CheckoutSkeleton />;
  if (order.isError && !order.data) {
    if (order.error instanceof ApiError && (order.error.status === 404 || order.error.status === 403)) return <OrderNotFound />;
    return <OrderLoadError onRetry={() => order.refetch()} retrying={order.isRefetching} />;
  }
  return <StatusCard order={order.data!} refetch={() => order.refetch()} refetching={order.isRefetching} />;
}

function StatusCard({ order, refetch, refetching }: { order: Order; refetch: () => void; refetching: boolean }) {
  const router = useRouter();
  const online = useOnline();
  const cancel = useCancelOrder();
  const [cancelOpen, setCancelOpen] = useState(false);
  const phase = orderPhase(order);
  const heldUntil = format(new Date(order.expiresAt), "HH.mm");
  const ticketLabel = `${order.quantity} tiket ${order.ticketType.name}`;
  const payHref = `/checkout/${order.id}`;

  const countdown = (
    <CountdownPill
      expiresAt={order.expiresAt}
      serverTime={order.serverTime}
      label={`Ditahan sampai ${heldUntil} WIB`}
      onExpire={refetch}
      className="self-center"
    />
  );
  const cancelButton = (
    <Button variant="ghost" block onClick={() => setCancelOpen(true)}>
      Batalkan pesanan
    </Button>
  );

  const content: Record<Phase, { title: string; body: ReactNode; extra?: ReactNode; actions: ReactNode }> = {
    waiting: {
      title: "Selesaikan pembayaran Anda",
      body: "Jendela pembayaran tertutup, tapi tiket Anda masih ditahan. Lanjutkan sebelum waktunya habis.",
      extra: countdown,
      actions: (
        <>
          <Button asChild size="lg" block>
            <Link href={payHref}>Lanjutkan pembayaran</Link>
          </Button>
          {cancelButton}
        </>
      ),
    },
    verifying: {
      title: "Memastikan pembayaran Anda…",
      body: "Biasanya kurang dari satu menit. Halaman ini akan berubah sendiri, atau kami beri tahu lewat email.",
      actions: (
        <Button variant="outline" size="lg" block onClick={refetch} loading={refetching}>
          Cek ulang status
        </Button>
      ),
    },
    preparing: {
      title: "Pembayaran diterima",
      body: "E-tiket Anda sedang disiapkan. Biasanya hanya beberapa detik.",
      actions: (
        <Button size="lg" block loading disabled>
          Menyiapkan e-tiket…
        </Button>
      ),
    },
    issued: {
      title: "Anda siap berangkat!",
      body: `${order.quantity} e-tiket untuk ${order.event.title} sudah terbit dan dikirim ke email setiap peserta.`,
      actions: (
        <>
          <Button asChild size="lg" block>
            <Link href={`/tickets/${order.id}`}>Lihat e-tiket</Link>
          </Button>
          <Button asChild variant="outline" size="lg" block>
            <Link href={`/orders/${order.id}/receipt`}>Unduh bukti pembayaran</Link>
          </Button>
        </>
      ),
    },
    failed: {
      title: "Pembayaran gagal",
      body: "Pembayaran ditolak oleh penyedia. Tiket Anda masih ditahan, coba metode lain.",
      extra: countdown,
      actions: (
        <>
          <Button asChild size="lg" block>
            <Link href={payHref}>Coba bayar lagi</Link>
          </Button>
          {cancelButton}
        </>
      ),
    },
    expired: {
      title: "Waktu pembayaran habis",
      body: "Tiket sudah dilepas ke pembeli lain. Anda bisa memesan lagi kalau masih tersedia.",
      actions: (
        <>
          <Button asChild size="lg" block>
            <Link href={order.event.slug ? `/events/${order.event.slug}` : "/"}>Pesan lagi</Link>
          </Button>
          <Button asChild variant="ghost" block>
            <Link href="/">Kembali ke Jelajahi</Link>
          </Button>
        </>
      ),
    },
  };
  const c = content[phase];

  return (
    <div className="flex w-full flex-1 flex-col">
      <CheckoutMobileHeader title="Status pesanan" step={phase === "issued" ? 4 : 3} onBack={() => router.push("/tickets")} />
      <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center gap-8 px-4 pt-6 pb-16 md:px-6 xl:px-0">
        <div className="hidden w-full max-w-[680px] md:block">
          <CheckoutProgress step={phase === "issued" ? 4 : 3} />
        </div>
        {!online && (
          <Alert tone="offline" title="Anda sedang luring" className="max-w-[536px]">
            Menampilkan data yang terakhir dimuat. Pemesanan tiket memerlukan koneksi internet.
          </Alert>
        )}
        <section
          aria-live="polite"
          className="flex w-full max-w-[536px] flex-col items-center gap-5 rounded-xl border border-border-strong p-6 text-center md:p-8"
        >
          <Illustration name={ART[phase]} className="w-[180px] md:w-[200px]" />
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl leading-tight font-extrabold tracking-tight text-balance">{c.title}</h1>
            <p className="text-[15px] leading-relaxed text-text-secondary text-pretty">{c.body}</p>
          </div>
          {c.extra}
          <div className="flex w-full flex-col gap-2.5">{c.actions}</div>
          <div className="flex w-full items-center justify-between border-t border-border pt-4 text-[13px]">
            <span className="text-text-secondary">
              #{order.orderCode ?? order.id}, {ticketLabel}
            </span>
            <span className="font-bold">{formatRupiah(order.totalAmount)}</span>
          </div>
        </section>
      </div>
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        danger
        title="Batalkan pesanan ini?"
        description={`${ticketLabel} untuk ${order.event.title} akan dilepas ke pembeli lain. Ini tidak bisa diurungkan.`}
        cancelLabel="Kembali"
        confirmLabel="Batalkan pesanan"
        loading={cancel.isPending}
        onConfirm={() =>
          cancel.mutate(order.id, {
            onSuccess: () => {
              setCancelOpen(false);
              toast("Pesanan dibatalkan. Tiket sudah dilepas.");
            },
            onError: () => toast.error("Pesanan gagal dibatalkan. Coba lagi."),
          })
        }
      />
    </div>
  );
}
