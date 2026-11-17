import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  testMatch: "**/*.spec.ts",
  testIgnore: "**/*.live.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://organizer.localhost:3101",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  projects: [
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 } } },
    { name: "tablet-834", use: { viewport: { width: 834, height: 1112 } } },
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: {
    command:
      "NEXT_PUBLIC_API_MOCK=true pnpm dev --port 3101 --hostname 0.0.0.0",
    url: "http://localhost:3101",
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
});
