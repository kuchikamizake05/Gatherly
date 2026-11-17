const entries = [
  ["web", process.env.DEMO_WEB_URL, "/"],
  ["organizer", process.env.DEMO_ORGANIZER_URL, "/login"],
  ["api", process.env.DEMO_API_URL, "/api/v1/health"],
];
for (const [name, origin, path] of entries) {
  if (!origin) throw new Error(`Set DEMO_${name.toUpperCase()}_URL before running this check.`);
  const url = new URL(path, origin);
  const local = /^(localhost|127\.0\.0\.1|.+\.localhost)$/.test(url.hostname);
  if (url.protocol !== "https:" && !local) throw new Error(`${name} must use HTTPS.`);
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: "error" });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  console.log(`${name}: HTTP ${response.status} ${url.origin}${url.pathname}`);
}
console.log("HTTP checks passed. Verify sessions, camera permissions, payment and webhook flows in the browser before publishing links.");
