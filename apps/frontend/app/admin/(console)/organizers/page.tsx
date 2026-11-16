"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RouteStub } from "@/components/elements/route-stub";
import { useAdminOrganizers } from "@/modules/admin/hooks";
import type { OrganizerTab } from "@/modules/admin/api";

function PageContent() {
  const search = useSearchParams();
  const list = useAdminOrganizers({ tab: (search.get("tab") as OrganizerTab) ?? "active", q: search.get("q") ?? undefined });
  return <RouteStub title="Organizer" band="22" scenario="A dan F. Daftar dan pencarian" pendingIssue="B32" queries={{ list: list }} />;
}

/** useSearchParams wajib dibungkus Suspense. */
export default function Page() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
}
