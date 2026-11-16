"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RouteStub } from "@/components/elements/RouteStub";
import { useAdminBackupCode } from "@/modules/admin/hooks";

function PageContent() {
  const search = useSearchParams();
  const verify = useAdminBackupCode();
  void search;
  return <RouteStub title="Kode cadangan" band="20" scenario="B. Memakai kode cadangan" pendingIssue="B30" queries={{ verify: { status: verify.status } }} />;
}

/** useSearchParams wajib dibungkus Suspense. */
export default function Page() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
}
