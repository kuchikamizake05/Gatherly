"use client";

import { useParams } from "next/navigation";
import { RouteStub } from "@/components/elements/route-stub";
import { useOrgEvent } from "@/modules/organizer-events/hooks";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const data = useOrgEvent(id);
  return <RouteStub title="Jenis tiket" band="17" scenario="E. Menghentikan penjualan tiket" queries={{ data: data }} />;
}
