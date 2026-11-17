"use client";

import { IconInput } from "@/components/elements/IconInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, MoreHorizontal, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SalesChart } from "./SalesChart";
import { useOnline } from "@/hooks/use-online";
import { useDebounced } from "@/hooks/use-debounced";
import { Alert } from "@/components/elements/Alert";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/elements/PageHeader";
import { StatCard } from "@/components/elements/StatCard";
import { DataList } from "@/components/elements/DataList";
import { QueryState } from "@/components/elements/QueryState";
import { StateView } from "@/components/elements/StateView";
import { useWorkspaceMe } from "@/modules/organizer-auth/hooks";
import { useAssignedEvents } from "@/modules/check-in/hooks";
import { useOrgEvents, useOrgSummary, type SummaryRange } from "../hooks";
import type { OrgEventStatus } from "../types";
import { formatDateShort, formatRupiah, formatRupiahShort } from "@/lib/format";

const statuses: Record<OrgEventStatus, string> = {
  draft: "Draf",
  on_sale: "Dijual",
  scheduled: "Belum dijual",
  ended: "Selesai",
  cancelled: "Dibatalkan",
};
export function EventStatus({ status }: { status: OrgEventStatus }) {
  return (
    <Badge
      tone={
        status === "on_sale"
          ? "success"
          : status === "cancelled"
            ? "danger"
            : status === "scheduled"
              ? "info"
              : "neutral"
      }
    >
      {statuses[status] ?? "Draf"}
    </Badge>
  );
}
function AssignedEvents() {
  const events = useAssignedEvents();
  if (events.isPending || events.isError)
    return (
      <QueryState
        loading={events.isPending}
        error={events.error}
        retry={events.refetch}
      />
    );
  if (!events.data.data.length)
    return (
      <StateView
        illustration="no-events"
        title="Belum ada acara yang ditugaskan"
        description="Organizer akan menugaskan acara yang dapat Anda pindai."
      />
    );
  return (
    <div className="space-y-6 p-4 md:p-8">
      <PageHeader
        title="Acara yang ditugaskan"
        description="Pilih acara untuk mulai memindai tiket peserta."
      />
      <div className="space-y-4">
        {events.data.data.map((event) => (
          <div
            key={event.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-background p-5"
          >
            <div>
              <h2 className="text-lg font-extrabold">{event.title}</h2>
              <p className="mt-2 text-sm text-text-secondary">
                {formatDateShort(event.startsAt)}, {event.venueName}
              </p>
              <p className="mt-2 text-sm">
                {event.checkedIn} dari {event.paidTickets} peserta sudah masuk
              </p>
            </div>
            {Date.now() >= Date.parse(event.scanOpensAt) &&
            Date.now() < Date.parse(event.scanClosesAt) ? (
              <Button asChild>
                <Link href={`/events/${event.id}/scan`}>Mulai scan</Link>
              </Button>
            ) : (
              <div className="space-y-2">
                <Badge>
                  {Date.now() >= Date.parse(event.scanClosesAt)
                    ? "Acara selesai"
                    : "Scan belum dibuka"}
                </Badge>
                <p className="text-xs text-text-secondary">
                  Scan dibuka 2 jam sebelum acara.
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
function DashboardContent({ listOnly = false }: { listOnly?: boolean }) {
  const search = useSearchParams();
  const me = useWorkspaceMe();
  const online = useOnline();
  const [range, setRange] = useState<SummaryRange>(
    () =>
      (["7d", "30d", "90d", "year"].includes(search.get("range") ?? "")
        ? search.get("range")
        : "30d") as SummaryRange,
  );
  const [tab, setTab] = useState(search.get("status") ?? "running");
  const [query, setQuery] = useState(search.get("q") ?? "");
  const debouncedQuery = useDebounced(query);
  const events = useOrgEvents(undefined, me.data?.role === "organizer");
  const summary = useOrgSummary(
    range,
    me.data?.role === "organizer" && !listOnly,
  );
  const frozen = me.data?.organizer.frozen;
  const setUrl = (key: string, value: string) => {
    const url = new URL(window.location.href);
    value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
    window.history.replaceState(null, "", url);
  };
  if (me.data?.role === "committee") return <AssignedEvents />;
  if (events.isPending || events.isError)
    return (
      <QueryState
        loading={events.isPending}
        error={events.error}
        retry={events.refetch}
      />
    );
  if (!events.data.data.length)
    return (
      <StateView
        illustration="no-events"
        title={`Selamat datang, ${me.data?.organizer.name ?? "organizer"}`}
        description="Mulai dengan membuat acara pertama Anda. Acara dapat disimpan sebagai draf sebelum diterbitkan."
        action={
          <Button asChild={!frozen && online} disabled={frozen || !online}>
            {frozen || !online ? (
              <span>Buat acara pertama</span>
            ) : (
              <Link href="/events/new">Buat acara pertama</Link>
            )}
          </Button>
        }
      />
    );
  const rows = events.data.data.filter(
    (event) =>
      (tab === "running"
        ? ["on_sale", "scheduled"].includes(event.status)
        : tab === "ended"
          ? ["ended", "cancelled"].includes(event.status)
          : event.status === tab) &&
      event.title.toLowerCase().includes(debouncedQuery.toLowerCase()),
  );
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title={listOnly ? "Acara" : "Dashboard"}
        description={`Ringkasan acara ${me.data?.organizer.name ?? "Anda"}.`}
        actions={
          <Button asChild={!frozen && online} disabled={frozen || !online}>
            {frozen || !online ? (
              <span>Buat acara</span>
            ) : (
              <Link href="/events/new">
                <Plus className="size-4" />
                Buat acara
              </Link>
            )}
          </Button>
        }
      />
      {!online && (
        <Alert tone="offline" title="Data tersimpan terakhir">
          {summary.data?.generatedAt
            ? formatDateShort(summary.data.generatedAt)
            : "Sambungkan internet untuk memperbarui data."}
        </Alert>
      )}
      {frozen && (
        <p
          role="status"
          className="rounded-lg bg-warning-tint p-4 text-sm text-warning-ink"
        >
          Akun organizer dibekukan sementara. Penjualan dihentikan selama
          peninjauan, tiket terjual tetap berlaku.
        </p>
      )}
      {!listOnly && (
        <>
          <div className="flex justify-center xl:justify-end">
            <div className="flex items-center gap-3 text-sm font-semibold">
              <span id="summary-range">Periode</span>
              <Select
                value={range}
                onValueChange={(value) => {
                  setRange(value as SummaryRange);
                  setUrl("range", value);
                }}
              >
                <SelectTrigger
                  aria-labelledby="summary-range"
                  size="sm"
                  className="w-auto min-w-44 rounded-full px-4"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">7 hari terakhir</SelectItem>
                  <SelectItem value="30d">30 hari terakhir</SelectItem>
                  <SelectItem value="90d">90 hari terakhir</SelectItem>
                  <SelectItem value="year">Tahun ini</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {summary.isError ? (
            <Alert
              title="Ringkasan belum dapat dimuat"
              action={
                <Button variant="outline" onClick={() => summary.refetch()}>
                  Coba lagi
                </Button>
              }
            >
              {summary.error.message}
            </Alert>
          ) : (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard
                label="Penjualan kotor"
                value={
                  summary.data
                    ? formatRupiahShort(summary.data.grossPaidSales)
                    : "…"
                }
                caption={
                  summary.data
                    ? formatRupiah(summary.data.grossPaidSales)
                    : "Memuat ringkasan"
                }
              />
              <StatCard
                label="Tiket terjual"
                value={summary.data?.paidTickets ?? "…"}
                caption="Pesanan yang sudah dibayar pada periode ini"
              />
              <StatCard
                label="Acara terbit"
                value={summary.data?.publishedEvents ?? "…"}
                caption="Jumlah saat ini, termasuk acara selesai"
              />
              <StatCard
                label="Tingkat kehadiran"
                value={
                  summary.data?.attendanceRate === undefined
                    ? "Belum tersedia"
                    : `${summary.data.attendanceRate}%`
                }
                caption="Acara yang sudah selesai"
              />
            </div>
          )}
          {summary.data && <SalesChart rows={summary.data.dailySales} />}
          <section className="space-y-3 rounded-lg bg-background p-4 md:p-6">
            <h2 className="text-lg font-extrabold">Perlu perhatian</h2>
            {events.data.data.some((e) => e.status === "draft") ? (
              <Link
                href="/events?status=draft"
                className="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold"
              >
                {events.data.data.filter((e) => e.status === "draft").length}{" "}
                draf belum diterbitkan<span aria-hidden>→</span>
              </Link>
            ) : (
              <p className="text-sm text-text-secondary">
                Tidak ada draf yang perlu dilengkapi.
              </p>
            )}
            {summary.data?.pendingOrders !== undefined && (
              <p className="text-sm text-text-secondary">
                {summary.data.pendingOrders} pesanan menunggu pembayaran.
              </p>
            )}
          </section>
        </>
      )}
      <section className="flex flex-1 flex-col gap-4 rounded-lg bg-background p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-extrabold">Acara saya</h2>
          <label className="w-full md:w-64">
            <span className="sr-only">Cari acara</span>
            <IconInput
              type="search"
              leading={<Search aria-hidden />}
              placeholder="Cari acara"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setUrl("q", e.target.value);
              }}
            />
          </label>
        </div>
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value);
            setUrl("status", value);
          }}
        >
          <TabsList>
            <TabsTrigger value="running">Berjalan</TabsTrigger>
            <TabsTrigger value="draft">Draf</TabsTrigger>
            <TabsTrigger value="ended">Selesai</TabsTrigger>
          </TabsList>
        </Tabs>
        <DataList
          rows={rows}
          rowKey={(event) => event.id}
          emptyTitle="Tidak ada acara yang cocok"
          emptyAction={
            query ? (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setUrl("q", "");
                }}
              >
                Hapus pencarian
              </Button>
            ) : undefined
          }
          columns={[
            {
              key: "event",
              title: "Acara",
              render: (event) => (
                <div>
                  <Link
                    className="font-bold hover:underline"
                    href={`/events/${event.id}${event.status === "draft" ? "/edit" : ""}`}
                  >
                    {event.title}
                  </Link>
                  <p className="mt-1 text-xs text-text-secondary">
                    {event.startsAt
                      ? formatDateShort(event.startsAt)
                      : "Belum dijadwalkan"}
                    , {event.venueName || "Lokasi belum diisi"}
                  </p>
                </div>
              ),
            },
            {
              key: "status",
              title: "Status",
              render: (event) => <EventStatus status={event.status} />,
            },
            {
              key: "sold",
              title: "Terjual",
              numeric: true,
              render: (event) => (
                <span>
                  {event.sold} / {event.capacity}
                </span>
              ),
            },
            {
              key: "gross",
              title: "Pendapatan",
              numeric: true,
              render: (event) => formatRupiahShort(event.gross),
            },
            {
              key: "action",
              title: "Tindakan",
              render: (event) => (
                <Button variant="outline" asChild>
                  <Link
                    href={`/events/${event.id}${event.status === "draft" ? "/edit" : ""}`}
                  >
                    Kelola
                  </Link>
                </Button>
              ),
            },
          ]}
          mobile={(event) => (
            <div className="relative pr-12">
              <Link
                className="block min-h-28 space-y-2"
                href={`/events/${event.id}${event.status === "draft" ? "/edit" : ""}`}
              >
                <p className="font-bold">{event.title}</p>
                <p className="text-xs leading-relaxed text-text-secondary">
                  {event.startsAt
                    ? formatDateShort(event.startsAt)
                    : "Belum dijadwalkan"}{" "}
                  · {event.venueName || "Lokasi belum diisi"}
                </p>
                <EventStatus status={event.status} />
                <p className="text-xs text-text-secondary">
                  {event.sold} / {event.capacity} terjual ·{" "}
                  {formatRupiah(event.gross)}
                </p>
                <span className="sr-only">Kelola</span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className="absolute top-0 right-0"
                    variant="ghost"
                    size="icon"
                    aria-label={`Tindakan ${event.title}`}
                  >
                    <MoreHorizontal className="size-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link
                      href={`/events/${event.id}${event.status === "draft" ? "/edit" : ""}`}
                    >
                      Kelola acara
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/events/${event.id}/edit`}>Ubah acara</Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        />
      </section>
    </div>
  );
}
export function DashboardView({ listOnly }: { listOnly?: boolean }) {
  return (
    <Suspense fallback={<QueryState loading retry={() => {}} />}>
      <DashboardContent listOnly={listOnly} />
    </Suspense>
  );
}
