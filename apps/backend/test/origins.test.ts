import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import "dotenv/config";
import mongoose from "mongoose";

const site = "https://gatherlyy.fun";
const organizer = "https://organizer.gatherlyy.fun";
const admin = "https://admin.gatherlyy.fun";
const local = "http://localhost:3000";

// env.ts is parsed on import, so set the allow list before loading the app.
process.env.WEB_ORIGIN = site;
process.env.WEB_ORIGINS = [site, organizer, admin, local].join(",");
process.env.GOOGLE_CLIENT_ID ??= "test-client-id";
process.env.GOOGLE_CLIENT_SECRET ??= "test-client-secret";

const { app } = await import("../src/app.js");
const { isAllowedOrigin, safeReturnTo } = await import("../src/lib/origins.js");

const database = `gatherly_origin_test_${randomUUID().replaceAll("-", "")}`;
let server: Server;
let base: string;

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI!, { dbName: database });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (mongoose.connection.db?.databaseName === database) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test("allow list accepts the four sites and rejects look-alike domains", () => {
  for (const origin of [site, organizer, admin, local]) assert.equal(isAllowedOrigin(origin), true);
  for (const origin of [
    "https://gatherly.fun",
    "https://evil.gatherlyy.fun.example",
    "http://gatherlyy.fun",
    undefined,
  ]) {
    assert.equal(isAllowedOrigin(origin), false, String(origin));
  }
  assert.equal(safeReturnTo("/account"), "/account");
  assert.equal(safeReturnTo("//evil.example"), "/");
  assert.equal(safeReturnTo("https://evil.example"), "/");
});

test("CORS answers allowed origins and ignores others", async () => {
  for (const origin of [site, organizer, admin, local]) {
    const response = await fetch(`${base}/api/v1/health`, { headers: { Origin: origin } });
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  }
  const other = await fetch(`${base}/api/v1/health`, {
    headers: { Origin: "https://gatherly.fun" },
  });
  assert.equal(other.headers.get("access-control-allow-origin"), null);
});

test("Google login uses the callback of the site it started on", async () => {
  const cases = [
    { referer: `${site}/login`, callback: `${site}/api/v1/auth/google/callback` },
    { referer: `${local}/login`, callback: `${local}/api/v1/auth/google/callback` },
    { referer: "https://gatherly.fun/login", callback: `${site}/api/v1/auth/google/callback` },
  ];
  for (const { referer, callback } of cases) {
    const response = await fetch(`${base}/api/v1/auth/google?returnTo=%2Faccount`, {
      headers: { Referer: referer },
      redirect: "manual",
    });
    assert.equal(response.status, 302, referer);
    const location = new URL(response.headers.get("location")!);
    assert.equal(location.hostname, "accounts.google.com");
    assert.equal(location.searchParams.get("redirect_uri"), callback, referer);
  }
});

test("Google callback with an invalid state returns to that site's login page", async () => {
  const response = await fetch(`${base}/api/v1/auth/google/callback?state=bad`, {
    headers: { "X-Forwarded-Host": "localhost:3000", "X-Forwarded-Proto": "http" },
    redirect: "manual",
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), `${local}/login?error=google`);
});
