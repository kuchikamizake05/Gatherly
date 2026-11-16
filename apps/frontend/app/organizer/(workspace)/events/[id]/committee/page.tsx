"use client";

import { useParams } from "next/navigation";
import { RouteStub } from "@/components/elements/RouteStub";
import { useEventCommittee } from "@/modules/organizer-events/hooks";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const data = useEventCommittee(id);
  return <RouteStub title="Panitia" band="17" scenario="F. Menugaskan panitia" queries={{ data: data }} />;
}
