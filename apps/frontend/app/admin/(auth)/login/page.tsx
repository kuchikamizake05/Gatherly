"use client";

import { RouteStub } from "@/components/elements/route-stub";
import { useAdminLogin } from "@/modules/admin/hooks";

export default function Page() {
  const login = useAdminLogin();
  return <RouteStub title="Masuk ke admin Gatherly" band="20" scenario="A1. Email dan password" pendingIssue="B30" queries={{ login: { status: login.status, data: login.data } }} />;
}
