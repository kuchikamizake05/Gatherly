import { issueDueTickets } from "../modules/tickets/ticket-issuance.service.js";

const intervalMs = 10_000;

export function startTicketIssuanceJob() {
  const run = () => {
    issueDueTickets().catch((error: unknown) => {
      console.error("Ticket issuance job failed.", error);
    });
  };
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return timer;
}
