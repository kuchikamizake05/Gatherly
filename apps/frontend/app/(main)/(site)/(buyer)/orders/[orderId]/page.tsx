"use client";

import { useParams } from "next/navigation";
import { RouteStub } from "@/components/elements/route-stub";
import { useOrder } from "@/modules/orders/hooks";

export default function Page() {
  const { orderId } = useParams<{ orderId: string }>();
  const order = useOrder(orderId, { poll: true });
  return <RouteStub title="Status pesanan" band="05" scenario="D. Menunggu, memverifikasi, berhasil, gagal, kedaluwarsa" queries={{ order: order }} />;
}
