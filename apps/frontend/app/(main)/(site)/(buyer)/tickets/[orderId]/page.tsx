"use client";

import { useParams } from "next/navigation";
import { RouteStub } from "@/components/elements/RouteStub";
import { useOrder } from "@/modules/orders/hooks";
import { useTickets, useResendTickets } from "@/modules/tickets/hooks";

export default function Page() {
  const { orderId } = useParams<{ orderId: string }>();
  const order = useOrder(orderId);
  const tickets = useTickets();
  const resend = useResendTickets();
  void resend; // Satu e-tiket per tampilan, pindah peserta lewat tab nama.
  return <RouteStub title="E-tiket" band="06" pendingIssue="#25 B25 untuk kirim ulang" queries={{ order: order, tickets: tickets }} />;
}
