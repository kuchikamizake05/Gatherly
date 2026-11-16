"use client";

import { useParams } from "next/navigation";
import { RouteStub } from "@/components/elements/route-stub";
import { useApplicationReview } from "@/modules/admin/hooks";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const review = useApplicationReview(id);
  return <RouteStub title="Tinjau pengajuan" band="21" scenario="A sampai F. Setujui, minta perbaikan, tolak" pendingIssue="B31" queries={{ review: review }} />;
}
