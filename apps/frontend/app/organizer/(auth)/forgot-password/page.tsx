"use client";

import { RouteStub } from "@/components/elements/route-stub";
import { useWorkspaceForgotPassword } from "@/modules/organizer-auth/hooks";

export default function Page() {
  const forgot = useWorkspaceForgotPassword();
  return <RouteStub title="Lupa password" band="14" scenario="D. Lupa password" pendingIssue="B28" queries={{ forgot: { status: forgot.status, data: forgot.data } }} />;
}
