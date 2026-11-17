"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataList } from "@/components/elements/DataList";
import { QueryState } from "@/components/elements/QueryState";
import { useOnline } from "@/hooks/use-online";
import { useDebounced } from "@/hooks/use-debounced";
import { formatDateTimeCompact } from "@/lib/format";
import { useOrgEventAttendees } from "../hooks";
import { organizerEventsApi } from "../api";
import { downloadCsv } from "../csv";
import { ListPagination } from "./ListPagination";
const labels = {
  unused: "Belum check-in",
  used: "Sudah check-in",
  cancelled: "Dibatalkan",
};
export function AttendeeList() {
  const { id } = useParams<{ id: string }>();
  const [query, setQuery] = useState("");
  const q = useDebounced(query);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const attendees = useOrgEventAttendees(id, {
    q,
    checkInStatus: status,
    page,
  });
  const online = useOnline();
  const { refetch } = attendees;
  useEffect(() => {
    if (!online) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") refetch();
    }, 15_000);
    return () => clearInterval(interval);
  }, [online, refetch]);
  return (
    <section className="space-y-5 rounded-lg bg-background p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold">Peserta</h2>
          <p className="mt-2 text-xs text-text-secondary">
            Diperbarui setiap 15 detik saat halaman terbuka.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={
            !online || exporting || attendees.isPending || attendees.isError
          }
          onClick={async () => {
            setExporting(true);
            try {
              await downloadCsv(
                `peserta-${id}.csv`,
                [
                  "Nama",
                  "Kode tiket",
                  "Jenis tiket",
                  "Status",
                  "Waktu check-in",
                ],
                (number) =>
                  organizerEventsApi.attendees(id, {
                    q,
                    checkInStatus: status,
                    page: number,
                  }),
                (r) => [
                  r.attendeeName,
                  r.ticketCode,
                  r.ticketTypeName,
                  labels[r.checkInStatus],
                  r.checkedInAt ?? "",
                ],
              );
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Ekspor gagal");
            } finally {
              setExporting(false);
            }
          }}
        >
          {exporting ? "Mengekspor…" : "Ekspor CSV"}
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          aria-label="Cari peserta"
          type="search"
          placeholder="Cari nama atau kode tiket"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Status check-in"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="min-h-11 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">Semua peserta</option>
          {Object.entries(labels).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {attendees.isPending || attendees.isError ? (
        <QueryState
          loading={attendees.isPending}
          error={attendees.error}
          retry={attendees.refetch}
        />
      ) : (
        <>
          <DataList
            rows={attendees.data.data}
            rowKey={(r) => r.ticketId}
            emptyTitle="Tidak ada peserta yang cocok"
            columns={[
              {
                key: "name",
                title: "Peserta",
                render: (r) => <p className="font-bold">{r.attendeeName}</p>,
              },
              {
                key: "ticket",
                title: "Tiket",
                render: (r) => (
                  <div>
                    <p>{r.ticketCode}</p>
                    <p className="text-xs text-text-secondary">
                      {r.ticketTypeName}
                    </p>
                  </div>
                ),
              },
              {
                key: "status",
                title: "Status",
                render: (r) => (
                  <Badge
                    tone={
                      r.checkInStatus === "used"
                        ? "success"
                        : r.checkInStatus === "cancelled"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {labels[r.checkInStatus]}
                  </Badge>
                ),
              },
              {
                key: "time",
                title: "Waktu check-in",
                render: (r) =>
                  r.checkedInAt
                    ? formatDateTimeCompact(r.checkedInAt)
                    : "Belum check-in",
              },
            ]}
            mobile={(r) => (
              <div className="space-y-2">
                <p className="font-bold">{r.attendeeName}</p>
                <p className="text-xs text-text-secondary">
                  {r.ticketCode} · {r.ticketTypeName}
                </p>
                <Badge
                  tone={r.checkInStatus === "used" ? "success" : "neutral"}
                >
                  {labels[r.checkInStatus]}
                </Badge>
                {r.checkedInAt && (
                  <p className="text-xs">
                    {formatDateTimeCompact(r.checkedInAt)}
                  </p>
                )}
              </div>
            )}
          />
          <ListPagination
            page={page}
            total={attendees.data.meta.total}
            limit={attendees.data.meta.limit}
            onChange={setPage}
            disabled={attendees.isFetching}
          />
        </>
      )}
    </section>
  );
}
