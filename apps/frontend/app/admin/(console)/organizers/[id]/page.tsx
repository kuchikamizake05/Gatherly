"use client";

import { useParams } from "next/navigation";
import { RouteStub } from "@/components/elements/RouteStub";
import { useAdminOrganizer } from "@/modules/admin/hooks";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const organizer = useAdminOrganizer(id);
  return <RouteStub title="Detail organizer" band="22" scenario="B sampai E. Detail, bekukan, aktifkan, kirim ulang akses" pendingIssue="B32" queries={{ organizer: organizer }} />;
}
