"use client";

import { useParams } from "next/navigation";
import { RouteStub } from "@/components/elements/RouteStub";
import { useOrgEventOrders } from "@/modules/organizer-events/hooks";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const data = useOrgEventOrders(id);
  return <RouteStub title="Pesanan" band="17" scenario="B dan C. Pesanan dan pengembalian dana" queries={{ data: data }} />;
}
