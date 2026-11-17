import Image from "next/image";
import type { ReactNode } from "react";

const posters = [
  {
    src: "photo-1597849457406-442b94770a95",
    className: "left-[60px] top-[120px] h-[280px] w-[210px] rotate-[-8deg]",
  },
  {
    src: "photo-1777898160741-64eac6fe6627",
    className: "left-[300px] top-[70px] h-[300px] w-[230px] rotate-[6deg]",
  },
  {
    src: "photo-1781876780729-37760c303520",
    className: "left-[150px] top-[430px] h-[300px] w-[240px] rotate-[4deg]",
  },
  {
    src: "photo-1719299246410-df8d0f0845ee",
    className: "left-[400px] top-[470px] h-[260px] w-[200px] rotate-[-6deg]",
  },
];

/** Masuk admin, pita 20. Poster dan tata letak mengikuti frame desktop Pen. */
export function AdminAuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">
      <div className="flex min-w-0 flex-1 flex-col px-5 py-6 md:px-12 md:py-10 xl:px-20">
        <div className="flex items-center gap-2">
          <Image
            src="/gatherly-horizontal-ink.svg"
            alt="Gatherlyy"
            width={120}
            height={30}
            priority
          />
          <span className="rounded-sm bg-inverse px-2 py-0.5 text-xs font-bold text-inverse-foreground">
            admin
          </span>
        </div>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10">
          {children}
        </div>
      </div>
      <aside
        className="relative hidden min-h-[900px] w-[640px] shrink-0 overflow-hidden bg-inverse text-inverse-foreground xl:block"
        aria-hidden="true"
      >
        {posters.map((poster) => (
          <div
            key={poster.src}
            className={`absolute overflow-hidden rounded-3xl ${poster.className}`}
          >
            <Image
              src={`https://images.unsplash.com/${poster.src}?auto=format&fit=crop&w=640&q=80`}
              alt=""
              fill
              sizes="240px"
              className="object-cover"
            />
          </div>
        ))}
        <div className="absolute bottom-20 left-12 right-12">
          <p className="text-3xl font-extrabold tracking-tight">
            Pusat kendali tim Gatherlyy.
          </p>
          <p className="mt-2 text-base text-inverse-foreground/70">
            Tinjau pengajuan organizer, kelola akun, dan jaga kualitas acara.
          </p>
        </div>
      </aside>
    </div>
  );
}
