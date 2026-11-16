"use client";

import { RouteStub } from "@/components/elements/route-stub";
import { useChangeTemporaryPassword } from "@/modules/organizer-auth/hooks";

export default function Page() {
  const change = useChangeTemporaryPassword();
  return <RouteStub title="Ganti password sementara" band="14" scenario="B. Masuk pertama kali" pendingIssue="B28" queries={{ change: { status: change.status } }} />;
}
