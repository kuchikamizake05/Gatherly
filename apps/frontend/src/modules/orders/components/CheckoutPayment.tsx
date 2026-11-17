"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { formatRupiah } from "@/lib/format";
import { openSnap } from "@/lib/midtrans";
import { useOnline } from "@/hooks/use-online";
import { useCancelOrder, useOrder, usePaymentSession } from "@/modules/orders/hooks";
import { PAYMENT_GROUPS, paymentMethod, type PaymentMethod } from "@/modules/orders/payment-methods";
import type { Order } from "@/modules/orders/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/elements/Alert";
import { DangerConfirmDialog } from "@/components/elements/DangerConfirmDialog";
import { CountdownPill } from "@/components/elements/CountdownPill";
import { initials } from "@/components/elements/AccountMenu";

import { CheckoutLayout, CheckoutMobileHeader, CheckoutProgress, ConfirmDialog, OrderSummary } from "./CheckoutChrome";
import { CheckoutSkeleton, OrderLoadError, OrderNotFound } from "./OrderStates";
import { orderAmounts } from "../pricing";

/**
 * Bayar pesanan. Pita 05 A2, A3 (Snap), C (ganti metode), E3 dan E4 (meninggalkan, membatalkan).
 * Snap hanya dibuka selama pesanan masih menunggu bayar dan canResumePayment true.
 * Hasil apa pun dari Snap (berhasil, pending, gagal, ditutup) diarahkan ke /orders/<id>, yang memantau status.
 */

const LAST_METHOD = "gatherly:last-payment-method";

function readLastMethod() {
  try {
    return localStorage.getItem(LAST_METHOD);
  } catch {
    return null;
  }
}

function MethodLogo({ m }: { m: PaymentMethod }) {
  if (m.wordmark)
    return (
      <span className="flex h-[26px] w-20 items-center text-[13px] font-extrabold" style={{ color: m.wordmark.color }}>
        {m.wordmark.text}
      </span>
    );
  return (
    <span className="flex h-[26px] w-20 items-center gap-2.5">
      {m.logos.map((src) => (
        <Image
          key={src}
          src={src}
          alt=""
          width={m.logos.length > 1 ? 35 : 80}
          height={26}
          className={cn("h-[26px] object-contain object-left", m.logos.length > 1 ? "w-[35px]" : "w-20")}
        />
      ))}
    </span>
  );
}

