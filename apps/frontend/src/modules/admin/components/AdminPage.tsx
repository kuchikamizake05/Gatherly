"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import { useOnline } from "@/hooks/use-online";
import { StateView, fillState } from "@/components/elements/StateView";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export function AdminPage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 w-full flex-1 flex-col gap-6 p-4 md:p-8">
      <header>
        <h1 className="text-[28px] font-extrabold">{title}</h1>
        {description && (
          <p className="mt-2 text-sm text-text-secondary">{description}</p>
        )}
      </header>
      {children}
    </div>
  );
}

export function AdminQueryState({
  query,
  label,
  back,
}: {
  query: {
    isPending: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => unknown;
  };
  label: string;
  back?: string;
}) {
  const online = useOnline();
  const [showLoading, setShowLoading] = useState(false);
  useEffect(() => {
    if (!query.isPending) {
      setShowLoading(false);
      return;
    }
    const timer = setTimeout(() => setShowLoading(true), 300);
    return () => clearTimeout(timer);
  }, [query.isPending]);
  if (!online)
    return (
      <StateView
        illustration="failed-load"
        title="Anda sedang luring"
        description="Periksa koneksi Anda lalu coba lagi."
        action={<Button onClick={() => query.refetch()}>Coba lagi</Button>}
      />
    );
  if (query.isPending && !showLoading)
    return <div className="flex w-full flex-1" aria-busy="true" />;
  if (query.isPending)
    return (
      <div
        role="status"
        className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8"
      >
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-72 w-full" />
        <span className="sr-only">Memuat {label.toLowerCase()}</span>
      </div>
    );
  if (query.isError) {
    const missing =
      query.error instanceof ApiError && query.error.status === 404;
    return (
      <StateView
        illustration={missing ? "not-found" : "failed-load"}
        title={`${label} ${missing ? "tidak ditemukan" : "gagal dimuat"}`}
        description={
          missing
            ? "Data mungkin sudah dihapus atau tautannya tidak sesuai."
            : "Periksa koneksi Anda lalu coba lagi."
        }
        tone="error"
        action={
          missing && back ? (
            <Button asChild>
              <Link href={back}>Kembali ke daftar</Link>
            </Button>
          ) : (
            <Button onClick={() => query.refetch()}>Coba lagi</Button>
          )
        }
      />
    );
  }
  return null;
}

export function AdminTabs<T extends string>({
  value,
  onChange,
  items,
  counts,
}: {
  value: T;
  onChange: (value: T) => void;
  items: readonly { value: T; label: string }[];
  counts: Partial<Record<T, number>>;
}) {
  return (
    <Tabs value={value} onValueChange={(value) => onChange(value as T)}>
      <TabsList aria-label="Status">
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            count={counts[item.value]}
          >
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function AdminCard({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-xl border border-border bg-background p-5 md:p-6",
        fillState,
      )}
    >
      {title && <h2 className="mb-5 text-lg font-extrabold">{title}</h2>}
      {children}
    </section>
  );
}

export function AdminOnline({
  query,
  label,
  children,
}: {
  query: Parameters<typeof AdminQueryState>[0]["query"];
  label: string;
  children: ReactNode;
}) {
  const online = useOnline();
  return online ? children : <AdminQueryState query={query} label={label} />;
}

export const reportReasons: Record<string, string> = {
  fraud: "Dugaan penipuan",
  wrong_info: "Informasi tidak sesuai",
  inappropriate: "Konten tidak pantas",
  other: "Lainnya",
};

export function publicHref(path: string) {
  if (process.env.NEXT_PUBLIC_SITE_URL)
    return `${process.env.NEXT_PUBLIC_SITE_URL}${path}`;
  if (typeof window === "undefined") return path;
  const url = new URL(window.location.origin);
  url.hostname = url.hostname.replace(/^admin\./, "");
  return `${url.origin}${path}`;
}

type QueueRow = {
  id: string;
  cells: ReactNode[];
  title: ReactNode;
  status?: ReactNode;
  number?: string;
  meta: ReactNode;
  action: ReactNode;
};
export function AdminQueue({
  columns,
  rows,
}: {
  columns: { label: string; className?: string }[];
  rows: QueueRow[];
}) {
  return (
    <>
      <div className="hidden md:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              {columns.map((column, index) => (
                <TableHead
                  key={index}
                  className={`whitespace-normal text-xs text-text-secondary ${column.className ?? ""}`}
                >
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {row.cells.map((cell, index) => (
                  <TableCell
                    key={index}
                    className={`break-words whitespace-normal py-4 text-sm ${columns[index]?.className ?? ""}`}
                  >
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y divide-border md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="py-4 first:pt-0">
            <div className="flex items-start justify-between gap-2">
              {row.number ? (
                <span className="text-[11px] font-semibold text-text-secondary">
                  {row.number}
                </span>
              ) : (
                <div className="min-w-0 break-words text-sm font-bold">
                  {row.title}
                </div>
              )}
              {row.status}
            </div>
            {row.number && (
              <div className="mt-1 break-words text-sm font-bold">
                {row.title}
              </div>
            )}
            <div className="mt-1 text-xs leading-relaxed text-text-secondary">
              {row.meta}
            </div>
            <div className="mt-3 [&>*]:w-full">{row.action}</div>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Kerangka baris selama data tab baru dimuat. Dipakai saat query masih menampilkan data tab
 * sebelumnya (keepPreviousData), supaya tidak sempat muncul state kosong atau data tab lain.
 */
export function AdminListSkeleton({ label }: { label: string }) {
  return (
    <div
      aria-busy="true"
      aria-label={`Memuat ${label.toLowerCase()}`}
      className="space-y-3 py-2"
    >
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
