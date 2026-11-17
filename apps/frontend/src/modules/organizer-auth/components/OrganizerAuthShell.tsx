import Image from "next/image";
import { Suspense, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/** Masuk organizer dan panitia. Pita 14. */
export function OrganizerAuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh xl:grid-cols-2">
      <div className="flex flex-col px-4 py-6 md:px-12">
        <span className="flex items-center gap-2">
          {/* Simbol + teks, sama dengan navbar, supaya wordmark mudah diganti. */}
          <span className="flex items-center gap-2">
            <Image src="/gatherly-symbol-ink.svg" alt="" width={28} height={28} priority />
            <span className="text-[22px] font-extrabold tracking-tight">
              gatherlyy
            </span>
          </span>
          <span className="rounded-sm bg-inverse px-2 py-0.5 text-xs font-extrabold text-inverse-foreground">
            organizer
          </span>
        </span>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <Suspense
            fallback={
              <div aria-label="Memuat formulir" aria-busy className="space-y-5">
                <Skeleton className="h-12 w-4/5" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            }
          >
            {children}
          </Suspense>
        </div>
      </div>
      <div className="hidden bg-inverse xl:block" aria-hidden />
    </div>
  );
}
