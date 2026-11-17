import assert from "node:assert/strict";
import { test } from "node:test";
import { orderPricing, refundDeadline } from "../src/modules/orders/pricing.js";

test("organizer face value is preserved and the buyer pays the additional fee", () => {
  assert.deepEqual(orderPricing(100_000, 1), {
    subtotalAmount: 100_000,
    serviceFeeAmount: 5_000,
    totalAmount: 105_000,
  });
  assert.deepEqual(orderPricing(100_000, 4), {
    subtotalAmount: 400_000,
    serviceFeeAmount: 20_000,
    totalAmount: 420_000,
  });
  assert.deepEqual(orderPricing(0, 4), { subtotalAmount: 0, serviceFeeAmount: 0, totalAmount: 0 });
  assert.throws(() => orderPricing(-1, 1));
  assert.throws(() => orderPricing(100, 5));
});

test("refund cutoff is one calendar month before the event in its timezone", () => {
  assert.equal(
    refundDeadline(new Date("2026-12-20T12:00:00Z"), "Asia/Jakarta").toISOString(),
    "2026-11-20T12:00:00.000Z",
  );
  assert.equal(
    refundDeadline(new Date("2026-03-31T12:00:00Z"), "Asia/Jakarta").toISOString(),
    "2026-02-28T12:00:00.000Z",
  );
  assert.equal(
    refundDeadline(new Date("2028-03-31T12:00:00Z"), "Asia/Jakarta").toISOString(),
    "2028-02-29T12:00:00.000Z",
  );
  assert.equal(
    refundDeadline(new Date("2026-11-20T17:30:00Z"), "Asia/Jakarta").toISOString(),
    "2026-10-20T17:30:00.000Z",
  );
});
