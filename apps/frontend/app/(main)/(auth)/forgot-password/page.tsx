"use client";

import { RouteStub } from "@/components/elements/route-stub";
import { useForgotPassword } from "@/modules/auth/hooks";

export default function Page() {
  const forgot = useForgotPassword();
  return <RouteStub title="Lupa password" band="11" pendingIssue="B36" queries={{ forgot: { status: forgot.status } }} />;
}
