"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarPlus, Download, Mail, MapPin, Share2, Sun } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { formatRupiah, formatTime } from "@/lib/format";
import { useOnline } from "@/hooks/use-online";
import { useOrder } from "@/modules/orders/hooks";
import { paymentMethod } from "@/modules/orders/payment-methods";
import { useResendTickets, useTicketDetails, useTickets } from "@/modules/tickets/hooks";
import type { TicketDetail } from "@/modules/tickets/types";
import { mapsUrl } from "@/modules/tickets/utils";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/elements/Alert";
import { StateView } from "@/components/elements/StateView";

import { CalendarMenu } from "./CalendarMenu";
import { ETicketCard } from "./ETicketCard";
import { RefundNotice, RefundOrderBlock, useOrderRefund } from "@/modules/refunds/components/RefundPanel";

/**
 * E-tiket satu pesanan. Pita 06 A sampai F dan H.
 * Satu tiket per tampilan. Desktop dan tablet: tab nama peserta. Mobile: geser dengan titik penanda.
 * E-tiket tersimpan di perangkat, jadi tetap tampil saat luring (H4).
 */

const RESEND_COOLDOWN = 60;

function useResendCooldown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until <= now) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [until, now]);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  return { left, start: () => (setUntil(Date.now() + RESEND_COOLDOWN * 1000), setNow(Date.now())) };
}

