"use client";

import { useParams } from "next/navigation";
import { RouteStub } from "@/components/elements/RouteStub";
import { useAdminReport } from "@/modules/admin/hooks";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const report = useAdminReport(id);
  return <RouteStub title="Detail laporan" band="24" scenario="B2 dan B3. Tutup laporan atau bekukan organizer" pendingIssue="B40" queries={{ report: report }} />;
}
