import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, test } from "node:test";
import "dotenv/config";
import cookieParser from "cookie-parser";
import express from "express";
import mongoose from "mongoose";

import { AppError } from "../src/lib/app-error.js";
import { createToken, hashToken } from "../src/lib/crypto.js";
import { seedAdmin } from "../src/modules/admin/admin-auth.routes.js";
import { AdminSession } from "../src/modules/admin/admin.models.js";
import { Payout } from "../src/modules/payouts/payout.model.js";
import { adminPayoutRouter } from "../src/modules/payouts/payout.routes.js";
import { Refund } from "../src/modules/refunds/refund.model.js";

const database = `gatherly_admin_payout_test_${randomUUID().replaceAll("-", "")}`;
let server: Server;
let base: string;
let cookie: string;
let csrf: string;

before(async () => {
  process.env.ADMIN_ENCRYPTION_KEY = "integration-test-admin-key-at-least-32-characters";
  await mongoose.connect(process.env.MONGODB_URI!, { dbName: database });
  const admin = await seedAdmin({
    name: "Payout Admin",
    email: "payout@gatherly.xyz",
    password: "IntegrationPassword123!",
    totpSecret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
    backupCodes: ["payout-backup-code"],
  });
  const token = createToken();
  csrf = createToken();
  await AdminSession.create({
    accountId: admin._id,
    tokenHash: hashToken(token),
    csrfToken: csrf,
    expiresAt: new Date(Date.now() + 3600_000),
  });
  cookie = `gatherly_admin=${token}`;

  const app = express();
  app.use(express.json(), cookieParser());
  app.use("/admin", adminPayoutRouter);
  app.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (error instanceof AppError)
        res.status(error.statusCode).json({ error: { code: error.code } });
      else
        res
          .status(500)
          .json({
            error: {
              code: "INTERNAL_ERROR",
              message: error instanceof Error ? error.message : "failed",
            },
          });
    },
  );
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  if (mongoose.connection.db?.databaseName === database) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(async () => {
  await Promise.all([Payout.deleteMany({}), Refund.deleteMany({})]);
});

function payout(
  status: "requested" | "transferred",
  requestedAt = new Date(Date.now() - 3600_000),
) {
  return Payout.create({
    organizerId: new mongoose.Types.ObjectId(),
    eventId: new mongoose.Types.ObjectId(),
    amount: 100_000,
    bank: "BCA",
    accountNumber: "1234567890",
    holderName: "Organizer Test",
    status,
    requestedAt,
    ...(status === "transferred"
      ? { transferredAt: new Date(), transferReference: "TRF-OLD" }
      : {}),
  });
}

function markTransferred(id: string, body: unknown) {
  return fetch(`${base}/admin/payouts/${id}/transferred`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie, "X-CSRF-Token": csrf },
    body: JSON.stringify(body),
  });
}

test("admin payout list filters by tab and returns counts for both tabs", async () => {
  await Promise.all([payout("requested"), payout("requested"), payout("transferred")]);

  const requested = await fetch(`${base}/admin/payouts?tab=requested`, { headers: { cookie } });
  assert.equal(requested.status, 200);
  const requestedBody = await requested.json();
  assert.equal(requestedBody.data.length, 2);
  assert.ok(requestedBody.data.every((row: { status: string }) => row.status === "requested"));
  assert.deepEqual(requestedBody.counts, { requested: 2, transferred: 1 });
  assert.equal(requestedBody.meta.total, 2);

  const transferred = await (
    await fetch(`${base}/admin/payouts?tab=transferred`, { headers: { cookie } })
  ).json();
  assert.equal(transferred.data.length, 1);
  assert.equal(transferred.data[0].transferReference, "TRF-OLD");
});

test("marking a payout transferred uses transferReference, needs CSRF, and only succeeds once", async () => {
  const row = await payout("requested");
  const body = { transferReference: "TRF-2611-001", transferredAt: new Date().toISOString() };

  const noCsrf = await fetch(`${base}/admin/payouts/${row.id}/transferred`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  assert.equal(noCsrf.status, 403);

  assert.equal(
    (
      await markTransferred(row.id, {
        reference: "TRF-2611-001",
        transferredAt: body.transferredAt,
      })
    ).status,
    400,
  );
  assert.equal((await markTransferred(row.id, body)).status, 204);
  assert.equal((await markTransferred(row.id, body)).status, 409);

  const stored = await Payout.findById(row.id).lean();
  assert.equal(stored?.status, "transferred");
  assert.equal(stored?.transferReference, "TRF-2611-001");
});

test("payout cannot be marked transferred while an approved refund is still processing", async () => {
  const row = await payout("requested");
  await Refund.create({
    orderId: new mongoose.Types.ObjectId(),
    eventId: row.eventId,
    buyerId: new mongoose.Types.ObjectId(),
    reason: "Tidak bisa hadir karena sakit",
    kind: "buyer",
    status: "approved",
    amount: 50_000,
    baseAmount: 50_000,
    refundKey: randomUUID(),
  });
  const response = await markTransferred(row.id, {
    transferReference: "TRF-2611-002",
    transferredAt: new Date().toISOString(),
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "REFUNDS_PENDING");
  assert.equal((await Payout.findById(row.id).lean())?.status, "requested");
});
