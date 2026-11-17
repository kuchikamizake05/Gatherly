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

/** Kolom tindakan (key "action" atau "actions") rata kanan dan diberi jarak dari kolom sebelumnya. */
const isAction = (key: string) => key === "action" || key === "actions";
/**
 * Kolom terakhir selalu rata kanan supaya tabel seimbang (tidak ada ruang kosong di kanan),
 * termasuk bila isinya badge. Kolom angka juga rata kanan.
 */
const align = (key: string, numeric?: boolean, last?: boolean) =>
  isAction(key)
    ? "w-64 pl-6 pr-0 text-right whitespace-nowrap [&>*]:ml-auto"
    : last
      ? "pl-6 pr-0 text-right [&>*]:ml-auto"
      : `pr-6 ${numeric ? "text-right" : ""}`;
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
            {columns.map((col, i) => (
              <th
                key={col.key}
                scope="col"
                className={`border-b border-border py-3 font-semibold text-text-secondary ${align(col.key, col.numeric, i === columns.length - 1)}`}
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
              {columns.map((col, i) => (
                <td
                  key={col.key}
                  className={`break-words py-4 align-middle ${align(col.key, col.numeric, i === columns.length - 1)} ${col.numeric ? "tabular-nums" : ""}`}
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
