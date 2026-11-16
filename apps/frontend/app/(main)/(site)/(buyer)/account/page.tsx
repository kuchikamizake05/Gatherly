"use client";

import { RouteStub } from "@/components/elements/RouteStub";
import { useAccount } from "@/modules/account/hooks";

export default function Page() {
  const account = useAccount();
  return <RouteStub title="Akun saya" band="12" pendingIssue="B36" queries={{ account: account }} />;
}
