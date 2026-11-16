"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { StateView } from "@/components/elements/StateView";

/** Keadaan halaman detail acara. Pita 04 baris H. */

export function EventNotFound() {
  return (
    <StateView
      illustration="not-found"
      title="Acara tidak ditemukan"
      description="Tautan mungkin salah atau acara sudah dihapus penyelenggara."
      action={
        <Button asChild>
          <Link href="/">Jelajahi acara</Link>
        </Button>
      }
    />
  );
}

export function EventLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <StateView
      tone="error"
      illustration="failed-load"
      title="Detail acara gagal dimuat"
      description="Periksa koneksi internet Anda, lalu coba lagi."
      action={<Button onClick={onRetry}>Coba lagi</Button>}
    />
  );
}

export function EventDetailSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-14 md:px-6 md:pt-14 xl:grid-cols-[minmax(0,1fr)_420px] xl:px-10" aria-busy>
      <div className="flex flex-col gap-6">
        <span className="skeleton h-[420px] w-full md:h-[480px] md:rounded-[28px]" />
        <div className="flex flex-col gap-3 px-5 md:px-0">
          <span className="skeleton h-7 w-40 rounded-full" />
          <span className="skeleton h-10 w-4/5 rounded" />
          <span className="skeleton h-11 w-60 rounded" />
          <div className="grid gap-4 pt-4 md:grid-cols-2">
            <span className="skeleton h-[84px] rounded-lg" />
            <span className="skeleton h-[84px] rounded-lg" />
          </div>
        </div>
      </div>
      <span className="skeleton hidden h-[560px] rounded-xl xl:block" />
    </div>
  );
}
