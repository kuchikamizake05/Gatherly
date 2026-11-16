"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RouteStub } from "@/components/elements/route-stub";
import { useAdminPayouts } from "@/modules/admin/hooks";

function PageContent() {
  const search = useSearchParams();
  const list = useAdminPayouts({ tab: search.get("tab") === "transferred" ? "transferred" : "requested" });
  return <RouteStub title="Pencairan dana" band="24" scenario="A. Memproses pencairan" pendingIssue="B39" queries={{ list: list }} />;
}

/** useSearchParams wajib dibungkus Suspense. */
export default function Page() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
}
