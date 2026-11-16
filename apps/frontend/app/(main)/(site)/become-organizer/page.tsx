"use client";

import { RouteStub } from "@/components/elements/route-stub";
import { useSubmitApplication } from "@/modules/applications/hooks";

export default function Page() {
  const submit = useSubmitApplication();
  return <RouteStub title="Pengajuan organizer" band="13" scenario="A dan B. Daftar baru" pendingIssue="B29" queries={{ submit: { status: submit.status, data: submit.data } }} />;
}
