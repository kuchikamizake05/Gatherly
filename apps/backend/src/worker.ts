import mongoose from "mongoose";
import { env } from "./config/env.js";
import { reconcileDuePayments } from "./modules/payments/payment-reconciliation.service.js";
import { issueDueTickets } from "./modules/tickets/ticket-issuance.service.js";
import { deliverEmailJobs } from "./modules/notifications/email.service.js";
import { repairTicketEmails } from "./modules/notifications/tickets.js";
import { cleanupAssets } from "./modules/storage/storage.service.js";
import { queueReminders } from "./jobs/reminders.js";
import { processDueRefunds } from "./modules/refunds/refund.service.js";

let stopping = false;
const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
async function run() {
  await mongoose.connect(env.MONGODB_URI);
  let paymentAt = 0,
    maintenanceAt = 0;
  while (!stopping) {
    for (const [name, job] of [
      ["issuance", () => issueDueTickets()],
      ["refund", () => processDueRefunds()],
      ["ticket-email", () => repairTicketEmails()],
      ["email", () => deliverEmailJobs()],
    ] as const) {
      try {
        await job();
      } catch (error) {
        console.error(`${name} job failed:`, reason(error));
      }
    }
    if (Date.now() - paymentAt >= 60_000) {
      paymentAt = Date.now();
      try {
        await reconcileDuePayments();
      } catch (error) {
        console.error("Payment reconciliation failed:", reason(error));
      }
    }
    if (Date.now() - maintenanceAt >= 3600_000) {
      maintenanceAt = Date.now();
      try {
        await queueReminders();
        await cleanupAssets();
      } catch (error) {
        console.error("Scheduled maintenance failed:", reason(error));
      }
    }
    if (!stopping) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  await mongoose.disconnect();
}
run().catch((error: unknown) => {
  console.error("Worker failed to start:", reason(error));
  process.exitCode = 1;
});
