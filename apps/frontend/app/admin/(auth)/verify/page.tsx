"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RouteStub } from "@/components/elements/route-stub";
import { useAdminVerifyTotp } from "@/modules/admin/hooks";

function PageContent() {
  const search = useSearchParams();
  const verify = useAdminVerifyTotp();
  void search;
  return <RouteStub title="Verifikasi dua langkah" band="20" scenario="A2. Kode autentikator" pendingIssue="B30" queries={{ verify: { status: verify.status } }} />;
}

/** useSearchParams wajib dibungkus Suspense. */
export default function Page() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
}
