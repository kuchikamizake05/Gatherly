import type { ReactNode } from "react";

/**
 * Penanda halaman yang belum dibangun. Ganti seluruh isi halaman dengan UI sesuai desain.
 * Menampilkan judul, rujukan pita desain, issue backend, dan data yang sudah tersambung,
 * supaya yang mengerjakan tahu data apa yang tersedia.
 */
type QueryLike = { status: string; data?: unknown; error?: unknown };

type RouteStubProps = {
  title: string;
  /** Nomor pita di design/canvas-structure.md, misalnya "04". */
  band: string;
  /** Skenario di pita, misalnya "A. Layar utama". */
  scenario?: string;
  /** Issue backend bila endpoint masih memakai mock. */
  pendingIssue?: string;
  /** Data dari Server Component. */
  data?: Record<string, unknown>;
  /** Hasil hook TanStack Query dari Client Component. */
  queries?: Record<string, QueryLike>;
  children?: ReactNode;
};

export function RouteStub({ title, band, scenario, pendingIssue, data, queries, children }: RouteStubProps) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-8 md:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-[26px] leading-tight font-extrabold tracking-tight md:text-[32px]">{title}</h1>
        <p className="text-[15px] text-text-secondary">
          Halaman ini masih kerangka. Bangun UI sesuai pita {band}
          {scenario ? ` (${scenario})` : ""} di file desain, lalu hapus penanda ini.
          {pendingIssue ? ` Data masih contoh sampai ${pendingIssue} selesai.` : ""}
        </p>
      </header>

      {children}

      {queries &&
        Object.entries(queries).map(([name, q]) => (
          <details key={name} className="rounded-lg border border-border bg-surface p-4">
            <summary className="text-sm font-bold">
              {name} <span className="font-medium text-text-tertiary">({q.status})</span>
            </summary>
            <pre className="mt-3 max-h-96 overflow-auto text-xs leading-relaxed text-text-secondary">
              {JSON.stringify(q.error ? String(q.error) : q.data, null, 2)}
            </pre>
          </details>
        ))}

      {data &&
        Object.entries(data).map(([name, value]) => (
          <details key={name} className="rounded-lg border border-border bg-surface p-4">
            <summary className="text-sm font-bold">{name}</summary>
            <pre className="mt-3 max-h-96 overflow-auto text-xs leading-relaxed text-text-secondary">
              {JSON.stringify(value, null, 2)}
            </pre>
          </details>
        ))}
    </section>
  );
}
