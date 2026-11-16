"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RouteStub } from "@/components/elements/RouteStub";
import { useOpenApplication } from "@/modules/applications/hooks";

function PageContent() {
  const search = useSearchParams();
  // Bisa dibuka dari email dengan ?number=PNG-2609-0042
  const open = useOpenApplication();
  void search;
  return <RouteStub title="Perbaiki pengajuan" band="13" scenario="C. Memperbaiki pengajuan" pendingIssue="B29" queries={{ open: { status: open.status, data: open.data } }} />;
}

/** useSearchParams wajib dibungkus Suspense. */
export default function Page() {
  return (
    <Suspense>
      <PageContent />
    </Suspense>
  );
}
