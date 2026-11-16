"use client";

import { useParams } from "next/navigation";
import { RouteStub } from "@/components/elements/route-stub";
import { useOrgEventAttendees } from "@/modules/organizer-events/hooks";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const data = useOrgEventAttendees(id);
  return <RouteStub title="Peserta" band="17" scenario="D. Daftar peserta" queries={{ data: data }} />;
}
