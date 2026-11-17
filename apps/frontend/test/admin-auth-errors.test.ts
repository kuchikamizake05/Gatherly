import assert from "node:assert/strict";
import test from "node:test";
import { requiresNewAdminChallenge } from "../src/modules/admin/auth-errors.js";

test("expired, exhausted and consumed admin challenges require a new login", () => {
  for (const code of ["CHALLENGE_INVALID", "CHALLENGE_USED", "CHALLENGE_EXPIRED"]) {
    assert.equal(requiresNewAdminChallenge(code), true, code);
  }
});

test("incorrect codes and transient errors do not discard the current challenge", () => {
  for (const code of ["CODE_INVALID", "NETWORK_ERROR", "ACCOUNT_LOCKED", "INTERNAL_ERROR"]) {
    assert.equal(requiresNewAdminChallenge(code), false, code);
  }
});
