"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RouteStub } from "@/components/elements/route-stub";
import { useResetPassword } from "@/modules/auth/hooks";

function PageContent() {
  const search = useSearchParams();
  // ?token=... dari email, berlaku 30 menit
  const reset = useResetPassword();
  void search;
  return <RouteStub title="Buat password baru" band="11" pendingIssue="B36" queries={{ reset: { status: reset.status } }} />;
}

/** useSearchParams wajib dibungkus Suspense. */
export default function Page() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
}
