import { ReceiptPrintView } from "@/modules/orders/components/ReceiptPrintView";

type Props = { params: Promise<{ orderId: string }> };

export const metadata = { title: "Bukti pembayaran" };

/** Bukti pembayaran. Pita 06 G3. */
export default async function ReceiptPage({ params }: Props) {
  const { orderId } = await params;
  return <ReceiptPrintView orderId={orderId} />;
}
