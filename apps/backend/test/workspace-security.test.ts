import test from "node:test";
import assert from "node:assert/strict";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  totpAt,
  verifyTotp,
} from "../src/modules/admin/totp.js";

const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
test("TOTP matches RFC 6238 SHA1 vectors truncated to six digits", () => {
  for (const [seconds, expected] of [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ] as const) {
    assert.equal(totpAt(secret, Math.floor(seconds / 30)), expected);
  }
});
test("TOTP allows one clock step, rejects malformed and stale codes", () => {
  const now = new Date(1234567890 * 1000),
    counter = Math.floor(now.getTime() / 30000);
  assert.equal(verifyTotp(secret, totpAt(secret, counter), now), counter);
  assert.equal(verifyTotp(secret, totpAt(secret, counter - 1), now), counter - 1);
  assert.equal(verifyTotp(secret, totpAt(secret, counter - 3), now), null);
  assert.equal(verifyTotp(secret, "00000", now), null);
});
test("admin TOTP secrets are encrypted with authenticated random nonces", () => {
  process.env.ADMIN_ENCRYPTION_KEY = "unit-test-only-secret-with-at-least-32-characters";
  const a = encryptTotpSecret(secret),
    b = encryptTotpSecret(secret);
  assert.notEqual(a, b);
  assert.equal(decryptTotpSecret(a), secret);
  const changed = Buffer.from(a, "base64");
  changed[changed.length - 1] = changed[changed.length - 1]! ^ 1;
  assert.throws(() => decryptTotpSecret(changed.toString("base64")));
});
