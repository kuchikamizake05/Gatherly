import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { z } from "zod";
import { apiErrorHandler } from "../src/lib/api-error-handler.js";
import { AppError } from "../src/lib/app-error.js";

test("raw Zod validation errors return field-level 400, not INTERNAL_ERROR", async () => {
  const app = express();
  app.use(express.json());
  app.post("/validate", (req, res) => {
    z.object({ email: z.string().email(), attendees: z.array(z.object({ name: z.string().min(2) })) }).parse(req.body);
    res.sendStatus(204);
  });
  app.get("/conflict", () => { throw new AppError(409, "REVIEW_CONFLICT", "Already reviewed."); });
  app.use(apiErrorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    const invalid = await fetch(`${base}/validate`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ email:"invalid", attendees:[{name:""}] }) });
    assert.equal(invalid.status, 400);
    const body = await invalid.json();
    assert.equal(body.error.code, "VALIDATION_ERROR");
    assert.ok(body.error.fields.email);
    assert.ok(body.error.fields["attendees.0.name"]);
    const valid = await fetch(`${base}/validate`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email:"test@example.com",attendees:[{name:"Test"}]}) });
    assert.equal(valid.status, 204);
    const conflict = await fetch(`${base}/conflict`);
    assert.equal(conflict.status,409);
    assert.equal((await conflict.json()).error.code,"REVIEW_CONFLICT");
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
