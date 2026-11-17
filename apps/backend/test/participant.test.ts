import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { AppError } from "../src/lib/app-error.js";
import { hashToken } from "../src/lib/crypto.js";
import { User, Session } from "../src/modules/auth/auth.models.js";
import { PasswordReset } from "../src/modules/account/account.models.js";
import {
  changeParticipantPassword,
  forgotPassword,
  resetPassword,
  deleteParticipantAccount,
} from "../src/modules/account/account.service.js";
import { passwordSchema, profileSchema } from "../src/modules/account/account.schemas.js";
import { SavedEvent } from "../src/modules/saved-events/saved-event.model.js";
import { saveEvent, savedEventList } from "../src/modules/saved-events/saved-event.service.js";
import { Event, TicketType } from "../src/modules/events/event.models.js";
import { Organizer } from "../src/modules/organizers/organizer.model.js";
import { Ticket } from "../src/modules/tickets/ticket.model.js";
import { EventReport } from "../src/modules/event-reports/event-report.model.js";
import {
  submitEventReport,
  getEventReport,
  closeEventReport,
  listEventReports,
  reportInputSchema,
} from "../src/modules/event-reports/event-report.service.js";
import {
  publicDateRange,
  publicEventList,
  publicCities,
  publicEventDetail,
} from "../src/modules/public-events/public-event.service.js";
import { EmailJob } from "../src/modules/notifications/email.service.js";

const database = "gatherly_participant_test";
before(async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI required for integration tests");
  await mongoose.connect(process.env.MONGODB_URI, { dbName: database });
  if (mongoose.connection.db?.databaseName !== database)
    throw new Error("Unexpected test database");
  await mongoose.connection.dropDatabase();
  await Promise.all(
    [
      User,
      Session,
      PasswordReset,
      SavedEvent,
      Event,
      TicketType,
      Organizer,
      Ticket,
      EventReport,
      EmailJob,
    ].map((model) => model.syncIndexes()),
  );
});
beforeEach(async () => {
  if (mongoose.connection.db?.databaseName !== database)
    throw new Error("Unexpected test database");
  await mongoose.connection.db.dropDatabase();
  await Promise.all(
    [
      User,
      Session,
      PasswordReset,
      SavedEvent,
      Event,
      TicketType,
      Organizer,
      Ticket,
      EventReport,
      EmailJob,
    ].map((model) => model.syncIndexes()),
  );
});
after(async () => {
  await mongoose.disconnect();
});

async function fixture() {
  const user = await User.create({
    name: "Participant",
    emailNormalized: "participant@example.test",
    passwordHash: await bcrypt.hash("ExistingPassword123", 12),
  });
  const other = await User.create({ name: "Other", emailNormalized: "other@example.test" });
  const session = await Session.create({
    userId: user._id,
    tokenHash: hashToken("current"),
    csrfTokenHash: hashToken("csrf"),
    expiresAt: new Date(Date.now() + 3600_000),
  });
  await Session.create({
    userId: user._id,
    tokenHash: hashToken("other-device"),
    csrfTokenHash: hashToken("csrf-2"),
    expiresAt: new Date(Date.now() + 3600_000),
  });
  const organizer = await Organizer.create({
    ownerId: other._id,
    name: "Organizer",
    username: "participant-test-organizer",
    description: "Description",
    contactEmail: other.emailNormalized,
  });
  const event = await Event.create({
    organizerId: organizer._id,
    slug: "participant-test-event",
    title: "Test Event",
    description: "Description",
    category: "Music",
    startsAt: new Date(Date.now() + 86_400_000),
    endsAt: new Date(Date.now() + 90_000_000),
    timezone: "Asia/Jakarta",
    venueName: "Venue",
    address: "Address",
    city: "Jakarta",
    publicationStatus: "published",
  });
  return { user, other, session, event, organizer };
}

test("validates participant profile, password, and other report reason", () => {
  assert.equal(profileSchema.safeParse({ name: "Dien", phone: "+628123456789" }).success, true);
  assert.equal(
    profileSchema.safeParse({ name: "Dien", phone: null, email: "change@example.test" }).success,
    false,
  );
  assert.equal(passwordSchema.safeParse({ newPassword: "short" }).success, false);
  assert.equal(reportInputSchema.safeParse({ reason: "other", note: "short" }).success, false);
  assert.equal(
    reportInputSchema.safeParse({ reason: "other", note: "A clear description" }).success,
    true,
  );
});

