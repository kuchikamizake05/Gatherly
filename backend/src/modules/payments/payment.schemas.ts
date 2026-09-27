import { z } from "zod";

export const snapResponseSchema = z.object({
  token: z.string().min(1),
  redirect_url: z.string().url(),
});

export interface SnapRequest {
  transaction_details: { order_id: string; gross_amount: number };
  item_details: Array<{ id: string; price: number; quantity: number; name: string }>;
  customer_details: { first_name: string; email: string };
  expiry: { start_time: string; unit: "minutes"; duration: number };
}
