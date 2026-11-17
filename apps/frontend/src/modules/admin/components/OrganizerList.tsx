"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StateView } from "@/components/elements/StateView";
import { useAdminOrganizers } from "@/modules/admin/hooks";
import type { OrganizerTab } from "@/modules/admin/api";
import { formatRupiah } from "@/lib/format";
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

const tabs = [
  { value: "active", label: "Aktif" },
  { value: "never_logged_in", label: "Belum pernah masuk" },
  { value: "frozen", label: "Dibekukan" },
] as const;
export function OrganizerList() {
  const [tab, setTab] = useState<OrganizerTab>("active");
  const [search, setSearch] = useState("");
  const query = useAdminOrganizers({ tab, q: search });
  if (!query.data || query.isPending || query.isError)
    return <AdminQueryState query={query} label="Organizer" />;
  const rows = query.data.data.filter(
    (row) =>
      row.status === tab &&
      `${row.name} ${row.username}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <AdminOnline query={query} label="Organizer">
      <AdminPage
        title="Daftar organizer"
        description="Kelola organizer yang sudah disetujui."
      >
        <AdminTabs
          value={tab}
          onChange={setTab}
          items={tabs}
          counts={query.data.counts}
        />
        <AdminCard>
          <label className="mb-5 block md:max-w-md">
            <span className="sr-only">Cari organizer</span>
            <IconInput
              type="search"
              leading={<Search aria-hidden />}
              placeholder="Cari nama organizer atau username"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {query.isPlaceholderData ? (
            <AdminListSkeleton label="Organizer" />
          ) : rows.length ? (
            <AdminQueue
              columns={[
                { label: "Organizer" },
                { label: "Acara aktif" },
                { label: "Penjualan kotor", className: "hidden xl:table-cell" },
                { label: "Tindakan", className: "w-32" },
              ]}
              rows={rows.map((row) => {
                const action = (
                  <Button variant="outline" asChild>
                    <Link
                      href={`/organizers/${row.id}`}
                      aria-label={`Lihat ${row.name}`}
                    >
                      Lihat detail
                    </Link>
                  </Button>
                );
                return {
                  id: row.id,
                  cells: [
                    <div key="name">
                      <strong className="block">{row.name}</strong>
                      <span className="text-xs text-text-secondary">
                        @{row.username}
                      </span>
                    </div>,
                    `${row.activeEvents} acara`,
                    formatRupiah(row.grossSales),
                    action,
                  ],
                  title: row.name,
                  status: (
                    <Badge>
                      {tabs.find((item) => item.value === row.status)?.label}
                    </Badge>
                  ),
                  meta: `@${row.username}, ${row.activeEvents} acara aktif, ${formatRupiah(row.grossSales)}`,
                  action,
                };
              })}
            />
          ) : (
            <StateView
              layout="section"
              illustration="no-results"
              title="Tidak ada organizer"
              description="Organizer yang cocok akan ditampilkan di sini."
            />
          )}
        </AdminCard>
      </AdminPage>
    </AdminOnline>
  );
}
