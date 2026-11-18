/**
 * Membuat src/docs/swagger-paths-extra.ts dari tabel endpoint di docs/api-contract.md.
 * Endpoint yang sudah ditulis manual di swagger-spec.ts tidak ditimpa.
 * Jalankan dari apps/backend: node scripts/generate-swagger-extra.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const backend = join(here, "..");
const contract = readFileSync(join(backend, "..", "..", "docs", "api-contract.md"), "utf8");
const spec = readFileSync(join(backend, "src", "docs", "swagger-spec.ts"), "utf8");

// Operasi yang sudah ada di swagger-spec.ts: "path" { get: ..., post: ... }
const existing = new Set();
const pathBlocks = spec.split(/\n {4}"(\/[^"]+)": \{/);
for (let i = 1; i < pathBlocks.length; i += 2) {
  const body = pathBlocks[i + 1].split(/\n {4}"\//)[0];
  for (const m of body.matchAll(/\n {6}(get|post|patch|put|delete): \{/g))
    existing.add(`${m[1].toUpperCase()} ${pathBlocks[i].replace(/\{\w+\}/g, "*")}`);
}

// Rute yang benar-benar terdaftar di Express: prefix dari app.ts + path di tiap router.
import { readdirSync, statSync } from "node:fs";
const app = readFileSync(join(backend, "src", "app.ts"), "utf8");
const mounts = {};
for (const m of app.matchAll(/app\.use\(\s*"([^"]+)"\s*,([^;]*?)\);/gs))
  for (const name of m[2].match(/\b\w+Router\b/g) ?? [])
    (mounts[name] ??= []).push(m[1].replace("/api/v1", ""));
const real = new Set();
const norm = (p) => p.replace(/:\w+|\{\w+\}|\$\{[^}]*\}/g, "*").replace(/\/$/, "");
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) walk(full);
    else if (f.endsWith(".ts")) {
      const src = readFileSync(full, "utf8");
      for (const m of src.matchAll(/\b(\w+Router)\.(get|post|patch|put|delete)\(\s*[`"]([^`"]+)[`"]/g))
        for (const pre of mounts[m[1]] ?? []) real.add(`${m[2].toUpperCase()} ${norm(pre + m[3])}`);
    }
  }
}
walk(join(backend, "src", "modules"));
const routeExists = (method, path) => {
  const target = norm(path).split("/");
  return [...real].some((r) => {
    const [m, p] = r.split(" ");
    const parts = p.split("/");
    return (
      m === method &&
      parts.length === target.length &&
      parts.every((x, i) => x === target[i] || x === "*" || target[i] === "*")
    );
  });
};

const TAGS = [
  [/^\/account|^\/auth\/password/, "Account"],
  [/^\/organizer-applications/, "Organizer Applications"],
  [/^\/workspace\/auth/, "Workspace Auth"],
  [/^\/organizer\/(team|profile)/, "Organizer Workspace"],
  [/^\/organizer\/(bank-account|payouts)/, "Organizer Payouts"],
  [/^\/organizer\/events/, "Organizer Events"],
  [/^\/refunds/, "Refunds"],
  [/^\/admin\/auth/, "Admin Auth"],
  [/^\/admin\/(applications|organizers)/, "Admin Organizers"],
  [/^\/admin\/(refunds|cancellations|payouts)/, "Admin Finance"],
  [/^\/admin\/reports/, "Admin Reports"],
  [/^\/me\/saved-events/, "Saved Events"],
  [/^\/events\/.*\/reports/, "Event Reports"],
  [/^\/orders/, "Orders"],
  [/^\/tickets/, "Tickets"],
  [/^\/organizers\//, "Organizers"],
  [/^\/(media|realtime)/, "System"],
];
const PUBLIC = [
  /^POST \/auth\/password\//,
  /^\S+ \/organizer-applications/,
  /^POST \/workspace\/auth\/(login|password\/forgot|password\/reset)$/,
  /^POST \/admin\/auth\/(login|totp|backup-code)$/,
  /^GET \/tickets\/shared\//,
  /^GET \/organizers\/[^/]+\/profile$/,
  /^GET \/media\//,
];
const MULTIPART = [/^POST \/account\/avatar$/, /^POST \/organizer-applications\/documents$/, /^PATCH \/organizer\/profile$/];

function security(method, path) {
  const key = `${method} ${path}`;
  if (PUBLIC.some((r) => r.test(key))) return [];
  const write = method !== "GET";
  const csrf = write ? { csrfToken: [] } : {};
  if (path.startsWith("/admin")) return [{ adminCookie: [], ...csrf }];
  if (/^\/(workspace|organizer\/(team|profile))/.test(path)) return [{ workspaceCookie: [], ...csrf }];
  if (/^\/(organizer\/(events|bank-account|payouts))/.test(path))
    return [
      { workspaceCookie: [], ...csrf },
      { cookieAuth: [], ...csrf },
    ];
  if (path === "/realtime/ticket")
    return [
      { cookieAuth: [], ...csrf },
      { workspaceCookie: [], ...csrf },
    ];
  return [{ cookieAuth: [], ...csrf }];
}

const clean = (t) => t.replace(/`/g, "").replace(/\s+/g, " ").trim();
const ops = {};
let added = 0;
for (const line of contract.split("\n")) {
  const m = line.match(/^\| (GET|POST|PATCH|PUT|DELETE) (\/[^\s|]+) \| (.*?) \| (.*?) \|/);
  if (!m) continue;
  const [, method, rawPath, input, result] = m;
  for (const path0 of rawPath.split("|")) {
    const path = path0.replace(/:(\w+)/g, "{$1}");
    const key = `${method} ${path}`;
    if (
      existing.has(`${method} ${path.replace(/\{\w+\}/g, "*")}`) ||
      ops[path]?.[method.toLowerCase()] ||
      !routeExists(method, path)
    )
      continue;
    const status = (result.match(/^(\d{3})\b/) ?? [])[1] ?? "200";
    const params = [...path.matchAll(/\{(\w+)\}/g)].map((p) => ({
      name: p[1],
      in: "path",
      required: true,
      schema: { type: "string" },
    }));
    const op = {
      tags: [TAGS.find(([r]) => r.test(path))?.[1] ?? "System"],
      summary: clean(result).split(/[.;]/)[0].slice(0, 120),
      description: `Input: ${clean(input)}\n\nHasil: ${clean(result)}`,
      security: security(method, path),
      ...(params.length ? { parameters: params } : {}),
      responses: {
        [status]: { description: clean(result).slice(0, 300) },
        default: {
          description: "Error",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
      },
    };
    if (["POST", "PATCH", "PUT"].includes(method) && clean(input) !== "—") {
      const multipart = MULTIPART.some((r) => r.test(key));
      op.requestBody = {
        required: true,
        description: clean(input),
        content: multipart
          ? { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } }
          : { "application/json": { schema: { type: "object" } } },
      };
    }
    (ops[path] ??= {})[method.toLowerCase()] = op;
    added++;
  }
}

const out = `// Dibuat otomatis oleh scripts/generate-swagger-extra.mjs dari docs/api-contract.md. Jangan disunting manual.
export const extraTags = ${JSON.stringify(
  [...new Set(Object.values(ops).flatMap((p) => Object.values(p).flatMap((o) => o.tags)))].map((name) => ({ name })),
  null,
  2,
)};

export const extraPaths: Record<string, Record<string, unknown>> = ${JSON.stringify(ops, null, 2)};
`;
writeFileSync(join(backend, "src", "docs", "swagger-paths-extra.ts"), out);
console.log(`swagger-paths-extra.ts: ${added} operasi baru dari ${existing.size} yang sudah ada`);
