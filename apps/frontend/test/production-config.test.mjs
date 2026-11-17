import assert from "node:assert/strict";
import { test } from "node:test";
import { PHASE_PRODUCTION_BUILD } from "next/constants.js";
import nextConfig from "../next.config.mjs";

function releaseEnv(overrides, run) {
  const names = [
    "GATHERLY_PRODUCTION_BUILD",
    "NEXT_PUBLIC_API_MOCK",
    "API_INTERNAL_URL",
    "NEXT_PUBLIC_API_URL",
  ];
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  Object.assign(process.env, {
    GATHERLY_PRODUCTION_BUILD: "true",
    NEXT_PUBLIC_API_MOCK: "false",
    API_INTERNAL_URL: "https://backend.example.invalid",
    NEXT_PUBLIC_API_URL: "",
    ...overrides,
  });
  try {
    return run();
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}
test("production release refuses demo data", () =>
  releaseEnv({ NEXT_PUBLIC_API_MOCK: "true" }, () =>
    assert.throws(
      () => nextConfig(PHASE_PRODUCTION_BUILD),
      /disable NEXT_PUBLIC_API_MOCK/,
    ),
  ));
test("production release refuses insecure or non-origin backend targets", () => {
  for (const target of [
    "http://localhost:4000",
    "https://localhost",
    "https://127.0.0.1",
    "https://[::1]",
    "https://user:password@backend.example.invalid",
    "https://backend.example.invalid/api/v1",
    "https://backend.example.invalid?key=secret",
    "https://backend.example.invalid#fragment",
  ])
    releaseEnv({ API_INTERNAL_URL: target }, () =>
      assert.throws(
        () => nextConfig(PHASE_PRODUCTION_BUILD),
        /HTTPS backend origin/,
      ),
    );
});
test("production release refuses insecure public API targets", () => {
  for (const target of [
    "http://backend.example.invalid",
    "//backend.example.invalid",
    "https://user:password@backend.example.invalid",
  ])
    releaseEnv({ NEXT_PUBLIC_API_URL: target }, () =>
      assert.throws(() => nextConfig(PHASE_PRODUCTION_BUILD)),
    );
});
test("blank public API preserves same-origin proxy and document protections", async () => {
  const config = releaseEnv({}, () => nextConfig(PHASE_PRODUCTION_BUILD));
  assert.deepEqual(await config.rewrites(), [
    {
      source: "/api/v1/:path*",
      destination: "https://backend.example.invalid/api/v1/:path*",
    },
  ]);
  const [{ headers }] = await config.headers();
  assert.ok(
    headers.some(
      (header) =>
        header.key === "X-Content-Type-Options" && header.value === "nosniff",
    ),
  );
  assert.ok(
    headers.some(
      (header) =>
        header.key === "Permissions-Policy" &&
        header.value.includes("camera=(self)"),
    ),
  );
});
