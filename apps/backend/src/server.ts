import mongoose from "mongoose";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { startPaymentReconciliationJob } from "./jobs/payment-reconciliation.job.js";
import { startTicketIssuanceJob } from "./jobs/ticket-issuance.job.js";

async function startServer() {
  await mongoose.connect(env.MONGODB_URI);
  startPaymentReconciliationJob();
  startTicketIssuanceJob();

  app.listen(env.PORT, () => {
    console.info(`Gatherly API listening on http://localhost:${env.PORT}`);
  });
}

startServer().catch((error: unknown) => {
  console.error("Unable to start Gatherly API.", error);
  process.exitCode = 1;
});
