"use client";

import { RouteStub } from "@/components/elements/route-stub";
import { useChangeOrgPassword } from "@/modules/organizer-settings/hooks";

export default function Page() {
  const change = useChangeOrgPassword();
  return <RouteStub title="Keamanan" band="23" scenario="D. Mengubah password" pendingIssue="B38" queries={{ change: { status: change.status } }} />;
}
