import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { after, before, beforeEach, test } from "node:test";
import "dotenv/config";
import mongoose from "mongoose";

import { AppError } from "../src/lib/app-error.js";
import { hashToken } from "../src/lib/crypto.js";
import { Session, User } from "../src/modules/auth/auth.models.js";
import { Event, TicketType } from "../src/modules/events/event.models.js";
import { Order } from "../src/modules/orders/order.model.js";
import { createOrder } from "../src/modules/orders/order.service.js";
import type { SnapTransport } from "../src/modules/payments/midtrans.client.js";
import { createPaymentSession } from "../src/modules/payments/payment.service.js";
import { PaymentEvent } from "../src/modules/payments/payment-event.model.js";
import {
  applyPaymentStatus,
  midtransSignature,
  processMidtransNotification,
} from "../src/modules/payments/payment-notification.service.js";
import { reconcileDuePayments } from "../src/modules/payments/payment-reconciliation.service.js";
import { Ticket } from "../src/modules/tickets/ticket.model.js";
import { issueDueTickets } from "../src/modules/tickets/ticket-issuance.service.js";

const testDatabase = "gatherly_test";
let server: Server;
let baseUrl: string;

before(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required for integration tests.");
  await mongoose.connect(process.env.MONGODB_URI, { dbName: testDatabase });
  if (mongoose.connection.db?.databaseName !== testDatabase) {
    throw new Error(`Refusing to reset database ${mongoose.connection.db?.databaseName ?? "unknown"}.`);
  }
  await mongoose.connection.dropDatabase();
  await Promise.all([
    User.syncIndexes(),
    Session.syncIndexes(),
    Event.syncIndexes(),
    TicketType.syncIndexes(),
    Order.syncIndexes(),
    PaymentEvent.syncIndexes(),
    Ticket.syncIndexes(),
  ]);
  const { app } = await import("../src/app.js");
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(async () => {
  if (mongoose.connection.db?.databaseName !== testDatabase) {
    throw new Error("Refusing to clear a database other than gatherly_test.");
  }
  await Promise.all([
    User.deleteMany({}),
    Session.deleteMany({}),
    Event.deleteMany({}),
    TicketType.deleteMany({}),
    Order.deleteMany({}),
    PaymentEvent.deleteMany({}),
    Ticket.deleteMany({}),
  ]);
});

after(async () => {
  if (mongoose.connection.db?.databaseName !== testDatabase) {
    throw new Error("Refusing to clean a database other than gatherly_test.");
  }
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await Promise.all([
    User.deleteMany({}),
    Session.deleteMany({}),
    Event.deleteMany({}),
    TicketType.deleteMany({}),
    Order.deleteMany({}),
    PaymentEvent.deleteMany({}),
    Ticket.deleteMany({}),
  ]);
  await mongoose.disconnect();
});

async function fixture(capacity = 4) {
  const [buyerA, buyerB] = await User.create([
    { name: "Buyer A", emailNormalized: "a@example.test", passwordHash: "test-hash" },
    { name: "Buyer B", emailNormalized: "b@example.test", passwordHash: "test-hash" },
  ]);
  const now = Date.now();
  const event = await Event.create({
    organizerId: new mongoose.Types.ObjectId(),
    slug: `test-event-${new mongoose.Types.ObjectId()}`,
    title: "Test Event",
    description: "Integration test event",
    category: "Workshop",
    startsAt: new Date(now + 24 * 60 * 60 * 1000),
    endsAt: new Date(now + 26 * 60 * 60 * 1000),
    timezone: "Asia/Jakarta",
    venueName: "Test Venue",
    address: "Test Address",
    city: "Yogyakarta",
    publicationStatus: "published",
    salesClosed: false,
  });
  const ticketType = await TicketType.create({
    eventId: event._id,
    name: "Regular",
    description: "Regular ticket",
    price: 100_000,
    capacity,
    reserved: 0,
    sold: 0,
    salesStartsAt: new Date(now - 60_000),
    salesEndsAt: new Date(now + 12 * 60 * 60 * 1000),
  });
  return { buyerA, buyerB, event, ticketType };
}

function input(ticketTypeId: string, quantity = 1) {
  return {
    ticketTypeId,
    quantity,
    attendees: Array.from({ length: quantity }, (_, index) => ({ name: `Attendee ${index + 1}` })),
  };
}

test("creates a held reservation using the server price", async () => {
  const { buyerA, ticketType } = await fixture();
  const result = await createOrder(
    buyerA._id.toString(),
    "11111111-1111-4111-8111-111111111111",
    input(ticketType._id.toString(), 2),
  );

  assert.equal(result.created, true);
  assert.equal(result.order.unitPrice, 100_000);
  assert.equal(result.order.totalAmount, 200_000);
  assert.equal(result.order.reservationStatus, "held");
  const inventory = await TicketType.findById(ticketType._id).lean();
  assert.equal(inventory?.reserved, 2);
  assert.equal((inventory?.capacity ?? 0) - (inventory?.reserved ?? 0) - (inventory?.sold ?? 0), 2);
});

test("returns the original order for an idempotent retry and rejects a changed payload", async () => {
  const { buyerA, ticketType } = await fixture();
  const key = "22222222-2222-4222-8222-222222222222";
  const first = await createOrder(buyerA._id.toString(), key, input(ticketType._id.toString()));
  const retry = await createOrder(buyerA._id.toString(), key, input(ticketType._id.toString()));

  assert.equal(retry.created, false);
  assert.equal(retry.order._id.toString(), first.order._id.toString());
  assert.equal((await TicketType.findById(ticketType._id).lean())?.reserved, 1);

  await assert.rejects(
    createOrder(buyerA._id.toString(), key, input(ticketType._id.toString(), 2)),
    (error: unknown) => error instanceof AppError && error.code === "IDEMPOTENCY_CONFLICT",
  );
});

test("allows exactly one buyer to reserve the final slot", async () => {
  const { buyerA, buyerB, ticketType } = await fixture(1);
  const results = await Promise.allSettled([
    createOrder(
      buyerA._id.toString(),
      "33333333-3333-4333-8333-333333333333",
      input(ticketType._id.toString()),
    ),
    createOrder(
      buyerB._id.toString(),
      "44444444-4444-4444-8444-444444444444",
      input(ticketType._id.toString()),
    ),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(rejected && rejected.status === "rejected");
  assert.ok(rejected.reason instanceof AppError);
  assert.equal(rejected.reason.code, "SOLD_OUT");
  assert.equal(await Order.countDocuments(), 1);
  const inventory = await TicketType.findById(ticketType._id).lean();
  assert.equal(inventory?.reserved, 1);
  assert.equal(inventory?.sold, 0);
});

test("rejects unavailable inventory without creating an order", async () => {
  const { buyerA, ticketType } = await fixture(1);
  ticketType.reserved = 1;
  await ticketType.save();

  await assert.rejects(
    createOrder(
      buyerA._id.toString(),
      "55555555-5555-4555-8555-555555555555",
      input(ticketType._id.toString()),
    ),
    (error: unknown) => error instanceof AppError && error.code === "SOLD_OUT",
  );
  assert.equal(await Order.countDocuments(), 0);
  assert.equal((await TicketType.findById(ticketType._id).lean())?.reserved, 1);
});

test("rejects a closed sale without changing inventory", async () => {
  const { buyerA, event, ticketType } = await fixture();
  event.salesClosed = true;
  await event.save();

  await assert.rejects(
    createOrder(
      buyerA._id.toString(),
      "66666666-6666-4666-8666-666666666666",
      input(ticketType._id.toString()),
    ),
    (error: unknown) => error instanceof AppError && error.code === "SALES_CLOSED",
  );
  assert.equal(await Order.countDocuments(), 0);
  assert.equal((await TicketType.findById(ticketType._id).lean())?.reserved, 0);
});

test("creates and reads an order through the authenticated API", async () => {
  const { buyerA, ticketType } = await fixture();
  const sessionToken = "integration-session-token";
  const csrfToken = "integration-csrf-token";
  await Session.create({
    tokenHash: hashToken(sessionToken),
    csrfTokenHash: hashToken(csrfToken),
    userId: buyerA._id,
    expiresAt: new Date(Date.now() + 60_000),
  });

  const createResponse = await fetch(`${baseUrl}/api/v1/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `gatherly_session=${sessionToken}`,
      "X-CSRF-Token": csrfToken,
      "Idempotency-Key": "77777777-7777-4777-8777-777777777777",
    },
    body: JSON.stringify(input(ticketType._id.toString(), 2)),
  });
  assert.equal(createResponse.status, 201);
  const created = (await createResponse.json()) as { data: { id: string; totalAmount: number } };
  assert.equal(created.data.totalAmount, 200_000);

  const detailResponse = await fetch(`${baseUrl}/api/v1/orders/${created.data.id}`, {
    headers: { Cookie: `gatherly_session=${sessionToken}` },
  });
  assert.equal(detailResponse.status, 200);

  const listResponse = await fetch(`${baseUrl}/api/v1/orders`, {
    headers: { Cookie: `gatherly_session=${sessionToken}` },
  });
  assert.equal(listResponse.status, 200);
  const list = (await listResponse.json()) as { data: unknown[]; meta: { total: number } };
  assert.equal(list.data.length, 1);
  assert.equal(list.meta.total, 1);
});

test("creates one Snap session from server-owned order data and reuses it", async () => {
  const { buyerA, ticketType } = await fixture();
  const { order } = await createOrder(
    buyerA._id.toString(),
    "88888888-8888-4888-8888-888888888888",
    input(ticketType._id.toString(), 2),
  );
  let calls = 0;
  const transport: SnapTransport = async (payload) => {
    calls += 1;
    assert.equal(payload.transaction_details.order_id, order.providerOrderId);
    assert.equal(payload.transaction_details.gross_amount, 200_000);
    assert.equal(payload.item_details[0].price * payload.item_details[0].quantity, 200_000);
    assert.equal(payload.expiry.duration, 15);
    return {
      kind: "success",
      token: "sandbox-snap-token",
      redirectUrl: "https://app.sandbox.midtrans.com/snap/v2/vtweb/test-token",
    };
  };

  const first = await createPaymentSession(order._id.toString(), buyerA._id.toString(), transport);
  const retry = await createPaymentSession(order._id.toString(), buyerA._id.toString(), transport);
  assert.equal(first.status, "ready");
  assert.equal(retry.status, "ready");
  assert.equal(calls, 1);
  assert.equal((await Order.findById(order._id).lean())?.paymentSessionAttempts, 1);
});

test("allows only one provider call for concurrent payment-session requests", async () => {
  const { buyerA, ticketType } = await fixture();
  const { order } = await createOrder(
    buyerA._id.toString(),
    "99999999-9999-4999-8999-999999999999",
    input(ticketType._id.toString()),
  );
  let releaseProvider!: () => void;
  let providerStarted!: () => void;
  const started = new Promise<void>((resolve) => { providerStarted = resolve; });
  const release = new Promise<void>((resolve) => { releaseProvider = resolve; });
  let calls = 0;
  const transport: SnapTransport = async () => {
    calls += 1;
    providerStarted();
    await release;
    return {
      kind: "success",
      token: "one-token",
      redirectUrl: "https://app.sandbox.midtrans.com/snap/v2/vtweb/one-token",
    };
  };

  const firstRequest = createPaymentSession(order._id.toString(), buyerA._id.toString(), transport);
  await started;
  const second = await createPaymentSession(order._id.toString(), buyerA._id.toString(), transport);
  assert.equal(second.status, "creating");
  releaseProvider();
  assert.equal((await firstRequest).status, "ready");
  assert.equal(calls, 1);
});

test("keeps an uncertain provider result from being retried", async () => {
  const { buyerA, ticketType } = await fixture();
  const { order } = await createOrder(
    buyerA._id.toString(),
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    input(ticketType._id.toString()),
  );
  let calls = 0;
  const transport: SnapTransport = async () => {
    calls += 1;
    return { kind: "uncertain", reason: "timeout" };
  };

  assert.equal(
    (await createPaymentSession(order._id.toString(), buyerA._id.toString(), transport)).status,
    "uncertain",
  );
  assert.equal(
    (await createPaymentSession(order._id.toString(), buyerA._id.toString(), transport)).status,
    "uncertain",
  );
  assert.equal(calls, 1);
});

test("resets a definitely rejected session and closes an expired order", async () => {
  const { buyerA, ticketType } = await fixture();
  const { order } = await createOrder(
    buyerA._id.toString(),
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    input(ticketType._id.toString()),
  );
  await assert.rejects(
    createPaymentSession(order._id.toString(), buyerA._id.toString(), async () => ({
      kind: "rejected",
      status: 400,
    })),
    (error: unknown) => error instanceof AppError && error.code === "PROVIDER_REJECTED",
  );
  assert.equal((await Order.findById(order._id).lean())?.paymentSessionState, "not_started");

  await Order.updateOne({ _id: order._id }, { $set: { expiresAt: new Date(Date.now() - 1) } });
  await assert.rejects(
    createPaymentSession(order._id.toString(), buyerA._id.toString(), async () => ({
      kind: "success",
      token: "unused",
      redirectUrl: "https://example.test/unused",
    })),
    (error: unknown) => error instanceof AppError && error.code === "ORDER_NOT_PAYABLE",
  );
  assert.equal((await Order.findById(order._id).lean())?.paymentSessionState, "closed");
});

test("hides payment sessions from another buyer", async () => {
  const { buyerA, buyerB, ticketType } = await fixture();
  const { order } = await createOrder(
    buyerA._id.toString(),
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    input(ticketType._id.toString()),
  );
  await assert.rejects(
    createPaymentSession(order._id.toString(), buyerB._id.toString(), async () => ({
      kind: "uncertain",
      reason: "network",
    })),
    (error: unknown) => error instanceof AppError && error.code === "NOT_FOUND",
  );
});

test("returns a stored Snap session through the authenticated API", async () => {
  const { buyerA, ticketType } = await fixture();
  const { order } = await createOrder(
    buyerA._id.toString(),
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    input(ticketType._id.toString()),
  );
  await Order.updateOne(
    { _id: order._id },
    {
      $set: {
        paymentSessionState: "ready",
        snapToken: "stored-token",
        redirectUrl: "https://app.sandbox.midtrans.com/snap/v2/vtweb/stored-token",
      },
    },
  );
  const sessionToken = "payment-api-session-token";
  const csrfToken = "payment-api-csrf-token";
  await Session.create({
    tokenHash: hashToken(sessionToken),
    csrfTokenHash: hashToken(csrfToken),
    userId: buyerA._id,
    expiresAt: new Date(Date.now() + 60_000),
  });

  const response = await fetch(`${baseUrl}/api/v1/orders/${order._id}/payment-session`, {
    method: "POST",
    headers: {
      Cookie: `gatherly_session=${sessionToken}`,
      "X-CSRF-Token": csrfToken,
    },
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as { data: { snapToken: string } };
  assert.equal(body.data.snapToken, "stored-token");
});

function notification(
  order: { providerOrderId: string; totalAmount: number },
  transactionStatus: string,
  transactionId: string,
) {
  const payload = {
    order_id: order.providerOrderId,
    status_code: "200",
    gross_amount: `${order.totalAmount}.00`,
    transaction_status: transactionStatus,
    transaction_id: transactionId,
    fraud_status: "accept",
    currency: "IDR",
    transaction_time: "2026-09-27 10:00:00",
  };
  return { ...payload, signature_key: midtransSignature(payload) };
}

test("processes a verified paid notification exactly once", async () => {
  const { buyerA, ticketType } = await fixture(2);
  const { order } = await createOrder(
    buyerA._id.toString(),
    "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    input(ticketType._id.toString(), 2),
  );
  const payload = notification(order, "settlement", "paid-transaction-1");

  assert.equal((await processMidtransNotification(payload)).duplicate, false);
  assert.equal((await processMidtransNotification(payload)).duplicate, true);

  const updatedOrder = await Order.findById(order._id).lean();
  const inventory = await TicketType.findById(ticketType._id).lean();
  assert.equal(updatedOrder?.paymentStatus, "paid");
  assert.equal(updatedOrder?.reservationStatus, "converted");
  assert.equal(updatedOrder?.issuanceStatus, "processing");
  assert.equal(updatedOrder?.paymentTimeline.length, 1);
  assert.equal(inventory?.reserved, 0);
  assert.equal(inventory?.sold, 2);
  assert.equal(await PaymentEvent.countDocuments(), 1);
});

test("rejects invalid notification signatures and amounts", async () => {
  const { buyerA, ticketType } = await fixture();
  const { order } = await createOrder(
    buyerA._id.toString(),
    "ffffffff-ffff-4fff-8fff-ffffffffffff",
    input(ticketType._id.toString()),
  );
  const invalidSignature = notification(order, "settlement", "invalid-signature");
  invalidSignature.signature_key = "0".repeat(128);
  await assert.rejects(
    processMidtransNotification(invalidSignature),
    (error: unknown) => error instanceof AppError && error.code === "INVALID_NOTIFICATION",
  );

  const invalidAmount = notification(order, "settlement", "invalid-amount");
  invalidAmount.gross_amount = "999.00";
  invalidAmount.signature_key = midtransSignature(invalidAmount);
  await assert.rejects(
    processMidtransNotification(invalidAmount),
    (error: unknown) => error instanceof AppError && error.code === "INVALID_NOTIFICATION",
  );
  assert.equal((await Order.findById(order._id).lean())?.paymentStatus, "pending");
});

test("does not downgrade a paid order with a stale failure notification", async () => {
  const { buyerA, ticketType } = await fixture();
  const { order } = await createOrder(
    buyerA._id.toString(),
    "10101010-1010-4010-8010-101010101010",
    input(ticketType._id.toString()),
  );
  await processMidtransNotification(notification(order, "settlement", "status-order-paid"));
  await processMidtransNotification(notification(order, "expire", "status-order-expired"));

  const updated = await Order.findById(order._id).lean();
  assert.equal(updated?.paymentStatus, "paid");
  assert.equal(updated?.reservationStatus, "converted");
  assert.equal((await TicketType.findById(ticketType._id).lean())?.sold, 1);
});

test("releases an expired order that never reached Midtrans", async () => {
  const { buyerA, ticketType } = await fixture();
  const { order } = await createOrder(
    buyerA._id.toString(),
    "20202020-2020-4020-8020-202020202020",
    input(ticketType._id.toString()),
  );
  await Order.updateOne(
    { _id: order._id },
    { $set: { expiresAt: new Date(Date.now() - 1), nextReconcileAt: new Date(Date.now() - 1) } },
  );

  assert.equal(await reconcileDuePayments(async () => ({ kind: "unavailable" })), 1);
  const updated = await Order.findById(order._id).lean();
  assert.equal(updated?.paymentStatus, "expired");
  assert.equal(updated?.reservationStatus, "released");
  assert.equal((await TicketType.findById(ticketType._id).lean())?.reserved, 0);
});

test("keeps inventory nonnegative when paid races with expiry", async () => {
  const { buyerA, ticketType } = await fixture(1);
  const { order } = await createOrder(
    buyerA._id.toString(),
    "30303030-3030-4030-8030-303030303030",
    input(ticketType._id.toString()),
  );
  await Promise.all([
    applyPaymentStatus(order._id.toString(), "paid", new Date()),
    applyPaymentStatus(order._id.toString(), "expired", new Date()),
  ]);

  const updatedOrder = await Order.findById(order._id).lean();
  const inventory = await TicketType.findById(ticketType._id).lean();
  assert.equal(updatedOrder?.paymentStatus, "paid");
  assert.ok((inventory?.reserved ?? -1) >= 0);
  assert.ok((inventory?.sold ?? -1) >= 0);
  assert.equal((inventory?.reserved ?? 0) + (inventory?.sold ?? 0), updatedOrder?.reservationStatus === "released" ? 0 : 1);
});

test("issues exactly one ticket per attendee after payment", async () => {
  const { buyerA, ticketType } = await fixture(3);
  const { order } = await createOrder(
    buyerA._id.toString(),
    "40404040-4040-4040-8040-404040404040",
    input(ticketType._id.toString(), 3),
  );
  await applyPaymentStatus(order._id.toString(), "paid", new Date());

  assert.equal(await issueDueTickets(), 1);
  const tickets = await Ticket.find({ orderId: order._id }).select("+qrToken").sort({ sequence: 1 });
  assert.equal(tickets.length, 3);
  assert.deepEqual(tickets.map((ticket) => ticket.attendeeName), [
    "Attendee 1",
    "Attendee 2",
    "Attendee 3",
  ]);
  assert.equal(new Set(tickets.map((ticket) => ticket.ticketCode)).size, 3);
  assert.equal(new Set(tickets.map((ticket) => ticket.qrToken)).size, 3);
  assert.ok(tickets.every((ticket) => /^[A-Za-z0-9_-]{43}$/.test(ticket.qrToken)));
  assert.equal((await Order.findById(order._id).lean())?.issuanceStatus, "issued");
});

test("does not issue tickets before payment", async () => {
  const { buyerA, ticketType } = await fixture();
  await createOrder(
    buyerA._id.toString(),
    "50505050-5050-4050-8050-505050505050",
    input(ticketType._id.toString()),
  );

  assert.equal(await issueDueTickets(), 0);
  assert.equal(await Ticket.countDocuments(), 0);
});

test("makes retries and concurrent issuance idempotent", async () => {
  const { buyerA, ticketType } = await fixture(2);
  const { order } = await createOrder(
    buyerA._id.toString(),
    "60606060-6060-4060-8060-606060606060",
    input(ticketType._id.toString(), 2),
  );
  await applyPaymentStatus(order._id.toString(), "paid", new Date());
  await Ticket.create({
    orderId: order._id,
    eventId: order.eventId,
    buyerId: order.buyerId,
    ticketTypeId: order.ticketTypeId,
    sequence: 0,
    attendeeName: order.attendees[0]!.name,
    ticketCode: "GTH-T-RECOVERY01",
    qrToken: "recovery-token",
    checkInStatus: "unused",
    eventSnapshot: order.eventSnapshot,
    ticketTypeSnapshot: { name: order.ticketTypeSnapshot.name },
  });
  await Order.updateOne(
    { _id: order._id },
    { $set: { issuanceLeaseUntil: new Date(Date.now() - 1) } },
  );

  const processed = await Promise.all([issueDueTickets(1), issueDueTickets(1)]);
  assert.equal(processed.reduce((sum, count) => sum + count, 0), 1);
  assert.equal(await Ticket.countDocuments({ orderId: order._id }), 2);
  assert.equal(await issueDueTickets(), 0);
  assert.equal(await Ticket.countDocuments({ orderId: order._id }), 2);
});

test("lists safe ticket data and reveals QR only to its owner", async () => {
  const { buyerA, buyerB, ticketType } = await fixture();
  const { order } = await createOrder(
    buyerA._id.toString(),
    "70707070-7070-4070-8070-707070707070",
    input(ticketType._id.toString()),
  );
  await applyPaymentStatus(order._id.toString(), "paid", new Date());
  await issueDueTickets();
  const ticket = await Ticket.findOne({ orderId: order._id });
  assert.ok(ticket);

  const [ownerSession, otherSession] = ["ticket-owner-session", "ticket-other-session"];
  await Session.create([
    {
      tokenHash: hashToken(ownerSession),
      csrfTokenHash: hashToken("unused-owner-csrf"),
      userId: buyerA._id,
      expiresAt: new Date(Date.now() + 60_000),
    },
    {
      tokenHash: hashToken(otherSession),
      csrfTokenHash: hashToken("unused-other-csrf"),
      userId: buyerB._id,
      expiresAt: new Date(Date.now() + 60_000),
    },
  ]);

  const listResponse = await fetch(`${baseUrl}/api/v1/tickets`, {
    headers: { Cookie: `gatherly_session=${ownerSession}` },
  });
  assert.equal(listResponse.status, 200);
  const listBody = (await listResponse.json()) as {
    data: Array<Record<string, unknown>>;
    meta: { total: number };
  };
  assert.equal(listBody.meta.total, 1);
  assert.equal(listBody.data[0]?.qrPayload, undefined);
  assert.equal(listBody.data[0]?.qrToken, undefined);

  const detailResponse = await fetch(`${baseUrl}/api/v1/tickets/${ticket._id}`, {
    headers: { Cookie: `gatherly_session=${ownerSession}` },
  });
  assert.equal(detailResponse.status, 200);
  const detailBody = (await detailResponse.json()) as { data: { qrPayload: string } };
  assert.match(detailBody.data.qrPayload, /^gatherly:v1:[A-Za-z0-9_-]{43}$/);

  const hiddenResponse = await fetch(`${baseUrl}/api/v1/tickets/${ticket._id}`, {
    headers: { Cookie: `gatherly_session=${otherSession}` },
  });
  assert.equal(hiddenResponse.status, 404);
});
