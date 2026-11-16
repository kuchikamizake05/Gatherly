"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock, Heart, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { qk } from "@/lib/api/query-keys";
import { formatDateShort, formatRupiah, formatTime } from "@/lib/format";
import { useOnline } from "@/hooks/use-online";
import { useMe } from "@/modules/auth/hooks";
import { LoginDialog } from "@/modules/auth/components/LoginDialog";
import { eventsApi } from "@/modules/events/api";
import { useToggleSave } from "@/modules/events/hooks";
import { categorySlug } from "@/modules/events/categories";
import type { EventDetail } from "@/modules/events/types";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Alert } from "@/components/elements/Alert";
import { TicketPicker, selectionTotal, type TicketSelection } from "@/components/elements/TicketPicker";

/**
 * Pembelian tiket di detail acara. Pita 04 baris B, C, E, F.
 * - useTicketPurchase: state bersama untuk kartu desktop, kartu tablet, dan lembar mobile.
 * - Satu jenis tiket per pesanan (CreateOrderInput backend hanya menerima satu ticketTypeId).
 * - Beli tiket: cek ulang sisa kuota, lalu ke /checkout?event=&ticket=&qty=.
 * - Tamu: dialog masuk, pilihan tiket dibawa lewat returnTo lalu dipulihkan dari URL (baris C3).
 */

type SaleState = "on_sale" | "not_open" | "sold_out" | "closed" | "ended" | "cancelled";

export function saleState(event: EventDetail): SaleState {
  if (event.status === "cancelled") return "cancelled";
  if (event.status === "ended" || new Date(event.endsAt).getTime() < Date.now()) return "ended";
  if (event.status === "closed") return "closed";
  if (event.ticketTypes.some((t) => t.status === "on_sale")) return "on_sale";
  if (event.ticketTypes.some((t) => t.status === "not_open")) return "not_open";
  if (event.status === "sold_out" || event.ticketTypes.every((t) => t.status === "sold_out")) return "sold_out";
  return "closed";
}

export function startingPrice(event: EventDetail) {
  const prices = event.ticketTypes.filter((t) => t.status === "on_sale" || t.status === "not_open").map((t) => t.price);
  return prices.length ? Math.min(...prices) : Math.min(...event.ticketTypes.map((t) => t.price));
}

const shortDateTime = (iso: string) => `${formatDateShort(iso).replace(/ \d{4}$/, "")}, ${formatTime(iso)}`;