test("changing password revokes other devices, rejects reused password, and locks repeated wrong passwords", async () => {
  const { user, session } = await fixture();
  await assert.rejects(
    changeParticipantPassword(user.id, session.id, {
      currentPassword: "ExistingPassword123",
      newPassword: "ExistingPassword123",
    }),
    (error: unknown) => error instanceof AppError && error.code === "PASSWORD_REUSED",
  );
  await changeParticipantPassword(user.id, session.id, {
    currentPassword: "ExistingPassword123",
    newPassword: "ReplacementPassword123",
  });
  assert.equal(await Session.countDocuments({ userId: user._id }), 1);
  const stored = await User.findById(user._id);
  assert.equal(await bcrypt.compare("ReplacementPassword123", stored!.passwordHash!), true);
  for (let attempt = 0; attempt < 5; attempt++) {
    await assert.rejects(
      changeParticipantPassword(user.id, session.id, {
        currentPassword: "wrong",
        newPassword: "AnotherPassword123",
      }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === (attempt === 4 ? "PASSWORD_LOCKED" : "INVALID_PASSWORD"),
    );
  }
  await assert.rejects(
    changeParticipantPassword(user.id, session.id, {
      currentPassword: "ReplacementPassword123",
      newPassword: "AnotherPassword123",
    }),
    (error: unknown) => error instanceof AppError && error.code === "PASSWORD_LOCKED",
  );
});

test("password reset token is single use under concurrent requests and revokes all sessions", async () => {
  const { user } = await fixture();
  const token = "test-reset-token-with-at-least-32-characters";
  await PasswordReset.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60_000),
  });
  const results = await Promise.allSettled([
    resetPassword(token, "ResetPassword1234"),
    resetPassword(token, "ResetPassword1234"),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(await Session.countDocuments({ userId: user._id }), 0);
  await assert.rejects(
    resetPassword(token, "AnotherPassword123"),
    (error: unknown) => error instanceof AppError && error.code === "TOKEN_INVALID",
  );
});

test("saving is idempotent and participant saved lists are isolated", async () => {
  const { user, other, event } = await fixture();
  await Promise.all([saveEvent(user.id, event.slug), saveEvent(user.id, event.slug)]);
  assert.equal(await SavedEvent.countDocuments(), 1);
  assert.equal((await savedEventList(user.id)).meta.total, 1);
  assert.equal((await savedEventList(other.id)).meta.total, 0);
});

test("reports prevent duplicate open reports and keep reporter identity out of public model DTO", async () => {
  const { user, event } = await fixture();
  await submitEventReport(event.slug, user.id, {
    reason: "fraud",
    note: "Additional payment was requested",
  });
  await assert.rejects(
    submitEventReport(event.slug, user.id, { reason: "fraud", note: "Again" }),
    (error: unknown) => error instanceof AppError && error.code === "REPORT_EXISTS",
  );
  const report = await EventReport.findOne();
  const adminDetail = await getEventReport(report!.id);
  assert.equal(adminDetail.reporter.email, user.emailNormalized);
  assert.equal(adminDetail.status, "new");
  const list = await listEventReports("new", 1, 20);
  assert.equal("reporterId" in list.data[0]!, false);
  assert.equal("reporter" in list.data[0]!, false);
});

