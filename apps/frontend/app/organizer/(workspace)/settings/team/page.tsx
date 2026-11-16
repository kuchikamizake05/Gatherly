"use client";

import { RouteStub } from "@/components/elements/RouteStub";
import { useTeam } from "@/modules/team/hooks";

export default function Page() {
  const team = useTeam();
  return <RouteStub title="Tim" band="18" pendingIssue="B28" queries={{ team: team }} />;
}
