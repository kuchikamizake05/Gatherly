"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RouteStub } from "@/components/elements/route-stub";
import { useEvents } from "@/modules/events/hooks";

function PageContent() {
  const search = useSearchParams();
  const events = useEvents({
    q: search.get("q") ?? undefined,
    category: search.get("category") ?? undefined,
    minPrice: search.get("minPrice") ? Number(search.get("minPrice")) : undefined,
    maxPrice: search.get("maxPrice") ? Number(search.get("maxPrice")) : undefined,
  });
  return <RouteStub title="Hasil pencarian" band="03" scenario="B sampai D. Cari, filter, kategori" pendingIssue="#3 B10" queries={{ events: events }} />;
}

/** useSearchParams wajib dibungkus Suspense. */
export default function Page() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
}
