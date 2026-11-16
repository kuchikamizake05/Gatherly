"use client";

import { RouteStub } from "@/components/elements/RouteStub";
import { useTickets } from "@/modules/tickets/hooks";
import { useOrders } from "@/modules/orders/hooks";

export default function Page() {
  const tickets = useTickets();
  const orders = useOrders();
  return <RouteStub title="Tiketku" band="07" scenario="A sampai E. Akan datang, menunggu bayar, selesai, dibatalkan" queries={{ tickets: tickets, orders: orders }} />;
}
