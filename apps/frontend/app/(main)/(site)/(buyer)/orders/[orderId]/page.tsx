import { OrderStatusView } from "@/modules/orders/components/OrderStatusView";

type Props = { params: Promise<{ orderId: string }> };

/** Status pesanan. Pita 05 A4, A5, D. */
export default async function OrderStatusPage({ params }: Props) {
  const { orderId } = await params;
  return <OrderStatusView orderId={orderId} />;
}
