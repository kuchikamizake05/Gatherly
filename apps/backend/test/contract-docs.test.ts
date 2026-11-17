import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { swaggerSpec } from "../src/docs/swagger-spec.js";

test("Swagger covers all mounted HTTP operations", async () => {
  // @ts-expect-error The build-time inventory script is JavaScript tooling.
  const { routeInventory } = await import("../scripts/contract-inventory.mjs");
  const missing = routeInventory().filter((route: {path:string;method:string}) => !(swaggerSpec.paths as Record<string, Record<string, unknown>>)[route.path]?.[route.method]);
  assert.deepEqual(missing.map((route: {path:string;method:string}) => `${route.method} ${route.path}`), []);
});

test("canonical documents describe implemented M5 behavior", () => {
  const model = fs.readFileSync(new URL("../../../docs/data-model.md",import.meta.url),"utf8");
  const contract = fs.readFileSync(new URL("../../../docs/api-contract.md",import.meta.url),"utf8");
  for(const term of ["WorkspaceAccount", "AdminChallenge", "OrganizerApplication", "Refund", "BankAccount", "Payout", "SocketGrant", "EmailJob"]) assert.ok(model.includes(term),term);
  for(const term of ["/workspace/auth/login", "/admin/auth/totp", "/refunds/orders/{orderId}", "/realtime/ticket", "/tickets/shared/{token}"]) assert.ok(contract.includes(term),term);
  assert.ok(!model.includes("Kontrak rancangan, belum schema"));
});