function MethodList({ value, onChange, disabled }: { value: string; onChange: (code: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label="Metode pembayaran">
      {PAYMENT_GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-2">
          <p className="pt-2.5 pb-0.5 text-[13px] font-bold text-text-tertiary">{group.title}</p>
          {group.methods.map((m) => {
            const selected = value === m.code;
            return (
              <button
                key={m.code}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onChange(m.code)}
                className={cn(
                  "press flex w-full items-center gap-3.5 rounded-lg border px-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  m.note ? "min-h-[68px] py-3" : "h-[60px]",
                  selected ? "border-foreground bg-primary-tint" : "border-border-strong [@media(hover:hover)]:hover:bg-surface",
                )}
              >
                <MethodLogo m={m} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className={cn("text-[15px]", selected ? "font-extrabold" : "font-bold")}>{m.name}</span>
                    {m.tag && <Badge tone="success">{m.tag}</Badge>}
                  </span>
                  {m.note && <span className="text-[13px] text-text-tertiary">{m.note}</span>}
                </span>
                <span
                  className={cn(
                    "flex size-[22px] shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-inverse bg-inverse" : "border-border-strong bg-background",
                  )}
                  aria-hidden
                >
                  {selected && <span className="size-2 rounded-full bg-background" />}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function CheckoutPayment({ orderId }: { orderId: string }) {
  const router = useRouter();
  const order = useOrder(orderId, { poll: true });

  if (order.isPending) return <CheckoutSkeleton />;
  if (order.isError && !order.data) {
    if (order.error instanceof ApiError && (order.error.status === 404 || order.error.status === 403)) return <OrderNotFound />;
    return <OrderLoadError onRetry={() => order.refetch()} retrying={order.isRefetching} />;
  }
  return <PaymentForm order={order.data!} router={router} />;
}

function PaymentForm({ order, router }: { order: Order; router: ReturnType<typeof useRouter> }) {
  const online = useOnline();
  const session = usePaymentSession();
  const cancel = useCancelOrder();
  const [method, setMethod] = useState<string>(() => order.paymentMethod ?? readLastMethod() ?? "qris");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [snapError, setSnapError] = useState(false);
  const chosen = paymentMethod(method) ?? paymentMethod("qris")!;
  const payable = order.paymentStatus === "pending" && order.reservationStatus === "held" && order.canResumePayment && !order.isVerifying;
  const statusHref = `/orders/${order.id}`;
  const heldUntil = format(new Date(order.expiresAt), "HH.mm");

  // Pesanan yang sudah tidak bisa dibayar diarahkan ke halaman status (baris D).
  useEffect(() => {
    if (!payable) router.replace(statusHref);
  }, [payable, router, statusHref]);

  const pay = () => {
    setSnapError(false);
    try {
      localStorage.setItem(LAST_METHOD, method);
    } catch {
      /* abaikan */
    }
    session.mutate(
      { orderId: order.id, method },
      {
        onSuccess: async ({ data }) => {
          try {
            await openSnap(data.snapToken, {
              onSuccess: () => router.replace(statusHref),
              onPending: () => router.replace(statusHref),
              onError: () => router.replace(statusHref),
              onClose: () => router.replace(statusHref),
            });
          } catch {
            setSnapError(true);
          }
        },
        onError: () => setSnapError(true),
      },
    );
  };

  const doCancel = () =>
    cancel.mutate(order.id, {
      onSuccess: () => {
        setCancelOpen(false);
        toast("Pesanan dibatalkan. Tiket sudah dilepas.");
        router.replace(order.event.slug ? `/events/${order.event.slug}` : "/");
      },
      onError: () => toast.error("Pesanan gagal dibatalkan. Coba lagi."),
    });

  const ticketLabel = `${order.quantity} tiket ${order.ticketType.name}`;
  const payLabel = session.isPending ? "Membuka pembayaran…" : `Bayar dengan ${chosen.short}`;

  const main = (
    <div className="flex flex-col gap-6">
      <CheckoutProgress step={3} />
      <CountdownPill
        expiresAt={order.expiresAt}
        serverTime={order.serverTime}
        onExpire={() => router.replace(statusHref)}
        className="w-full justify-between md:w-fit"
      />
      <div className="hidden flex-col gap-1.5 md:flex">
        <h1 className="text-[32px] leading-tight font-extrabold tracking-tight">Bayar pesanan</h1>
        <p className="text-sm text-text-tertiary">
          Pesanan #{order.orderCode ?? order.id}
          {order.createdAt ? `, dibuat ${format(new Date(order.createdAt), "HH.mm")} WIB` : ""}
        </p>
      </div>

      {!online && (
        <Alert tone="offline" title="Anda sedang luring">
          Menampilkan data yang terakhir dimuat. Pemesanan tiket memerlukan koneksi internet.
        </Alert>
      )}
      {snapError && <Alert title="Halaman pembayaran gagal dibuka">Periksa koneksi internet Anda, lalu coba lagi. Tiket Anda masih ditahan.</Alert>}

      {/* Mobile: ringkasan pesanan di atas daftar peserta */}
      <OrderSummary
        className="md:hidden"
        title={order.event.title}
        startsAt={order.event.startsAt}
        venue={order.event.venueName}
        ticketName={order.ticketType.name}
        quantity={order.quantity}
        unitPrice={order.ticketType.unitPrice}
        amounts={orderAmounts(order)}
      />

      <section className="flex flex-col gap-4 rounded-lg border border-border-strong p-5 md:p-6">
        <h2 className="text-[17px] font-extrabold">Peserta</h2>
        <ul className="flex flex-col gap-4">
          {order.attendees.map((a, i) => (
            <li key={`${a.name}-${i}`} className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-xs font-extrabold text-primary-ink">
                {initials(a.name)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{a.name}</span>
              <Badge>{order.ticketType.name}</Badge>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-border-strong p-5 md:p-6">
        <h2 className="text-[17px] font-extrabold">Metode pembayaran</h2>
        <MethodList value={method} onChange={setMethod} disabled={session.isPending} />
      </section>

      <div className="flex flex-col items-center gap-3 md:hidden">
        <p className="text-center text-xs text-text-tertiary">Dengan membayar, Anda setuju dengan Syarat & ketentuan Gatherly.</p>
        <button type="button" onClick={() => setCancelOpen(true)} className="press text-sm font-bold text-text-secondary">
          Batalkan pesanan
        </button>
      </div>
    </div>
  );

  const actions = (
    <>
      <Button size="lg" block onClick={pay} loading={session.isPending} disabled={!online || !payable}>
        {payLabel}
      </Button>
    </>
  );

  return (
    <>
      <CheckoutLayout
        header={<CheckoutMobileHeader title="Bayar pesanan" step={3} onBack={() => setLeaveOpen(true)} />}
        main={main}
        side={
          <>
            <OrderSummary
              title={order.event.title}
              startsAt={order.event.startsAt}
              venue={order.event.venueName}
              ticketName={order.ticketType.name}
              quantity={order.quantity}
              unitPrice={order.ticketType.unitPrice}
              amounts={orderAmounts(order)}
            />
            {actions}
            <p className="px-1 text-xs text-text-tertiary">Dengan membayar, Anda setuju dengan Syarat & ketentuan Gatherly.</p>
            <button
              type="button"
              onClick={() => setCancelOpen(true)}
              className="press mx-auto text-sm font-bold text-text-secondary [@media(hover:hover)]:hover:text-foreground"
            >
              Batalkan pesanan
            </button>
          </>
        }
        bottomBar={
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold text-text-secondary">Total</span>
              <span className="text-xl font-extrabold">{formatRupiah(order.totalAmount)}</span>
            </div>
            {actions}
          </>
        }
      />
      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Lanjutkan nanti?"
        description={`Tiket Anda tetap ditahan sampai ${heldUntil} WIB. Anda bisa lanjut bayar kapan saja dari Tiketku.`}
        cancelLabel="Nanti saja"
        confirmLabel="Bayar sekarang"
        onConfirm={() => {
          setLeaveOpen(false);
          pay();
        }}
        onCancel={() => {
          setLeaveOpen(false);
          router.push("/tickets");
        }}
      />
      <DangerConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Batalkan pesanan ini?"
        description={`${ticketLabel} untuk ${order.event.title} akan dilepas ke pembeli lain. Ini tidak bisa diurungkan.`}
        cancelLabel="Kembali"
        confirmLabel="Batalkan pesanan"
        loading={cancel.isPending}
        onConfirm={doCancel}
      />
    </>
  );
}
