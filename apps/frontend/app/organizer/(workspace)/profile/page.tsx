"use client";

import { RouteStub } from "@/components/elements/RouteStub";
import { useOrgProfile } from "@/modules/organizer-settings/hooks";

export default function Page() {
  const profile = useOrgProfile();
  return <RouteStub title="Profil organizer" band="23" scenario="A. Profil organizer" pendingIssue="B38" queries={{ profile: profile }} />;
}
