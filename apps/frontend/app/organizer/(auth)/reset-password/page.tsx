"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RouteStub } from "@/components/elements/route-stub";
import { useWorkspaceResetPassword } from "@/modules/organizer-auth/hooks";

function PageContent() {
  const search = useSearchParams();
  const reset = useWorkspaceResetPassword();
  void search;
  return <RouteStub title="Buat password baru" band="14" pendingIssue="B28" queries={{ reset: { status: reset.status } }} />;
}

/** useSearchParams wajib dibungkus Suspense. */
export default function Page() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
}
