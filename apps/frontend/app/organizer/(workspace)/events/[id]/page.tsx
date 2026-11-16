"use client";

import { useParams } from "next/navigation";
import { RouteStub } from "@/components/elements/route-stub";
import { useOrgEventSummary } from "@/modules/organizer-events/hooks";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const data = useOrgEventSummary(id);
  return <RouteStub title="Ringkasan acara" band="17" scenario="A. Ringkasan" queries={{ data: data }} />;
}
