import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  testMatch: "**/*.live.spec.ts",
  outputDir: "test-results/live",
  workers: 3,
  timeout: 40_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://organizer.localhost:3102",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    serviceWorkers: "block",
  },
  projects: [
    { name: "mobile-390", use: { viewport: { width: 390, height: 844 } } },
    { name: "tablet-834", use: { viewport: { width: 834, height: 1112 } } },
    { name: "desktop-1440", use: { viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: {
    command:
      "NEXT_PUBLIC_API_MOCK=false pnpm start --port 3102 --hostname 0.0.0.0",
    url: "http://organizer.localhost:3102/login",
    reuseExistingServer: false,
    timeout: 45_000,
  },
});
