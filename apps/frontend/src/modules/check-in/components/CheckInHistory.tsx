"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/elements/PageHeader";
import { DataList } from "@/components/elements/DataList";
import { QueryState } from "@/components/elements/QueryState";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useScanHistory } from "../hooks";
import { formatTime, formatDateShort } from "@/lib/format";

export function CheckInHistory({ eventId }: { eventId: string }) {
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const history = useScanHistory(eventId, {
    page,
    rejectedOnly: filter === "rejected",
  });
  if (history.isPending || history.isError)
    return (
      <QueryState
        loading={history.isPending}
        error={history.error}
        retry={history.refetch}
      />
    );
  const rows = history.data.data.filter((item) =>
    filter === "rejected"
      ? item.outcome === "rejected"
      : filter !== "valid" || item.outcome !== "rejected",
  );
  const total = history.data.meta.historyTotal ?? history.data.meta.total;
  return (
    <div className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title="Riwayat pemindaian"
        description={`Semua panitia acara ini. ${history.data.meta.total} dari ${history.data.meta.paidTickets} peserta sudah masuk.`}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/events/${eventId}/scan`}>Kembali ke pemindai</Link>
          </Button>
        }
      />
      <section className="flex flex-1 flex-col gap-4 rounded-lg bg-background p-4 md:p-6">
        <Tabs
          value={filter}
          onValueChange={(value) => {
            setFilter(value);
            setPage(1);
          }}
        >
          <TabsList>
            <TabsTrigger value="all">Semua</TabsTrigger>
            <TabsTrigger value="valid">Valid</TabsTrigger>
            <TabsTrigger value="rejected">Ditolak</TabsTrigger>
          </TabsList>
        </Tabs>
        <DataList
          rows={rows}
          rowKey={(item) => `${item.ticketId}-${item.checkedInAt}`}
          emptyTitle="Belum ada pemindaian yang sesuai"
          columns={[
            {
              key: "name",
              title: "Peserta",
              render: (item) => (
                <div>
                  <p className="font-bold">{item.attendeeName}</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {item.ticketCode || item.reason}
                  </p>
                </div>
              ),
            },
            {
              key: "status",
              title: "Hasil",
              render: (item) => (
                <Badge
                  tone={item.outcome === "rejected" ? "danger" : "success"}
                >
                  {item.outcome === "rejected" ? "Ditolak" : "Valid"}
                </Badge>
              ),
            },
            {
              key: "actor",
              title: "Panitia",
              render: (item) => (
                <span>
                  {item.checkedInBy?.name ?? "Panitia"}
                  {item.method === "manual" ? ", manual" : ""}
                </span>
              ),
            },
            {
              key: "time",
              title: "Waktu",
              render: (item) => (
                <span>
                  {formatDateShort(item.checkedInAt)}
                  <br />
                  {formatTime(item.checkedInAt)}
                </span>
              ),
            },
          ]}
          mobile={(item) => (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold">{item.attendeeName}</p>
                <Badge
                  tone={item.outcome === "rejected" ? "danger" : "success"}
                >
                  {item.outcome === "rejected" ? "Ditolak" : "Valid"}
                </Badge>
              </div>
              <p className="text-xs text-text-secondary">
                {item.reason ?? item.ticketTypeName},{" "}
                {formatTime(item.checkedInAt)},{" "}
                {item.checkedInBy?.name ?? "Panitia"}
                {item.method === "manual" ? ", manual" : ""}
              </p>
            </div>
          )}
        />
        <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-sm">
          <span>Halaman {page}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              disabled={page * history.data.meta.limit >= total}
              onClick={() => setPage(page + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
