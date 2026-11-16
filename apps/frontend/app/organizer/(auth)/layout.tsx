import Image from "next/image";
import type { ReactNode } from "react";

/** Masuk organizer dan panitia. Pita 14. */
export default function OrganizerAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh xl:grid-cols-2">
      <div className="flex flex-col px-4 py-6 md:px-12">
        <span className="flex items-center gap-2">
          <Image src="/gatherly-horizontal-ink.svg" alt="Gatherly" width={120} height={30} priority />
          <span className="rounded-sm bg-inverse px-2 py-0.5 text-xs font-extrabold text-inverse-foreground">organizer</span>
        </span>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">{children}</div>
      </div>
      <div className="hidden bg-inverse xl:block" aria-hidden />
    </div>
  );
}
