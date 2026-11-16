"use client";

import { useParams } from "next/navigation";
import { RouteStub } from "@/components/elements/RouteStub";
import { useScanHistory } from "@/modules/check-in/hooks";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const history = useScanHistory(id);
  return <RouteStub title="Riwayat pemindaian" band="19" scenario="E. Riwayat pemindaian" queries={{ history: history }} />;
}
