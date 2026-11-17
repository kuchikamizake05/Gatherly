"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { StateView } from "@/components/elements/StateView";
import { useApplications } from "@/modules/admin/hooks";
import type { ApplicationTab, ApplicationRow } from "@/modules/admin/api";
import { formatDateTimeCompact } from "@/lib/format";
import {
  AdminCard,
  AdminPage,
  AdminQueryState,
  AdminTabs,
  AdminOnline,
  AdminQueue,
  AdminListSkeleton,
} from "./AdminPage";
import { IconInput } from "@/components/elements/IconInput";
import { Search } from "lucide-react";
import { ORGANIZER_TYPES } from "@/modules/applications/api";

/** Backend mengirim kode ("organisasi_kampus"), data contoh memakai label. Keduanya jadi label. */
const typeLabel = (type: string) =>
  ORGANIZER_TYPES.find(
    (option) => option.value === type || option.label === type,
  )?.label ?? type;

const tabs = [
  { value: "new", label: "Perlu ditinjau" },
  { value: "needs_fix", label: "Menunggu perbaikan" },
  { value: "approved", label: "Disetujui" },
  { value: "rejected", label: "Ditolak" },
] as const;
const statusBadge = (row: ApplicationRow) => (
  <Badge
    tone={
      row.status === "new" || row.status === "fix_submitted"
        ? "info"
        : row.status === "needs_fix"
          ? "warning"
          : row.status === "rejected"
            ? "danger"
            : "success"
    }
  >
    {row.status === "fix_submitted"
      ? "Perbaikan masuk"
      : row.status === "new"
        ? "Baru"
        : tabs.find((item) => item.value === row.status)?.label}
  </Badge>
);

export function ApplicationList() {
  const [tab, setTab] = useState<ApplicationTab>("new");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const query = useApplications({
    tab,
    q: search,
    // Filter memakai label, backend menerima kode jenis.
    type:
      type === "all"
        ? ""
        : (ORGANIZER_TYPES.find((option) => option.label === type)?.value ??
          type),
  });
  if (!query.data || query.isError || query.isPending)
    return <AdminQueryState query={query} label="Pengajuan" />;
  const rows = query.data.data.filter(
    (row) =>
      (tab === "new"
        ? ["new", "fix_submitted"].includes(row.status)
        : row.status === tab) &&
      (type === "all" || typeLabel(row.type) === type) &&
      `${row.organizerName} ${row.number}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function downloadCsv() {
    const csv = [
      ["Nomor", "Penyelenggara", "Jenis", "Masuk", "Status"],
      ...rows.map((row) => [
        row.number,
        row.organizerName,
        typeLabel(row.type),
        row.submittedAt,
        row.status,
      ]),
    ]
      .map((row) =>
        row
          .map(
            (value) =>
              `"${/^[=+@-]/.test(value) ? "'" : ""}${value.replaceAll('"', '""')}"`,
          )
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "pengajuan-organizer.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <AdminOnline query={query} label="Pengajuan">
      <AdminPage
        title="Pengajuan organizer"
        description="Tinjau pengajuan paling lambat 1 hari kerja sejak masuk."
      >
        <AdminTabs
          value={tab}
          onChange={setTab}
          items={tabs}
          counts={query.data.counts}
        />
        <AdminCard>
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
            <label className="min-w-0 flex-1 md:max-w-md">
              <span className="sr-only">Cari pengajuan</span>
              <IconInput
                type="search"
                leading={<Search aria-hidden />}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari nama organizer atau nomor pengajuan"
              />
            </label>
            <div>
              <label htmlFor="application-type" className="sr-only">
                Jenis organizer
              </label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="application-type" className="w-full md:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua jenis</SelectItem>
                  {ORGANIZER_TYPES.map(({ label }) => (
                    <SelectItem key={label} value={label}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={downloadCsv}>
              Unduh CSV
            </Button>
          </div>
          {query.isPlaceholderData ? (
            <AdminListSkeleton label="Pengajuan" />
          ) : rows.length ? (
            <AdminQueue
              columns={[
                { label: "Nomor", className: "hidden xl:table-cell" },
                { label: "Penyelenggara" },
                { label: "Jenis", className: "hidden xl:table-cell" },
                { label: "Masuk" },
                { label: "Status" },
                { label: "Tindakan", className: "w-24" },
              ]}
              rows={rows.map((row) => {
                const action = (
                  <Button variant="outline" asChild>
                    <Link
                      href={`/applications/${row.id}`}
                      aria-label={`Tinjau pengajuan ${row.organizerName}`}
                    >
                      Tinjau
                    </Link>
                  </Button>
                );
                return {
                  id: row.id,
                  cells: [
                    <strong key="number" className="text-xs">
                      {row.number}
                    </strong>,
                    <strong key="name">{row.organizerName}</strong>,
                    typeLabel(row.type),
                    formatDateTimeCompact(row.submittedAt),
                    statusBadge(row),
                    action,
                  ],
                  title: row.organizerName,
                  number: row.number,
                  status: statusBadge(row),
                  meta: `${typeLabel(row.type)}, masuk ${formatDateTimeCompact(row.submittedAt)}`,
                  action,
                };
              })}
            />
          ) : (
            <StateView
              layout="section"
              illustration="no-results"
              title={
                search || type !== "all"
                  ? "Tidak ada hasil"
                  : "Belum ada pengajuan"
              }
              description="Pengajuan yang sesuai akan muncul di sini."
            />
          )}
        </AdminCard>
      </AdminPage>
    </AdminOnline>
  );
}