export function useTicketPurchase(event: EventDetail) {
  const search = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const online = useOnline();

  const initial = (): TicketSelection => {
    const id = search.get("ticket");
    const qty = Number(search.get("qty") ?? 0);
    if (id && qty > 0 && event.ticketTypes.some((t) => t.id === id && t.status === "on_sale")) return { [id]: Math.min(qty, event.maxPerOrder) };
    // Bawaan: 1 tiket dari jenis termurah yang sedang dijual (pita 04 A1).
    const first = event.ticketTypes.filter((t) => t.status === "on_sale").sort((a, b) => a.price - b.price)[0];
    return first ? { [first.id]: 1 } : {};
  };

  const [selection, setSelection] = useState<TicketSelection>(initial);
  const [processing, setProcessing] = useState(false);
  const [adjusted, setAdjusted] = useState<{ name: string; from: number; to: number } | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Kembali dari masuk dengan pilihan tiket di URL (baris C3): buka lagi lembar tiket, hanya di mobile.
  useEffect(() => {
    if (search.get("ticket") && !window.matchMedia("(min-width: 768px)").matches) setSheetOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { quantity, amount } = selectionTotal(event.ticketTypes, selection);
  const selectedId = Object.keys(selection).find((id) => selection[id] > 0);
  const selected = event.ticketTypes.find((t) => t.id === selectedId);
  const returnTo = selectedId ? `/events/${event.slug}?ticket=${selectedId}&qty=${quantity}` : `/events/${event.slug}`;

  const buy = async () => {
    if (!selected || quantity === 0) return;
    if (!me.data) return setLoginOpen(true);
    setProcessing(true);
    setAdjusted(null);
    try {
      // Cek ulang sisa kuota sebelum lanjut, supaya tidak gagal di halaman berikutnya (baris E2).
      const { data: fresh } = await eventsApi.detail(event.slug);
      qc.setQueryData(qk.event(event.slug), fresh);
      const latest = fresh.ticketTypes.find((t) => t.id === selected.id);
      const left = latest?.status === "on_sale" ? (latest.remaining ?? Infinity) : 0;
      if (left < quantity) {
        setAdjusted({ name: selected.name, from: quantity, to: Math.max(0, left) });
        setSelection(left > 0 ? { [selected.id]: left } : {});
        setProcessing(false);
        return;
      }
      router.push(`/checkout?event=${event.slug}&ticket=${selected.id}&qty=${quantity}`);
    } catch {
      setProcessing(false);
    }
  };

  return {
    event,
    state: saleState(event),
    selection,
    setSelection: (s: TicketSelection) => {
      setAdjusted(null);
      setSelection(s);
    },
    quantity,
    amount,
    selected,
    processing,
    adjusted,
    buy,
    loggedIn: !!me.data,
    online,
    loginOpen,
    setLoginOpen,
    sheetOpen,
    setSheetOpen,
    returnTo,
  };
}

type Purchase = ReturnType<typeof useTicketPurchase>;

function Banner({ title, children, tone = "neutral" }: { title: string; children: ReactNode; tone?: "neutral" | "warning" }) {
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-md p-3.5", tone === "warning" ? "bg-warning-tint text-warning-ink" : "bg-surface-2")}>
      <p className="text-sm font-bold">{title}</p>
      <p className={cn("text-[13px]", tone === "neutral" && "text-text-secondary")}>{children}</p>
    </div>
  );
}

/** Tombol dan banner untuk acara yang tidak sedang dijual (baris F). */
function ClosedSale({ p }: { p: Purchase }) {
  const toggle = useToggleSave();
  const { event, state } = p;
  if (state === "not_open") {
    const opensAt = event.ticketTypes.map((t) => t.salesStartsAt).sort()[0];
    return (
      <>
        <Banner title={`Penjualan dibuka ${shortDateTime(opensAt)}`}>Simpan acara ini supaya tidak lupa.</Banner>
        <Button
          size="lg"
          block
          variant={event.saved ? "outline" : "primary"}
          loading={toggle.isPending}
          onClick={() => toggle.mutate({ slug: event.slug, saved: !event.saved })}
        >
          <Heart className={cn("size-[18px]", event.saved && "fill-current")} aria-hidden />
          {event.saved ? "Tersimpan" : "Simpan acara"}
        </Button>
      </>
    );
  }
  if (state === "sold_out")
    return (
      <>
        <Banner title="Tiket sudah habis terjual">Penyelenggara belum menambah kuota.</Banner>
        <Button asChild size="lg" block variant="outline">
          <Link href={`/events?category=${categorySlug(event.category)}`}>Lihat acara serupa</Link>
        </Button>
      </>
    );
  if (state === "closed")
    return (
      <>
        <Banner title="Penjualan ditutup penyelenggara">Sudah punya tiket? Lihat di Tiketku.</Banner>
        <Button asChild size="lg" block variant="outline">
          <Link href="/tickets">Buka Tiketku</Link>
        </Button>
      </>
    );
  return (
    <>
      {state === "ended" && <Banner title="Acara ini sudah berlangsung">Lihat acara lain dari {event.organizer.name}.</Banner>}
      <Button asChild size="lg" block variant="outline">
        <Link href={`/organizers/${event.organizer.username}`}>Lihat acara lainnya</Link>
      </Button>
    </>
  );
}

function PriceHead({ p, compact = false }: { p: Purchase; compact?: boolean }) {
  const { event, state } = p;
  const over = state === "ended" || state === "cancelled";
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn("font-semibold text-text-tertiary", compact ? "text-xs font-normal" : "text-[13px]")}>
        {state === "cancelled" ? "Acara dibatalkan" : over ? "Acara selesai" : "Mulai dari"}
      </span>
      <span className={cn("font-extrabold tracking-tight", compact ? "text-xl" : "text-[30px] leading-tight")}>
        {over ? formatDateShort(event.startsAt) : startingPrice(event) === 0 ? "Gratis" : formatRupiah(startingPrice(event))}
      </span>
    </div>
  );
}