export function ETicketView({ orderId }: { orderId: string }) {
  const router = useRouter();
  const online = useOnline();
  const list = useTickets();
  const order = useOrder(orderId);
  const resend = useResendTickets();
  const cooldown = useResendCooldown();
  const [active, setActive] = useState(0);
  const carousel = useRef<HTMLDivElement>(null);

  const ids = useMemo(() => (list.data?.data ?? []).filter((t) => t.orderId === orderId).map((t) => t.id), [list.data, orderId]);
  const details = useTicketDetails(ids.length ? ids : order.data?.ticketIds ?? []);
  const tickets = details.map((q) => q.data).filter(Boolean) as (TicketDetail & { fromDevice?: boolean })[];
  const loading = (list.isPending && order.isPending) || (details.length > 0 && details.some((q) => q.isPending) && tickets.length === 0);
  const ticket = tickets[Math.min(active, tickets.length - 1)];
  const refund = useOrderRefund(orderId, order.data?.paymentStatus === "paid");

  if (loading) return <ETicketSkeleton />;

  if (!ticket) {
    const failed = (list.isError && !list.data) || details.some((q) => q.isError);
    if (failed)
      return (
        <StateView
          tone="error"
          illustration="failed-load"
          title="E-tiket gagal dimuat"
          description="Periksa koneksi internet Anda, lalu coba lagi."
          action={
            <Button
              onClick={() => {
                list.refetch();
                order.refetch();
                details.forEach((q) => q.refetch());
              }}
            >
              Coba lagi
            </Button>
          }
        />
      );
    return (
      <StateView
        illustration="not-found"
        title="E-tiket tidak ditemukan"
        description="E-tiket ini tidak ada atau bukan milik akun Anda."
        action={
          <Button asChild>
            <Link href="/tickets">Buka Tiketku</Link>
          </Button>
        }
      />
    );
  }

  const event = ticket.event;
  const cancelled = event.status === "cancelled";
  const o = order.data;
  const printHref = `/tickets/${orderId}/print`;
  const subtitle = `${format(new Date(event.startsAt), "EEE, d MMM yyyy", { locale: localeId })}, ${formatTime(event.startsAt)}, ${event.venueName}${event.city ? `, ${event.city}` : ""}`;
  const doors = event.doorsOpenAt ? formatTime(event.doorsOpenAt) : null;

  const download = () => {
    window.open(printHref, "_blank", "noopener");
    toast("PDF e-tiket sedang diunduh", { icon: <Download className="size-[18px]" /> });
  };
  const doResend = () =>
    resend.mutate(orderId, {
      onSuccess: () => {
        cooldown.start();
        toast("E-tiket dikirim ulang", {
          icon: <Mail className="size-[18px]" />,
          description: o?.buyer?.email ? `Ke ${o.buyer.email} dan email tiap peserta.` : undefined,
        });
      },
      onError: () => toast.error("Gagal mengirim ulang e-tiket. Coba lagi."),
    });

  const goTo = (i: number) => {
    setActive(i);
    const el = carousel.current?.children[i] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const actions = (
    <>
      <CalendarMenu event={event} orderId={orderId}>
        <Button variant="outline" size="sm" className="flex-1 md:flex-none">
          <CalendarPlus className="size-4" aria-hidden />
          <span className="md:hidden">Kalender</span>
          <span className="hidden md:inline">Tambah ke kalender</span>
        </Button>
      </CalendarMenu>
      <Button variant="outline" size="sm" className="flex-1 md:flex-none" onClick={download}>
        <Download className="size-4" aria-hidden />
        <span className="md:hidden">Unduh</span>
        <span className="hidden md:inline">Unduh e-tiket (PDF)</span>
      </Button>
      <Button asChild variant="outline" size="sm" className="flex-1 md:flex-none">
        <a href={mapsUrl(event)} target="_blank" rel="noopener noreferrer">
          <MapPin className="size-4" aria-hidden />
          <span className="md:hidden">Peta</span>
          <span className="hidden md:inline">Buka di Google Maps</span>
        </a>
      </Button>
    </>
  );

  const notices = (
    <>
      {!online && (
        <Alert tone="offline" title="Anda sedang luring">
          E-tiket tetap dapat ditunjukkan karena tersimpan di perangkat ini.
        </Alert>
      )}
      <RefundNotice refund={refund.latest} tickets={tickets} />
      {cancelled && <Alert title="Acara ini dibatalkan penyelenggara">E-tiket tidak berlaku. Informasi pengembalian dana dikirim ke email Anda.</Alert>}
    </>
  );

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* Header mobile */}
      <div className="sticky top-0 z-20 flex items-center justify-between bg-background px-2 pt-[max(4px,env(safe-area-inset-top))] pb-2 md:hidden">
        <button type="button" aria-label="Kembali ke Tiketku" onClick={() => router.push("/tickets")} className="press flex size-11 items-center justify-center rounded-full">
          <ArrowLeft className="size-6" aria-hidden />
        </button>
        <span className="text-[17px] font-extrabold">E-tiket</span>
        <button
          type="button"
          aria-label="Bagikan acara"
          onClick={async () => {
            const url = `${window.location.origin}/events/${event.slug}`;
            try {
              if (navigator.share) await navigator.share({ title: event.title, url });
              else {
                await navigator.clipboard.writeText(url);
                toast("Tautan acara disalin");
              }
            } catch {
              /* dibatalkan */
            }
          }}
          className="press flex size-11 items-center justify-center rounded-full"
        >
          <Share2 className="size-5" aria-hidden />
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-[15px] pt-2 pb-16 md:gap-8 md:px-6 md:pt-8 md:pb-24 xl:px-0">
        <Link href="/tickets" className="press hidden w-fit items-center gap-1.5 text-sm font-semibold text-text-secondary md:flex">
          <ArrowLeft className="size-4" aria-hidden />
          Kembali ke Tiketku
        </Link>

        <div className="hidden flex-col gap-4 md:flex xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-4xl leading-tight font-extrabold tracking-tight">{event.title}</h1>
            <p className="text-[15px] text-text-secondary">{subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>

        <div className="flex flex-col gap-4 md:hidden">{notices}</div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,668px)_420px] xl:justify-between">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="hidden flex-col gap-4 md:flex">{notices}</div>

            {/* Tab nama peserta (tablet dan desktop) */}
            {tickets.length > 1 && (
              <div role="tablist" aria-label="Peserta" className="hidden gap-6 overflow-x-auto border-b border-border [scrollbar-width:none] md:flex">
                {tickets.map((t, i) => (
                  <button
                    key={t.id}
                    role="tab"
                    type="button"
                    aria-selected={i === active}
                    onClick={() => setActive(i)}
                    className={cn(
                      "press shrink-0 border-b-2 py-3 text-[15px] transition-colors",
                      i === active ? "border-foreground font-extrabold" : "border-transparent font-medium text-text-tertiary",
                    )}
                  >
                    {t.attendeeName}
                  </button>
                ))}
              </div>
            )}

            {/* Desktop dan tablet: satu kartu */}
            <div className="hidden justify-center md:flex">
              <ETicketCard ticket={ticket} className="max-w-[560px] xl:max-w-none" />
            </div>

            {/* Mobile: geser antar tiket */}
            <div
              ref={carousel}
              className="-mx-[15px] flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-[15px] px-[15px] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
              onScroll={(e) => {
                const el = e.currentTarget;
                const i = Math.round(el.scrollLeft / (el.clientWidth - 18));
                if (i !== active && i >= 0 && i < tickets.length) setActive(i);
              }}
            >
              {tickets.map((t) => (
                <div key={t.id} className="w-full shrink-0 snap-center">
                  <ETicketCard ticket={t} className="mx-auto" />
                </div>
              ))}
            </div>
            {tickets.length > 1 && (
              <div className="flex items-center justify-center gap-2 md:hidden">
                <span className="text-[13px] font-semibold text-text-secondary">
                  Tiket {active + 1} dari {tickets.length}
                </span>
                <span className="flex gap-1.5">
                  {tickets.map((t, i) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-label={`Tiket ${i + 1}, ${t.attendeeName}`}
                      aria-current={i === active}
                      onClick={() => goTo(i)}
                      className={cn("h-1.5 rounded-full transition-[width,background-color] duration-200", i === active ? "w-3 bg-foreground" : "w-1.5 bg-border-strong")}
                    />
                  ))}
                </span>
              </div>
            )}

            <div className="flex gap-2 md:hidden">{actions}</div>

            <p className="flex flex-wrap items-center gap-2 text-[13px] text-text-tertiary">
              <Mail className="size-4" aria-hidden />
              E-tiket juga dikirim ke email setiap peserta.
              <button
                type="button"
                onClick={doResend}
                disabled={cooldown.left > 0 || resend.isPending || !online || cancelled}
                className="press font-bold text-foreground underline-offset-4 disabled:font-semibold disabled:text-text-tertiary [@media(hover:hover)]:hover:underline"
              >
                {resend.isPending ? "Mengirim…" : cooldown.left > 0 ? `Kirim ulang dalam ${cooldown.left} detik` : "Kirim ulang"}
              </button>
            </p>

            <p className="flex gap-2.5 rounded-md bg-surface px-3.5 py-3 text-[13px] text-text-secondary md:hidden">
              <Sun className="mt-px size-4 shrink-0" aria-hidden />
              Naikkan kecerahan layar saat QR dipindai.{doors ? ` Pintu dibuka pada ${doors}.` : ""}
            </p>
          </div>

          <aside className="flex flex-col gap-5">
            <section className="hidden flex-col gap-3.5 rounded-lg border border-border-strong p-6 md:flex">
              <h2 className="text-[17px] font-extrabold">Saat datang</h2>
              <ul className="flex flex-col gap-2.5">
                {[
                  "Tunjukkan kode QR dari ponsel, tidak perlu dicetak.",
                  "Satu kode QR untuk satu orang. Panitia memindai satu kali.",
                  "Jangan bagikan tangkapan layar kode QR kepada orang lain.",
                  ...(event.minAge ? [`Bawa kartu identitas, acara ini khusus ${event.minAge} tahun ke atas.`] : []),
                  ...(doors ? [`Pintu dibuka ${doors}.`] : []),
                ].map((tip) => (
                  <li key={tip} className="flex gap-2.5 text-[15px] leading-relaxed text-text-secondary">
                    <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-text-tertiary" aria-hidden />
                    {tip}
                  </li>
                ))}
              </ul>
            </section>

            {o && o.paymentStatus === "paid" && (
              <section className="flex flex-col gap-2.5 rounded-lg border border-border-strong p-5 md:p-6">
                <h2 className="text-[17px] font-extrabold">Pesanan</h2>
                <dl className="flex flex-col gap-2.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-tertiary">Nomor</dt>
                    <dd className="font-semibold">#{o.orderCode ?? o.id}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-text-tertiary">Dibayar</dt>
                    <dd className="text-right font-semibold">
                      {formatRupiah(o.totalAmount)}
                      {paymentMethod(o.paymentMethod) ? `, ${paymentMethod(o.paymentMethod)!.name}` : ""}
                    </dd>
                  </div>
                  {o.paidAt && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-text-tertiary">Tanggal</dt>
                      <dd className="font-semibold">{format(new Date(o.paidAt), "d MMM yyyy, HH.mm", { locale: localeId })} WIB</dd>
                    </div>
                  )}
                </dl>
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <a href={`/orders/${o.id}/receipt`} target="_blank" rel="noopener">
                    <Download className="size-4" aria-hidden />
                    Unduh bukti pembayaran
                  </a>
                </Button>
                <RefundOrderBlock order={o} tickets={tickets} />
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function ETicketSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-[15px] pt-14 md:px-6 md:pt-10 xl:px-0" aria-busy>
      <span className="skeleton hidden h-10 w-96 rounded md:block" />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,668px)_420px] xl:justify-between">
        <span className="skeleton mx-auto h-[558px] w-full max-w-[400px] rounded-xl xl:mx-0" />
        <span className="skeleton hidden h-[260px] rounded-lg md:block" />
      </div>
    </div>
  );
}