test("review closure and email enqueue are atomic and only one concurrent closure succeeds", async () => {
  const { user, event } = await fixture();
  await submitEventReport(event.slug, user.id, {
    reason: "fraud",
    note: "Additional payment was requested",
  });
  const report = await EventReport.findOne();
  const results = await Promise.allSettled([
    closeEventReport(report!.id, "admin-one", "Report reviewed"),
    closeEventReport(report!.id, "admin-two", "Another review"),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(await EmailJob.countDocuments({ key: `report-reviewed:${report!.id}` }), 1);
  assert.equal((await getEventReport(report!.id)).status, "done");
});

test("forgot password has generic response and invalidates earlier reset links", async () => {
  const { user } = await fixture();
  assert.equal(await forgotPassword("missing@example.test"), undefined);
  await forgotPassword(user.emailNormalized);
  const first = await PasswordReset.findOne();
  await forgotPassword(user.emailNormalized);
  assert.ok((await PasswordReset.findById(first!._id))!.usedAt);
  assert.equal(await PasswordReset.countDocuments({ usedAt: { $exists: false } }), 1);
  assert.equal(await EmailJob.countDocuments(), 2);
});

test("account deletion blocks upcoming valid tickets and otherwise anonymizes user and revokes sessions", async () => {
  const { user, event } = await fixture();
  const ticket = await Ticket.create({
    orderId: new mongoose.Types.ObjectId(),
    eventId: event._id,
    buyerId: user._id,
    ticketTypeId: new mongoose.Types.ObjectId(),
    sequence: 0,
    attendeeName: user.name,
    ticketCode: "test-ticket",
    qrToken: "test-qr",
    eventSnapshot: {
      title: event.title,
      startsAt: event.startsAt,
      timezone: event.timezone,
      venueName: event.venueName,
      address: event.address,
      city: event.city,
    },
    ticketTypeSnapshot: { name: "Regular" },
  });
  await assert.rejects(
    deleteParticipantAccount(user.id),
    (error: unknown) => error instanceof AppError && error.code === "ACCOUNT_HAS_ACTIVE_TICKETS",
  );
  await Ticket.deleteOne({ _id: ticket._id });
  await deleteParticipantAccount(user.id);
  const stored = await User.findById(user._id).lean();
  assert.ok(stored!.deletedAt);
  assert.match(stored!.emailNormalized, /^deleted-/);
  assert.equal(stored!.passwordHash, undefined);
  assert.equal(await Session.countDocuments({ userId: user._id }), 0);
});

test("public catalog price filtering uses purchasable types and hides drafts and frozen organizers", async () => {
  const { user, event, organizer } = await fixture();
  const now = new Date();
  await TicketType.create([
    {
      eventId: event._id,
      name: "Regular",
      description: "",
      price: 100_000,
      capacity: 10,
      reserved: 0,
      sold: 0,
      salesStartsAt: new Date(now.getTime() - 60_000),
      salesEndsAt: new Date(now.getTime() + 3600_000),
    },
    {
      eventId: event._id,
      name: "VIP",
      description: "",
      price: 200_000,
      capacity: 10,
      reserved: 0,
      sold: 0,
      salesStartsAt: new Date(now.getTime() - 60_000),
      salesEndsAt: new Date(now.getTime() + 3600_000),
    },
    {
      eventId: event._id,
      name: "Sold out",
      description: "",
      price: 10_000,
      capacity: 1,
      reserved: 0,
      sold: 1,
      salesStartsAt: new Date(now.getTime() - 60_000),
      salesEndsAt: new Date(now.getTime() + 3600_000),
    },
  ]);
  assert.equal(
    (await publicEventList({ minPrice: 150_000, maxPrice: 250_000 }, user.id, now)).meta.total,
    1,
  );
  assert.equal((await publicEventList({ maxPrice: 50_000 }, user.id, now)).meta.total, 0);
  await saveEvent(user.id, event.slug);
  const detail = await publicEventDetail(event.slug, user.id, now);
  assert.equal(detail.saved, true);
  assert.equal(detail.ticketTypes.find((type) => type.name === "Sold out")?.status, "sold_out");
  assert.equal("qrToken" in detail, false);
  await Organizer.updateOne({ _id: organizer._id }, { $set: { status: "frozen" } });
  assert.equal((await publicEventList({}, user.id, now)).meta.total, 0);
  assert.equal((await publicEventDetail(event.slug, user.id, now)).status, "closed");
  await Event.updateOne({ _id: event._id }, { $set: { publicationStatus: "draft" } });
  await assert.rejects(
    publicEventDetail(event.slug),
    (error: unknown) => error instanceof AppError && error.code === "NOT_FOUND",
  );
});

test("discovery date filters respect WIB day boundaries", () => {
  const range = publicDateRange("today", new Date("2026-11-17T18:00:00Z"));
  assert.equal(range.from.toISOString(), "2026-11-17T17:00:00.000Z");
  assert.equal(range.to.toISOString(), "2026-11-18T17:00:00.000Z");
});

test("public catalog filters by city and lists cities with active events", async () => {
  const { user, event } = await fixture();
  const now = new Date();
  assert.equal((await publicEventList({ city: "jakarta" }, user.id, now)).meta.total, 1);
  assert.equal((await publicEventList({ city: "Kota Yogyakarta" }, user.id, now)).meta.total, 0);
  assert.equal((await publicEventList({ city: "Jak.*" }, user.id, now)).meta.total, 0);
  assert.deepEqual(await publicCities(now), [{ name: "Jakarta", count: 1 }]);
  await Event.updateOne({ _id: event._id }, { $set: { publicationStatus: "draft" } });
  assert.deepEqual(await publicCities(now), []);
});