/** Isi pilihan tiket, total, dan tombol beli. Dipakai kartu desktop dan lembar mobile. */
function PickerBody({ p, inSheet = false }: { p: Purchase; inSheet?: boolean }) {
  const { event, state } = p;
  const showPicker = state === "on_sale" || state === "not_open";
  return (
    <>
      {p.adjusted && (
        <Banner tone="warning" title={p.adjusted.to > 0 ? `Sisa ${p.adjusted.name} tinggal ${p.adjusted.to}` : `${p.adjusted.name} sudah habis`}>
          {p.adjusted.to > 0
            ? `Jumlah Anda kami sesuaikan dari ${p.adjusted.from} jadi ${p.adjusted.to} tiket.`
            : "Pilih jenis tiket lain yang masih tersedia."}
        </Banner>
      )}
      {showPicker && (
        <div className="flex flex-col gap-3">
          {!inSheet && <p className="text-[17px] font-extrabold">Pilih tiket</p>}
          <TicketPicker
            single
            ticketTypes={event.ticketTypes}
            value={p.selection}
            onChange={p.setSelection}
            maxPerOrder={event.maxPerOrder}
            disabled={p.processing || !p.online}
            hint={inSheet ? `Maksimal ${event.maxPerOrder} tiket, nama peserta diisi setelah ini` : `Maksimal ${event.maxPerOrder} tiket per pesanan`}
          />
        </div>
      )}
      {state === "on_sale" ? (
        <>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-[15px] font-semibold text-text-secondary">Total untuk {p.quantity} tiket</span>
            <span className="text-xl font-extrabold">{formatRupiah(p.amount)}</span>
          </div>
          <Button size="lg" block onClick={p.buy} loading={p.processing} disabled={p.quantity === 0 || !p.online}>
            {p.processing ? "Memesan tiket…" : "Beli tiket"}
          </Button>
          <p className="text-[13px] text-text-tertiary">
            {p.processing
              ? "Jangan tutup halaman ini"
              : p.loggedIn
                ? "Setelah ini Anda mengisi nama setiap peserta."
                : "Anda akan diminta masuk terlebih dahulu, lalu mengisi nama setiap peserta."}
          </p>
        </>
      ) : (
        <ClosedSale p={p} />
      )}
    </>
  );
}

function salesEndNote(event: EventDetail) {
  const ends = event.ticketTypes.filter((t) => t.status === "on_sale").map((t) => t.salesEndsAt).sort();
  return ends.length ? `Penjualan berakhir ${shortDateTime(ends[ends.length - 1])}` : null;
}

/** Kartu tiket. Desktop di kolom kanan (menempel saat digulir), tablet di bawah info acara. */
export function TicketCard({ p, className }: { p: Purchase; className?: string }) {
  const note = salesEndNote(p.event);
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-4 rounded-xl border border-border-strong bg-background p-6">
        <PriceHead p={p} />
        <PickerBody p={p} />
      </div>
      {note && (
        <p className="flex items-center gap-2 px-2 text-[13px] text-text-tertiary">
          <Clock className="size-4" aria-hidden />
          {note}
        </p>
      )}
    </div>
  );
}

/** Bar harga di bawah layar mobile dan lembar Pilih tiket (pita 04 A2, B2). */
export function MobileTicketBar({ p }: { p: Purchase }) {
  const { event, state } = p;
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-4 border-t border-border bg-background px-5 pt-3.5 pb-[max(20px,env(safe-area-inset-bottom))] md:hidden">
        <PriceHead p={p} compact />
        {state === "on_sale" ? (
          <Button size="lg" onClick={() => p.setSheetOpen(true)} disabled={!p.online}>
            Pilih tiket
          </Button>
        ) : (
          <Button size="lg" variant="outline" onClick={() => p.setSheetOpen(true)}>
            Lihat status
          </Button>
        )}
      </div>
      <Drawer open={p.sheetOpen} onOpenChange={p.setSheetOpen}>
        <DrawerContent className="max-h-[92dvh] md:hidden">
          <div className="flex flex-col gap-4 overflow-y-auto px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <DrawerTitle className="text-xl">Pilih tiket</DrawerTitle>
                <DrawerDescription className="text-[13px] text-text-tertiary">
                  {event.title}, {formatDateShort(event.startsAt).replace(/ \d{4}$/, "")}
                </DrawerDescription>
              </div>
              <DrawerClose asChild>
                <button type="button" aria-label="Tutup" className="press flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2">
                  <X className="size-[18px]" aria-hidden />
                </button>
              </DrawerClose>
            </div>
            <PickerBody p={p} inSheet />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

/** Dialog masuk untuk tamu yang menekan Beli tiket (baris C). */
export function PurchaseLogin({ p }: { p: Purchase }) {
  const s = p.selected;
  return (
    <LoginDialog
      open={p.loginOpen}
      onOpenChange={p.setLoginOpen}
      returnTo={p.returnTo}
      description={s ? `${p.quantity} tiket ${s.name} untuk ${p.event.title} sudah kami simpan.` : undefined}
    />
  );
}

export function OfflinePurchaseNote({ p }: { p: Purchase }) {
  if (p.online) return null;
  return (
    <Alert tone="offline" title="Anda sedang luring">
      Menampilkan data yang terakhir dimuat. Pemesanan tiket memerlukan koneksi internet.
    </Alert>
  );
}
