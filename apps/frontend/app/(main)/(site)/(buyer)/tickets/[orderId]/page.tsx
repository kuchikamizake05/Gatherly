import { ETicketView } from "@/modules/tickets/components/ETicketView";

type Props = { params: Promise<{ orderId: string }> };

/** E-tiket satu pesanan. Pita 06. */
export default async function ETicketPage({ params }: Props) {
  const { orderId } = await params;
  return <ETicketView orderId={orderId} />;
}
