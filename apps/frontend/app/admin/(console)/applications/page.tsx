"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RouteStub } from "@/components/elements/route-stub";
import { useApplications } from "@/modules/admin/hooks";
import type { ApplicationTab } from "@/modules/admin/api";

function PageContent() {
  const search = useSearchParams();
  const list = useApplications({ tab: (search.get("tab") as ApplicationTab) ?? "new", q: search.get("q") ?? undefined });
  return <RouteStub title="Pengajuan organizer" band="21" scenario="A1. Daftar pengajuan" pendingIssue="B31" queries={{ list: list }} />;
}

/** useSearchParams wajib dibungkus Suspense. */
export default function Page() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
}
