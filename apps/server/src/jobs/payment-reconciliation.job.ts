import { reconcileDuePayments } from "../modules/payments/payment-reconciliation.service.js";

const intervalMs = 60_000;

export function startPaymentReconciliationJob() {
  const run = () => {
    reconcileDuePayments().catch((error: unknown) => {
      console.error("Payment reconciliation job failed.", error);
    });
  };
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return timer;
}
