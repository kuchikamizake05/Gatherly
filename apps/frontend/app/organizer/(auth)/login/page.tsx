"use client";

import { RouteStub } from "@/components/elements/RouteStub";
import { useWorkspaceLogin } from "@/modules/organizer-auth/hooks";

export default function Page() {
  const login = useWorkspaceLogin();
  return <RouteStub title="Masuk ke ruang organizer" band="14" scenario="A dan C. Organizer dan panitia" pendingIssue="B28" queries={{ login: { status: login.status, data: login.data } }} />;
}
