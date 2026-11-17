import type { Order } from "./types";

/**
 * Biaya layanan dibayar pembeli di atas harga tiket, dibulatkan ke rupiah terdekat.
 * Organizer menerima harga tiket penuh. Sama dengan apps/backend/src/modules/orders/pricing.ts.
 */
export const SERVICE_FEE_RATE = 0.05;
export const SERVICE_FEE_LABEL = "5%";

export const serviceFee = (subtotal: number) => Math.round(subtotal * SERVICE_FEE_RATE);

export type Amounts = { subtotal: number; fee: number; total: number };

/** Perkiraan sebelum pesanan dibuat, misalnya di detail acara dan data peserta. */
export function estimateAmounts(quantity: number, unitPrice: number): Amounts {
  const subtotal = quantity * unitPrice;
  const fee = serviceFee(subtotal);
  return { subtotal, fee, total: subtotal + fee };
}

/** Angka resmi dari pesanan. totalAmount adalah jumlah yang ditagih ke Midtrans. */
export function orderAmounts(order: Pick<Order, "quantity" | "ticketType" | "totalAmount" | "subtotalAmount" | "serviceFeeAmount">): Amounts {
  const subtotal = order.subtotalAmount ?? order.quantity * order.ticketType.unitPrice;
  const fee = order.serviceFeeAmount ?? Math.max(0, order.totalAmount - subtotal);
  return { subtotal, fee, total: order.totalAmount };
}
