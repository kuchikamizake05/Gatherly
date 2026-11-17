import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, after, test } from "node:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { createToken, hashToken } from "../src/lib/crypto.js";
import { adminAuthRouter, seedAdmin } from "../src/modules/admin/admin-auth.routes.js";
import { adminOrganizersRouter } from "../src/modules/admin/admin-organizers.routes.js";
import { AdminSession, AdminAccount } from "../src/modules/admin/admin.models.js";
import { OrganizerApplication } from "../src/modules/applications/application.models.js";
import { applicationRouter } from "../src/modules/applications/application.routes.js";
import { workspaceAuthRouter, teamRouter } from "../src/modules/workspace/workspace.routes.js";
import { WorkspaceAccount, WorkspaceSession } from "../src/modules/workspace/workspace.models.js";
import { Organizer } from "../src/modules/organizers/organizer.model.js";
import { User } from "../src/modules/auth/auth.models.js";
import { AppError } from "../src/lib/app-error.js";

const database = `gatherly_workspace_test_${randomUUID().replaceAll("-", "")}`;
let server: Server, base: string, adminCookie: string, adminCsrf: string;
before(async () => {
  process.env.ADMIN_ENCRYPTION_KEY = "integration-test-admin-key-at-least-32-characters";
  await mongoose.connect(process.env.MONGODB_URI!, { dbName: database });
  await Promise.all([
    WorkspaceAccount.syncIndexes(),
    WorkspaceSession.syncIndexes(),
    Organizer.syncIndexes(),
    OrganizerApplication.syncIndexes(),
    AdminAccount.syncIndexes(),
  ]);
  const admin = await seedAdmin({
    name: "Integration Admin",
    email: "integration@gatherly.xyz",
    password: "IntegrationPassword123!",
    totpSecret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
    backupCodes: ["one-use-backup-code"],
    primary: true,
  });
  const token = createToken();
  adminCsrf = createToken();
  await AdminSession.create({
    accountId: admin._id,
    tokenHash: hashToken(token),
    csrfToken: adminCsrf,
    expiresAt: new Date(Date.now() + 3600_000),
  });
  adminCookie = `gatherly_admin=${token}`;
  const app = express();
  app.use(express.json(), cookieParser());
  app.use("/admin/auth", adminAuthRouter);
  app.use("/admin", adminOrganizersRouter);
  app.use("/applications", applicationRouter);
  app.use("/workspace/auth", workspaceAuthRouter);
  app.use("/team", teamRouter);
  app.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (error instanceof AppError)
        res.status(error.statusCode).json({ error: { code: error.code } });
      else if ((error as { code?: number })?.code === 11000)
        res.status(409).json({ error: { code: "DUPLICATE" } });
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
function post(path: string, body: unknown, cookie = adminCookie, csrf = adminCsrf) {
  return fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie, "X-CSRF-Token": csrf },
    body: JSON.stringify(body),
  });
}
async function createApplication(username: string, emailVerified = true) {
  return OrganizerApplication.create({
    number: `PNG-2611-${randomUUID().slice(0, 8).toUpperCase()}`,
    organizerName: "Test Organizer",
    organizerType: "individu",
    description: "Organizer integration test",
    address: { province: "DIY", city: "Sleman", street: "Jalan Pengujian 1", postalCode: "55281" },
    links: [],
    pic: {
      name: "Test PIC",
      role: "Owner",
      email: `${username}@example.test`,
      phone: "081234567890",
    },
    username,
    ktp: {
      id: new mongoose.Types.ObjectId().toString(),
      name: "ktp.pdf",
      type: "application/pdf",
      size: 100,
    },
    emailVerifiedAt: emailVerified ? new Date() : undefined,
  });
}
test("admin cannot approve unverified applications or mutate without CSRF", async () => {
  const app = await createApplication("unverified", false);
  const unverified = await post(`/admin/applications/${app.id}/approve`, {});
  assert.equal(unverified.status, 409);
  assert.equal((await unverified.json()).error.code, "EMAIL_NOT_VERIFIED");
  const csrf = await post(
    `/admin/applications/${app.id}/reject`,
    { reason: "Data belum lengkap" },
    adminCookie,
    "wrong",
  );
  assert.equal(csrf.status, 403);
  assert.equal(await Organizer.countDocuments(), 0);
});
test("concurrent approval creates exactly one organizer account", async () => {
  const app = await createApplication("approval-race");
  const responses = await Promise.all([
    post(`/admin/applications/${app.id}/approve`, {}),
    post(`/admin/applications/${app.id}/approve`, {}),
  ]);
  const statuses = responses.map((response) => response.status).sort();
  assert.deepEqual(statuses, [204, 409]);
  assert.equal(await WorkspaceAccount.countDocuments({ username: "approval-race" }), 1);
  assert.equal(await Organizer.countDocuments({ username: "approval-race" }), 1);
  assert.equal((await OrganizerApplication.findById(app.id))?.status, "approved");
});
test("correction requires lookup-issued capability and rejects unflagged fields", async () => {
  const app = await createApplication("correction");
  app.status = "needs_fix";
  app.flags = [{ field: "description", note: "Jelaskan acara Anda" }] as typeof app.flags;
  app.fixDeadline = new Date(Date.now() + 86400_000);
  await app.save();
  const withoutToken = await post(
    `/applications/${app.number}/fix`,
    { description: "Updated description" },
    "",
    "",
  );
  assert.equal(withoutToken.status, 401);
  const lookup = await post(
    "/applications/lookup",
    { number: app.number, email: app.pic!.email },
    "",
    "",
  );
  assert.equal(lookup.status, 200);
  const editCookie = lookup.headers.get("set-cookie")!.split(";")[0]!;
  const unflagged = await post(
    `/applications/${app.number}/fix`,
    { description: "Updated description", username: "hijacked" },
    editCookie,
    "",
  );
  assert.equal(unflagged.status, 400);
  assert.equal((await OrganizerApplication.findById(app.id))?.username, "correction");
});
test("backup code is single-use across concurrent login challenges", async () => {
  const password = "IntegrationPassword123!";
  const logins = await Promise.all([
    post("/admin/auth/login", { email: "integration@gatherly.xyz", password }, "", ""),
    post("/admin/auth/login", { email: "integration@gatherly.xyz", password }, "", ""),
  ]);
  const challenges = await Promise.all(logins.map((response) => response.json()));
  const responses = await Promise.all(
    challenges.map((challenge) =>
      post(
        "/admin/auth/backup-code",
        { challengeId: challenge.data.challengeId, code: "one-use-backup-code" },
        "",
        "",
      ),
    ),
  );
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 401]);
});
test("temporary workspace account cannot access team until password changes", async () => {
  const user = await User.create({
    name: "Workspace Owner",
    emailNormalized: "workspace-test@example.test",
  });
  const org = await Organizer.create({
    ownerId: user._id,
    name: "Workspace Test",
    description: "Test workspace access",
    contactEmail: "owner@example.test",
    username: "temp-owner",
  });
  await WorkspaceAccount.create({
    username: "temp-owner",
    name: "Workspace Owner",
    userId: user._id,
    organizerId: org._id,
    role: "organizer",
    passwordHash: await bcrypt.hash("TemporaryPassword123!", 12),
    temporaryExpiresAt: new Date(Date.now() + 86400_000),
  });
  const login = await post(
    "/workspace/auth/login",
    { username: "temp-owner", password: "TemporaryPassword123!" },
    "",
    "",
  );
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")!.split(";")[0]!,
    json = await login.json();
  assert.equal(json.data.mustChangePassword, true);
  const blocked = await fetch(base + "/team", { headers: { cookie } });
  assert.equal(blocked.status, 403);
  const reused = await post(
    "/workspace/auth/password/first",
    { newPassword: "TemporaryPassword123!" },
    cookie,
    json.data.csrfToken,
  );
  assert.equal(reused.status, 400);
  const changed = await post(
    "/workspace/auth/password/first",
    { newPassword: "NewWorkspacePassword123!" },
    cookie,
    json.data.csrfToken,
  );
  assert.equal(changed.status, 204);
  assert.equal((await fetch(base + "/team", { headers: { cookie } })).status, 200);
});
