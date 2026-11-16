"use client";

import { useParams } from "next/navigation";
import { RouteStub } from "@/components/elements/RouteStub";
import { useOrgEvent, useUpdateEvent } from "@/modules/organizer-events/hooks";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const event = useOrgEvent(id);
  const update = useUpdateEvent(id);
  void update;
  return <RouteStub title="Ubah acara" band="16" scenario="D. Mengubah acara terbit" queries={{ event: event }} />;
}
