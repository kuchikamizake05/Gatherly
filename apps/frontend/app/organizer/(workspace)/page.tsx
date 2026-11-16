"use client";

import { RouteStub } from "@/components/elements/route-stub";
import { useWorkspaceMe } from "@/modules/organizer-auth/hooks";
import { useOrgSummary, useOrgEvents } from "@/modules/organizer-events/hooks";
import { useAssignedEvents } from "@/modules/check-in/hooks";

export default function Page() {
  // Organizer melihat dashboard (pita 15). Panitia melihat daftar acara ditugaskan (pita 14 C).
  const me = useWorkspaceMe();
  const summary = useOrgSummary("30d");
  const events = useOrgEvents();
  const assigned = useAssignedEvents();
  return <RouteStub title="Dashboard" band="15" queries={{ me: me, summary: summary, events: events, assigned: assigned }} />;
}
