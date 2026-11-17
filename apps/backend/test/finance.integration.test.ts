import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, after, beforeEach, test } from "node:test";
import "dotenv/config";
import mongoose from "mongoose";
import { Event, TicketType } from "../src/modules/events/event.models.js";
import { User } from "../src/modules/auth/auth.models.js";
import { Order } from "../src/modules/orders/order.model.js";
import { createOrder } from "../src/modules/orders/order.service.js";
import { applyPaymentStatus } from "../src/modules/payments/payment-notification.service.js";
import { Ticket } from "../src/modules/tickets/ticket.model.js";
import { issueDueTickets } from "../src/modules/tickets/ticket-issuance.service.js";
import { Refund } from "../src/modules/refunds/refund.model.js";
import {
  requestBuyerRefund,
  decideRefund,
  requestEventCancellation,
  decideEventCancellation,
} from "../src/modules/refunds/refund.service.js";
import { EmailJob } from "../src/modules/notifications/email.service.js";
import { RealtimeEvent } from "../src/modules/realtime/events.js";
import { AppError } from "../src/lib/app-error.js";

const dbName = "gatherly_finance_test";
before(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI required");
  await mongoose.connect(process.env.MONGODB_URI, { dbName });
  if (mongoose.connection.db?.databaseName !== dbName) throw new Error("Unsafe database");
  await Promise.all([
    Event.init(),
    TicketType.init(),
    User.init(),
    Order.init(),
    Ticket.init(),
    Refund.init(),
    EmailJob.init(),
    RealtimeEvent.init(),
  ]);
});
beforeEach(async () => {
  if (mongoose.connection.db?.databaseName !== dbName) throw new Error("Unsafe database");
  for (const collection of Object.values(mongoose.connection.collections))
    await collection.deleteMany({});
});
after(async () => {
  await mongoose.disconnect();
});
async function fixture(price = 100_000) {
  const buyer = await User.create({
    name: "Buyer",
    emailNormalized: `${randomUUID()}@example.test`,
  });
  const event = await Event.create({
    organizerId: new mongoose.Types.ObjectId(),
    slug: randomUUID(),
    title: "Finance test",
    description: "Test",
    category: "Workshop",
    startsAt: new Date(Date.now() + 100 * 86400_000),
    endsAt: new Date(Date.now() + 101 * 86400_000),
    timezone: "Asia/Jakarta",
    venueName: "Venue",
    address: "Address",
    city: "Jakarta",
    publicationStatus: "published",
  });
  const type = await TicketType.create({
    eventId: event._id,
    name: "Regular",
    description: "Test",
    price,
    capacity: 4,
    salesStartsAt: new Date(Date.now() - 86400_000),
    salesEndsAt: event.startsAt,
  });
  const { order } = await createOrder(buyer.id, randomUUID(), {
    ticketTypeId: type.id,
    quantity: 2,
    attendees: [
      { name: "One", email: "one@example.test" },
      { name: "Two", email: "two@example.test" },
    ],
  });
  if (price) await applyPaymentStatus(order.id, "paid", new Date());
  await issueDueTickets();
  return { buyer, event, type, order, tickets: await Ticket.find({ orderId: order._id }) };
}
test("buyer partial refund excludes fee and cancellation needs admin approval", async () => {
  const { buyer, order, tickets } = await fixture();
  const request = await requestBuyerRefund(
    order.id,
    buyer.id,
    "Cannot attend because of family travel",
    [tickets[0].id],
  );
  assert.equal(request.amount, 100_000);
  assert.equal((await Ticket.findById(tickets[0]._id))?.checkInStatus, "unused");
  await decideRefund(
    request.id,
    new mongoose.Types.ObjectId().toString(),
    true,
    "Clear explanation accepted",
  );
  assert.equal((await Ticket.findById(tickets[0]._id))?.checkInStatus, "cancelled");
  assert.equal((await Ticket.findById(tickets[1]._id))?.checkInStatus, "unused");
  assert.equal((await Order.findById(order._id))?.refundedAmount, 0);
  await assert.rejects(
    decideRefund(request.id, new mongoose.Types.ObjectId().toString(), true, "Repeated"),
    (e: unknown) => e instanceof AppError && e.code === "ALREADY_REVIEWED",
  );
});
test("refund requests cannot be created after the calendar deadline", async () => {
  const { buyer, event, order } = await fixture();
  await assert.rejects(
    requestBuyerRefund(
      order.id,
      buyer.id,
      "Clear family travel reason",
      undefined,
      new Date(event.startsAt.getTime() - 10 * 86400_000),
    ),
    (e: unknown) => e instanceof AppError && e.code === "REFUND_DEADLINE",
  );
});
test("event cancellation keeps event active until admin approval then refunds entire buyer charge", async () => {
  const { event, order } = await fixture();
  await requestEventCancellation(
    event.id,
    event.organizerId.toString(),
    event.title,
    "Venue is no longer available",
  );
  assert.equal((await Event.findById(event._id))?.publicationStatus, "published");
  await decideEventCancellation(
    event.id,
    new mongoose.Types.ObjectId().toString(),
    true,
    "Venue closure verified",
  );
  const request = await Refund.findOne({ orderId: order._id });
  assert.equal(request?.amount, 210_000);
  assert.equal(request?.baseAmount, 200_000);
  assert.equal(await Ticket.countDocuments({ orderId: order._id, checkInStatus: "cancelled" }), 2);
  assert.equal((await Event.findById(event._id))?.publicationStatus, "cancelled");
});
test("free orders immediately convert inventory and issue tickets without Midtrans", async () => {
  const { order, type } = await fixture(0);
  const saved = await Order.findById(order._id);
  const inventory = await TicketType.findById(type._id);
  assert.equal(saved?.paymentStatus, "paid");
  assert.equal(saved?.issuanceStatus, "issued");
  assert.equal(saved?.totalAmount, 0);
  assert.equal(inventory?.reserved, 0);
  assert.equal(inventory?.sold, 2);
});
