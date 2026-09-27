import assert from "node:assert/strict";
import { test } from "node:test";
import "dotenv/config";

import { createSnapTransaction } from "../src/modules/payments/midtrans.client.js";

function jakartaTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")} ${value("hour")}:${value("minute")}:${value("second")} +0700`;
}

test("Midtrans Sandbox returns a Snap token", async () => {
  const result = await createSnapTransaction({
    transaction_details: {
      order_id: `gatherly-smoke-${Date.now()}`,
      gross_amount: 10_000,
    },
    item_details: [{ id: "smoke-ticket", price: 10_000, quantity: 1, name: "Smoke Ticket" }],
    customer_details: { first_name: "Gatherly Test", email: "test@example.com" },
    expiry: { start_time: jakartaTime(new Date()), unit: "minutes", duration: 15 },
  });

  assert.equal(result.kind, "success", `Unexpected Midtrans result: ${JSON.stringify(result)}`);
  if (result.kind === "success") {
    assert.ok(result.token.length > 0);
    assert.match(result.redirectUrl, /^https:\/\//);
  }
});
