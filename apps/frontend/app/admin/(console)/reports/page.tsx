"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RouteStub } from "@/components/elements/route-stub";
import { useAdminReports } from "@/modules/admin/hooks";

function PageContent() {
  const search = useSearchParams();
  const list = useAdminReports({ tab: search.get("tab") === "done" ? "done" : "new" });
  return <RouteStub title="Laporan acara" band="24" scenario="B1. Daftar laporan" pendingIssue="B40" queries={{ list: list }} />;
}

/** useSearchParams wajib dibungkus Suspense. */
export default function Page() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
}
