import { CheckoutPayment } from "@/modules/orders/components/CheckoutPayment";

type Props = { params: Promise<{ orderId: string }> };

/** Bayar pesanan. Pita 05 A2, C, E3, E4. */
export default async function CheckoutPaymentPage({ params }: Props) {
  const { orderId } = await params;
  return <CheckoutPayment orderId={orderId} />;
}
