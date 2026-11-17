import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import "dotenv/config";
import mongoose from "mongoose";

import { app } from "../src/app.js";

const database = `gatherly_validation_test_${randomUUID().replaceAll("-", "")}`;
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

test("invalid request bodies return 400 VALIDATION_ERROR instead of 500", async () => {
  for (const path of ["/api/v1/workspace/auth/login", "/api/v1/admin/auth/login"]) {
    const response = await fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(response.status, 400, path);
    const body = await response.json();
    assert.equal(body.error.code, "VALIDATION_ERROR", path);
    assert.ok(Object.keys(body.error.fields).length > 0, path);
  }
});
