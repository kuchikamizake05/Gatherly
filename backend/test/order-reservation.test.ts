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
