import { TicketPrintView } from "@/modules/tickets/components/TicketPrintView";

type Props = { params: Promise<{ orderId: string }> };

export const metadata = { title: "E-tiket" };

/** PDF e-tiket. Pita 06 G1, G2. */
export default async function TicketPrintPage({ params }: Props) {
  const { orderId } = await params;
  return <TicketPrintView orderId={orderId} />;
}
