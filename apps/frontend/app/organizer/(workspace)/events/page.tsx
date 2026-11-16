"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RouteStub } from "@/components/elements/route-stub";
import { useOrgEvents } from "@/modules/organizer-events/hooks";

function PageContent() {
  const search = useSearchParams();
  const events = useOrgEvents(search.get("status") ?? undefined);
  return <RouteStub title="Acara" band="15" scenario="C. Tabel acara (Berjalan, Draf, Selesai)" queries={{ events: events }} />;
}

/** useSearchParams wajib dibungkus Suspense. */
export default function Page() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
}
