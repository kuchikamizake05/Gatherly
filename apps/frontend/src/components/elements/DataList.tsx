import type { ReactNode } from "react";
import { StateView } from "@/components/elements/StateView";
import { Skeleton } from "@/components/ui/skeleton";

// Workspace tables become compact mobile rows, design bands 15, 17 and 18.
export type DataColumn<T> = {
  key: string;
  title: string;
  render: (row: T) => ReactNode;
  numeric?: boolean;
};
export function DataList<T>({
  rows,
  columns,
  rowKey,
  mobile,
  loading,
  emptyTitle = "Tidak ada data yang cocok",
  emptyAction,
}: {
  rows: T[];
  columns: DataColumn<T>[];
  rowKey: (row: T) => string;
  mobile: (row: T) => ReactNode;
  loading?: boolean;
  emptyTitle?: string;
  emptyAction?: ReactNode;
}) {
  if (loading)
    return (
      <div
        aria-label="Memuat daftar"
        aria-busy="true"
        className="space-y-4 py-5"
      >
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  if (!rows.length)
    return (
      <StateView
        layout="section"
        illustration="no-results"
        title={emptyTitle}
        action={emptyAction}
      />
    );
  return (
    <>
      <div className="divide-y divide-border md:hidden">
        {rows.map((row) => (
          <div key={rowKey(row)} className="py-4">
            {mobile(row)}
          </div>
        ))}
      </div>
      <table className="hidden w-full table-fixed text-left text-sm md:table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`border-b border-border py-3 pr-4 font-semibold text-text-secondary ${col.numeric ? "text-right" : ""}`}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-border last:border-0"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`break-words py-4 pr-4 align-middle ${col.numeric ? "text-right tabular-nums" : ""}`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
