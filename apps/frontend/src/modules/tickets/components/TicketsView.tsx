"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronRight, Ticket } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { formatRupiah, formatTime } from "@/lib/format";
import { useOnline } from "@/hooks/use-online";
import { useCancelOrder, useOrders } from "@/modules/orders/hooks";
import type { Order } from "@/modules/orders/types";
import { useTickets } from "@/modules/tickets/hooks";
import { useRefunds } from "@/modules/refunds/hooks";
import { eventEnded, groupByOrder, ticketState, type TicketGroup } from "@/modules/tickets/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/elements/Alert";
import { DangerConfirmDialog } from "@/components/elements/DangerConfirmDialog";
import { CountdownPill, formatCountdown, useCountdown } from "@/components/elements/CountdownPill";
import { StateView } from "@/components/elements/StateView";

/**
 * Tiketku. Pita 07.
 * Tab Akan datang (dengan pesanan menunggu bayar di atas), Selesai, dan Dibatalkan.
 * Satu baris = satu pesanan. Tiket dikelompokkan per bulan acara.
 */

type Tab = "upcoming" | "done" | "cancelled";

const day = (iso: string) => {
  const d = new Date(iso);
  return {
    weekday: format(d, "EEE", { locale: localeId }),
    date: format(d, "d"),
    month: format(d, "MMM", { locale: localeId }),
    monthYear: format(d, "MMMM yyyy", { locale: localeId }),
  };
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function DateBlock({ iso, compact = false }: { iso: string; compact?: boolean }) {
  const d = day(iso);
  return (
    <span
      className={cn(
        "flex shrink-0 flex-col items-center justify-center",
        compact ? "size-14 rounded-[12px] bg-surface" : "w-[76px] py-2",
      )}
      aria-hidden
    >
      <span className={cn("font-bold text-text-tertiary", compact ? "text-[11px]" : "text-[13px]")}>{d.weekday}</span>
      <span className={cn("leading-none font-extrabold", compact ? "text-[22px]" : "text-[34px]")}>{d.date}</span>
      <span className={cn("font-bold text-text-secondary", compact ? "text-[11px]" : "text-[13px]")}>{d.month}</span>
    </span>
  );
}

function MonthGroups<T>({ items, dateOf, render }: { items: T[]; dateOf: (t: T) => string; render: (t: T) => ReactNode }) {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const key = capitalize(day(dateOf(it)).monthYear);
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  return (
    <>
      {[...groups.entries()].map(([month, list]) => (
        <section key={month} className="flex flex-col gap-3 md:gap-3.5">
          <h2 className="text-[13px] font-bold text-text-tertiary md:text-[15px]">{month}</h2>
          <ul className="flex flex-col gap-3 md:gap-3.5">
            {list.map((it, i) => (
              <li key={i}>{render(it)}</li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/** Baris tiket. Desktop: kartu lebar dengan poster dan tombol. Mobile: baris ringkas yang bisa ditekan. */
function GroupRow({
  group,
  meta,
  status,
  action,
  mobileNote,
}: {
  group: TicketGroup | { orderId: string; event: Order["event"] & { endsAt?: string }; ticketTypeName: string; count: number };
  meta: string;
  status: { label: string; tone: "success" | "neutral" | "warning" | "danger" };
  action: { label: string; href: string };
  mobileNote: { text: string; tone: "success" | "neutral" | "warning" | "danger" };
}) {
  const e = group.event;
  const count = "tickets" in group ? group.tickets.length : group.count;
  return (
    <>
      <Link
        href={action.href}
        className="press flex items-center gap-3.5 rounded-lg border border-border-strong py-3 pr-3.5 pl-3 md:hidden"
      >
        <DateBlock iso={e.startsAt} compact />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="line-clamp-2 text-[15px] leading-snug font-extrabold">{e.title}</span>
          <span className="truncate text-[13px] text-text-secondary">
            {formatTime(e.startsAt).replace(" WIB", "")}, {e.venueName}
          </span>
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs font-bold",
              mobileNote.tone === "success" ? "text-success-ink" : mobileNote.tone === "danger" ? "text-danger-ink" : mobileNote.tone === "warning" ? "text-warning-ink" : "text-text-tertiary",
            )}
          >
            <Ticket className="size-3.5" aria-hidden />
            {mobileNote.text}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-text-tertiary" aria-hidden />
      </Link>

      <div className="hidden items-center gap-5 rounded-xl border border-border-strong p-4 md:flex">
        <DateBlock iso={e.startsAt} />
        {e.poster && (
          <span className="relative h-[100px] w-[150px] shrink-0 overflow-hidden rounded-[14px] bg-surface-2">
            <Image src={e.poster} alt="" fill sizes="150px" className="object-cover" />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="truncate text-[19px] font-extrabold">{e.title}</h3>
          <p className="text-sm text-text-secondary">{meta}</p>
          <p className="truncate text-sm text-text-tertiary">{e.venueName}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2.5">
          <span className="flex items-center gap-1.5 text-sm font-bold">
            <Ticket className="size-4" aria-hidden />
            {count} tiket
          </span>
          <Badge tone={status.tone}>{status.label}</Badge>
          <Button asChild variant="outline" size="sm">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        </div>
      </div>
    </>
  );
}

function PendingCard({ order, onCancel }: { order: Order; onCancel: () => void }) {
  const ms = useCountdown(order.expiresAt, order.serverTime);
  const until = format(new Date(order.expiresAt), "HH.mm");
  const href = `/checkout/${order.id}`;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-tint p-4 md:flex-row md:items-center md:gap-5 md:p-5">
      <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-5">
        {order.event.poster && (
          <span className="relative size-14 shrink-0 overflow-hidden rounded-[12px] bg-surface-2 md:size-[88px] md:rounded-2xl">
            <Image src={order.event.poster} alt="" fill sizes="88px" className="object-cover" />
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5 md:gap-1.5">
          <span className="text-xs font-bold text-warning-ink md:hidden">Menunggu pembayaran, {formatCountdown(ms)}</span>
          {/* Latar badge dan pil sama dengan latar kartu, jadi padding-nya dihapus supaya sejajar. */}
          <Badge tone="warning" className="hidden bg-transparent px-0 md:inline-flex">
            Menunggu pembayaran
          </Badge>
          <span className="truncate text-[15px] font-extrabold md:text-[19px]">{order.event.title}</span>
          <span className="text-[13px] text-text-secondary md:text-sm">
            <span className="md:hidden">
              {order.quantity} tiket, {formatRupiah(order.totalAmount)}
            </span>
            <span className="hidden md:inline">
              {format(new Date(order.event.startsAt), "EEE, d MMM", { locale: localeId })}, {order.ticketType.name} × {order.quantity},{" "}
              {formatRupiah(order.totalAmount)}
            </span>
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2 md:items-end">
        <CountdownPill expiresAt={order.expiresAt} serverTime={order.serverTime} label={`Bayar sebelum ${until} WIB`} className="hidden bg-transparent pr-0 pl-0 md:inline-flex md:self-end" />
        <div className="flex gap-2">
          <Button variant="ghost" className="hidden md:inline-flex" onClick={onCancel}>
            Batalkan
          </Button>
          <Button asChild block className="md:w-auto">
            <Link href={href}>Lanjutkan pembayaran</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function cancelledInfo(o: Order) {
  const when = (iso?: string | null) => (iso ? format(new Date(iso), "EEE, d MMM, HH.mm", { locale: localeId }) + " WIB" : "");
  if (o.cancelledBy === "organizer" || o.event.status === "cancelled")
    return {
      note: "Penyelenggara membatalkan acara, dana dikembalikan ke metode bayar asal dalam 3 sampai 7 hari kerja",
      status: "Acara dibatalkan",
      action: { label: "Hubungi penyelenggara", href: o.event.organizerUsername ? `/organizers/${o.event.organizerUsername}` : "/" },
    };
  if (o.refundStatus === "full")
    return {
      note: `Pengembalian dana selesai${o.refundedAmount ? `, ${formatRupiah(o.refundedAmount)}` : ""} kembali ke metode bayar asal`,
      status: "Dana dikembalikan",
      action: { label: "Lihat acara", href: o.event.slug ? `/events/${o.event.slug}` : "/" },
    };
  if (o.cancelledBy === "buyer")
    return {
      note: `Anda membatalkan ${when(o.cancelledAt)}`,
      status: "Dibatalkan",
      action: { label: "Lihat acara", href: o.event.slug ? `/events/${o.event.slug}` : "/" },
    };
  return {
    note: `Waktu bayar habis ${when(o.expiresAt)}`,
    status: "Kedaluwarsa",
    action: { label: "Pesan lagi", href: o.event.slug ? `/events/${o.event.slug}` : "/" },
  };
}

export function TicketsView() {
  const tickets = useTickets();
  const orders = useOrders();
  const online = useOnline();
  const cancel = useCancelOrder();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [cancelling, setCancelling] = useState<Order | null>(null);
  const refunds = useRefunds();
  /** Pesanan dengan pengajuan pengembalian dana yang masih berjalan. */
  const refunding = useMemo(
    () => new Set((refunds.data ?? []).filter((r) => ["requested", "approved", "processing", "manual_required"].includes(r.status)).map((r) => r.orderId)),
    [refunds.data],
  );

  const data = useMemo(() => {
    const groups = groupByOrder(tickets.data?.data ?? []);
    // Tiket yang dananya sudah dikembalikan berstatus "cancelled". Pesanan tanpa tiket aktif tampil di tab Dibatalkan.
    const live = groups.filter((g) => g.event.status !== "cancelled" && g.tickets.some((t) => t.checkInStatus !== "cancelled"));
    const upcoming = live.filter((g) => !eventEnded(g.event)).sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));
    const done = live.filter((g) => eventEnded(g.event)).sort((a, b) => b.event.startsAt.localeCompare(a.event.startsAt));
    const all = orders.data?.data ?? [];
    const pending = all.filter((o) => o.paymentStatus === "pending" && o.reservationStatus === "held" && new Date(o.expiresAt).getTime() > Date.now());
    const cancelled = all
      .filter((o) => o.reservationStatus === "released" || o.paymentStatus === "expired" || o.event.status === "cancelled" || !!o.cancelledBy || o.refundStatus === "full")
      .sort((a, b) => b.event.startsAt.localeCompare(a.event.startsAt));
    return { upcoming, done, pending, cancelled };
  }, [tickets.data, orders.data]);

  const loading = tickets.isPending || orders.isPending;
  const failed = (tickets.isError && !tickets.data) || (orders.isError && !orders.data);
  const empty = !loading && !failed && data.upcoming.length + data.done.length + data.pending.length + data.cancelled.length === 0;

  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: "upcoming", label: "Akan datang", count: data.upcoming.length },
    { value: "done", label: "Selesai", count: data.done.length },
    { value: "cancelled", label: "Dibatalkan" },
  ];

  const header = (
    <div className="flex flex-col gap-3.5 md:gap-7">
      <h1 className="text-[30px] leading-tight font-extrabold tracking-tight md:text-[40px]">Tiketku</h1>
      {!online && (
        <Alert tone="offline" title="Anda sedang luring">
          E-tiket yang pernah dibuka tetap tersedia. Pembayaran memerlukan koneksi internet.
        </Alert>
      )}
      {!empty && !failed && (
        <div role="tablist" aria-label="Status tiket" className="flex gap-1 rounded-full bg-surface-2 p-1 md:gap-7 md:rounded-none md:bg-transparent md:p-0">
          {tabs.map((t) => {
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setTab(t.value)}
                className={cn(
                  "press flex h-9 flex-1 items-center justify-center gap-2 rounded-full text-sm transition-colors md:h-auto md:flex-none md:rounded-none md:border-b-2 md:py-3 md:text-base",
                  active
                    ? "bg-background font-extrabold shadow-sm md:border-foreground md:bg-transparent md:shadow-none"
                    : "font-semibold text-text-secondary md:border-transparent md:font-medium md:text-text-tertiary",
                )}
              >
                {t.label}
                {t.count !== undefined && (
                  <span
                    className={cn(
                      "hidden h-[22px] min-w-[22px] items-center justify-center rounded-full px-2 text-xs font-extrabold md:inline-flex",
                      active ? "bg-inverse text-inverse-foreground" : "bg-surface-2 text-text-secondary",
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  let body: ReactNode;
  if (loading) body = <TicketsSkeleton />;
  else if (failed)
    body = (
      <StateView
        tone="error"
        illustration="failed-load"
        title="Tiketku gagal dimuat"
        description="Periksa koneksi internet Anda, lalu coba lagi."
        action={
          <Button
            onClick={() => {
              tickets.refetch();
              orders.refetch();
            }}
          >
            Coba lagi
          </Button>
        }
      />
    );
  else if (empty)
    body = (
      <StateView
        illustration="no-tickets"
        title="Belum ada tiket"
        description="Tiket yang Anda beli akan muncul di sini, lengkap dengan kode QR untuk masuk."
        action={
          <Button asChild>
            <Link href="/">Jelajahi acara</Link>
          </Button>
        }
      />
    );
  else if (tab === "upcoming")
    body =
      data.upcoming.length + data.pending.length === 0 ? (
        <StateView
          layout="section"
          illustration="no-tickets"
          title="Tidak ada acara mendatang"
          description="Tiket untuk acara berikutnya akan muncul di sini."
          action={
            <Button asChild variant="outline">
              <Link href="/">Jelajahi acara</Link>
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-6 md:gap-7">
          {data.pending.map((o) => (
            <PendingCard key={o.id} order={o} onCancel={() => setCancelling(o)} />
          ))}
          <MonthGroups
            items={data.upcoming}
            dateOf={(g) => g.event.startsAt}
            render={(g) => {
              const active = g.tickets.filter((t) => t.checkInStatus !== "cancelled");
              const unused = active.filter((t) => ticketState(t) === "unused").length;
              const returned = g.tickets.length - active.length;
              const inProgress = refunding.has(g.orderId);
              return (
                <GroupRow
                  group={g}
                  meta={`${formatTime(g.event.startsAt)}, ${g.ticketTypeName}${returned ? `, ${returned} tiket dikembalikan` : ""}`}
                  status={
                    inProgress
                      ? { label: "Pengembalian diproses", tone: "warning" }
                      : unused
                        ? { label: "Belum dipakai", tone: "success" }
                        : { label: "Sudah dipakai", tone: "neutral" }
                  }
                  action={{ label: "Lihat e-tiket", href: `/tickets/${g.orderId}` }}
                  mobileNote={
                    inProgress
                      ? { text: `${active.length} tiket, pengembalian diproses`, tone: "warning" }
                      : { text: `${active.length} tiket, ${unused ? "belum dipakai" : "sudah dipakai"}`, tone: unused ? "success" : "neutral" }
                  }
                />
              );
            }}
          />
        </div>
      );
  else if (tab === "done")
    body =
      data.done.length === 0 ? (
        <StateView layout="section" illustration="no-tickets" title="Belum ada acara selesai" description="Acara yang sudah Anda datangi akan tercatat di sini." />
      ) : (
        <div className="flex flex-col gap-6 md:gap-7">
          <MonthGroups
            items={data.done}
            dateOf={(g) => g.event.startsAt}
            render={(g) => {
              const used = g.tickets.filter((t) => t.checkInStatus === "used");
              const first = used.map((t) => t.checkedInAt).filter(Boolean).sort()[0];
              const all = used.length === g.tickets.length;
              const status = all
                ? { label: "Sudah check-in", tone: "success" as const }
                : used.length
                  ? { label: "Sebagian hadir", tone: "warning" as const }
                  : { label: "Tidak hadir", tone: "neutral" as const };
              const gate = g.tickets.find((t) => t.checkInGate)?.checkInGate;
              const note = all
                ? `Masuk ${first ? format(new Date(first), "EEE, d MMM, HH.mm", { locale: localeId }) + " WIB" : ""}${gate ? `, ${gate}` : ""}`
                : used.length
                  ? `${used.length} dari ${g.tickets.length} peserta hadir`
                  : `${g.ticketTypeName}, ${g.tickets.length} tiket`;
              return (
                <GroupRow
                  group={g}
                  meta={all || used.length ? `${g.ticketTypeName}, ${g.tickets.length} tiket` : `${g.tickets.length} tiket tidak dipakai`}
                  status={status}
                  action={{ label: used.length ? "Lihat e-tiket" : "Lihat detail", href: `/tickets/${g.orderId}` }}
                  mobileNote={{
                    text: all
                      ? `Masuk ${first ? format(new Date(first), "HH.mm") : ""}${gate ? `, ${gate}` : ""}`
                      : used.length
                        ? note
                        : "Tidak hadir",
                    tone: "neutral",
                  }}
                />
              );
            }}
          />
        </div>
      );
  else
    body =
      data.cancelled.length === 0 ? (
        <StateView layout="section" illustration="no-tickets" title="Tidak ada pesanan dibatalkan" description="Pesanan yang dibatalkan atau kedaluwarsa akan tercatat di sini." />
      ) : (
        <div className="flex flex-col gap-6 md:gap-7">
          <MonthGroups
            items={data.cancelled}
            dateOf={(o) => o.event.startsAt}
            render={(o) => {
              const info = cancelledInfo(o);
              return (
                <GroupRow
                  group={{ orderId: o.id, event: o.event, ticketTypeName: o.ticketType.name, count: o.quantity }}
                  meta={`${o.ticketType.name}, ${o.quantity} tiket, ${formatRupiah(o.totalAmount)}`}
                  status={{ label: info.status, tone: info.status === "Acara dibatalkan" ? "danger" : "neutral" }}
                  action={info.action}
                  mobileNote={{ text: info.status, tone: info.status === "Acara dibatalkan" ? "danger" : "neutral" }}
                />
              );
            }}
          />
        </div>
      );

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-5 px-5 pt-[max(12px,env(safe-area-inset-top))] pb-32 md:gap-7 md:px-6 md:pt-10 md:pb-24 xl:px-0">
      {header}
      {body}
      <DangerConfirmDialog
        open={!!cancelling}
        onOpenChange={(o) => !o && setCancelling(null)}
        title="Batalkan pesanan ini?"
        description={cancelling ? `Tiket ${cancelling.event.title} akan dilepas dan dapat dibeli orang lain.` : ""}
        cancelLabel="Tidak jadi"
        confirmLabel="Batalkan pesanan"
        loading={cancel.isPending}
        onConfirm={() =>
          cancelling &&
          cancel.mutate(cancelling.id, {
            onSuccess: () => {
              setCancelling(null);
              toast("Pesanan dibatalkan. Tiket sudah dilepas.");
            },
            onError: () => toast.error("Pesanan gagal dibatalkan. Coba lagi."),
          })
        }
      />
    </div>
  );
}

function TicketsSkeleton() {
  return (
    <div className="flex flex-col gap-3.5" aria-busy>
      <span className="skeleton h-[136px] w-full rounded-xl" />
      <span className="skeleton h-4 w-32 rounded" />
      {Array.from({ length: 3 }).map((_, i) => (
        <span key={i} className="skeleton h-[88px] w-full rounded-lg md:h-[135px] md:rounded-xl" />
      ))}
    </div>
  );
}
