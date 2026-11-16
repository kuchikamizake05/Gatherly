"use client";

import { useParams } from "next/navigation";
import { RouteStub } from "@/components/elements/route-stub";
import { useOrder, usePaymentSession, useCancelOrder } from "@/modules/orders/hooks";

export default function Page() {
  const { orderId } = useParams<{ orderId: string }>();
  const order = useOrder(orderId, { poll: true });
  const session = usePaymentSession();
  const cancel = useCancelOrder();
  void session; void cancel; // Buka Snap Midtrans dengan session.data.snapToken.
  return <RouteStub title="Bayar pesanan" band="05" scenario="A2 sampai C. Bayar, ganti metode" queries={{ order: order }} />;
}
