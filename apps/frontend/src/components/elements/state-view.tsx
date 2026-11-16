import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Illustration, type IllustrationName } from "@/components/elements/illustration";

/**
 * Satu komponen untuk semua keadaan selain konten normal: kosong, tidak ditemukan,
 * gagal dimuat, kedaluwarsa, berhasil, dan seterusnya. Sesuai komponen "Empty state" di pita 02.
 *
 * Selalu memenuhi lebar dan tinggi ruang yang tersedia.
 * - layout="page"      memenuhi area konten di bawah navbar/topbar, isi di tengah.
 *                      Di mobile tombol aksi menempel di bawah layar.
 * - layout="screen"    memenuhi seluruh layar (tanpa shell), misalnya 404 global.
 * - layout="section"   memenuhi lebar kartu atau bagian, dengan jarak dalam.
 *
 * Hanya satu aksi. Jangan taruh tombol yang sama di tempat lain di halaman.
 *
 * <StateView
 *   illustration="failed-load"
 *   title="Halaman gagal dimuat"
 *   description="Periksa koneksi Anda lalu coba lagi."
 *   action={<Button onClick={reset}>Coba lagi</Button>}
 * />
 */
type StateViewProps = {
  illustration?: IllustrationName;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  layout?: "page" | "screen" | "section";
  className?: string;
  /** role="alert" untuk keadaan gagal supaya dibacakan pembaca layar. */
  tone?: "neutral" | "error";
};

export function StateView({
  illustration,
  title,
  description,
  action,
  layout = "page",
  className,
  tone = "neutral",
}: StateViewProps) {
  const body = (
    <>
      {illustration && <Illustration name={illustration} className={layout === "section" ? "w-[160px] md:w-[200px]" : undefined} />}
      <div className="flex w-full max-w-[420px] flex-col items-center gap-2">
        <h2 className="text-xl leading-tight font-extrabold text-foreground text-balance">{title}</h2>
        {description && <p className="text-[15px] leading-relaxed text-text-secondary text-pretty">{description}</p>}
      </div>
    </>
  );

  if (layout === "section") {
    return (
      <div
        role={tone === "error" ? "alert" : undefined}
        className={cn("flex w-full flex-col items-center gap-3.5 px-5 pt-8 pb-10 text-center md:px-8 md:py-12", className)}
      >
        {body}
        {action && <div className="mt-2 flex w-full justify-center [&>*]:w-full md:[&>*]:w-auto">{action}</div>}
      </div>
    );
  }

  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex w-full flex-1 flex-col px-4 text-center md:px-8",
        layout === "screen" ? "min-h-dvh" : "min-h-full",
        className,
      )}
    >
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-3.5 py-12">
        {body}
        {action && <div className="mt-2 hidden md:flex">{action}</div>}
      </div>
      {action && (
        <div className="sticky bottom-[var(--bottom-bar,0px)] w-full bg-background pt-3 pb-[max(16px,env(safe-area-inset-bottom))] md:hidden [&>*]:w-full">
          {action}
        </div>
      )}
    </div>
  );
}
