"use client";
import { useState } from "react";
import Link from "next/link";
import { useAdminReports } from "@/modules/admin/hooks";
import { StateView } from "@/components/elements/StateView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeCompact } from "@/lib/format";
import {
  AdminCard,
  AdminPage,
  AdminQueryState,
  AdminTabs,
  AdminOnline,
  AdminQueue,
  reportReasons,
} from "./AdminPage";

const tabs = [
  { value: "new", label: "Baru" },
  { value: "done", label: "Selesai" },
] as const;
export function ReportList() {
  const [tab, setTab] = useState<"new" | "done">("new");
  const query = useAdminReports({ tab });
  if (!query.data || query.isPending || query.isError)
    return <AdminQueryState query={query} label="Laporan" />;
  const rows = query.data.data.filter((row) => row.status === tab);
  return (
    <AdminOnline query={query} label="Laporan">
      <AdminPage
        title="Laporan acara"
        description="Tinjau laporan peserta dan ambil tindakan yang diperlukan."
      >
        <AdminTabs
          value={tab}
          onChange={setTab}
          items={tabs}
          counts={query.data.counts}
        />
        <AdminCard>
          {rows.length ? (
            <AdminQueue
              columns={[
                { label: "Acara" },
                { label: "Alasan" },
                { label: "Masuk", className: "hidden xl:table-cell" },
                { label: "Tindakan", className: "w-24" },
              ]}
              rows={rows.map((row) => {
                const action = (
                  <Button variant="outline" asChild>
                    <Link
                      href={`/reports/${row.id}`}
                      aria-label={`Tinjau laporan ${row.eventTitle}`}
                    >
                      Tinjau
                    </Link>
                  </Button>
                );
                return {
                  id: row.id,
                  cells: [
                    <div key="name">
                      <strong className="block">{row.eventTitle}</strong>
                      <span className="text-xs text-text-secondary">
                        {row.organizerName}
                      </span>
                    </div>,
                    reportReasons[row.reason],
                    formatDateTimeCompact(row.createdAt),
                    action,
                  ],
                  title: row.eventTitle,
                  status: (
                    <Badge>{row.status === "new" ? "Baru" : "Selesai"}</Badge>
                  ),
                  meta: `${reportReasons[row.reason]}, ${row.organizerName}, ${formatDateTimeCompact(row.createdAt)}`,
                  action,
                };
              })}
            />
          ) : (
            <StateView
              layout="section"
              illustration="no-results"
              title="Belum ada laporan"
              description="Laporan dengan status ini akan muncul di sini."
            />
          )}
        </AdminCard>
      </AdminPage>
    </AdminOnline>
  );
}
