"use client";

import { RouteStub } from "@/components/elements/route-stub";
import { useSavedEvents } from "@/modules/events/hooks";

export default function Page() {
  const saved = useSavedEvents();
  return <RouteStub title="Disimpan" band="08" pendingIssue="B37" queries={{ saved: saved }} />;
}
