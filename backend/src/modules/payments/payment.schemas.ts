import { z } from "zod";

export const snapResponseSchema = z.object({
  token: z.string().min(1),
  redirect_url: z.string().url(),
});

export const transactionStatusSchema = z.object({
  order_id: z.string().min(1),
  status_code: z.string().min(1),
  gross_amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  transaction_status: z.string().min(1),
  transaction_id: z.string().optional(),
  fraud_status: z.string().optional(),
  currency: z.string().optional(),
  transaction_time: z.string().optional(),
  settlement_time: z.string().optional(),
}).passthrough();

export type TransactionStatusPayload = z.infer<typeof transactionStatusSchema>;

export interface SnapRequest {
  transaction_details: { order_id: string; gross_amount: number };
  item_details: Array<{ id: string; price: number; quantity: number; name: string }>;
  customer_details: { first_name: string; email: string };
  expiry: { start_time: string; unit: "minutes"; duration: number };
}
