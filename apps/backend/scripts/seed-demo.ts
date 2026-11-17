/**
 * Idempotent demo data for Gatherly (participants, organizers, committee, admin).
 *
 * Every seeded document gets `demoSeed: true` and a deterministic `_id`, plus demo natural keys
 * (`demo.*` emails, `demo-*` slugs and usernames, `PNG-DEMO-*`, `GTH-DEMO-*`). Rerunning replaces
 * only those documents. `--reset` deletes only `demoSeed: true` documents before reseeding.
 *
 * The script never calls app services that queue emails or talk to Midtrans. It writes documents
 * directly in states the worker leaves alone (see docs/demo-data.md).
 *
 * Usage (from apps/backend):
 *   pnpm seed:demo --env-file=<path> --confirm-db=<db name> [--db=<db name>] [--reset]
 *     [--credentials-out=<path>] [--create-indexes]
 */
import { createHash, randomBytes } from "node:crypto";
import { chmod, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose, { Types, type Model } from "mongoose";
import { hashToken } from "../src/lib/crypto.js";
import { AuthChallenge, Session, User } from "../src/modules/auth/auth.models.js";
import { PasswordReset } from "../src/modules/account/account.models.js";
import { AdminAccount, AdminChallenge, AdminSession } from "../src/modules/admin/admin.models.js";
import { encryptTotpSecret } from "../src/modules/admin/totp.js";
import { OrganizerApplication } from "../src/modules/applications/application.models.js";
import { ScanLog } from "../src/modules/check-ins/scan-log.model.js";
import { CommitteeAssignment } from "../src/modules/committee/committee-assignment.model.js";
import { EventReport } from "../src/modules/event-reports/event-report.model.js";
import { Event, TicketType } from "../src/modules/events/event.models.js";
import { Order } from "../src/modules/orders/order.model.js";
import { orderPricing } from "../src/modules/orders/pricing.js";
import { Organizer } from "../src/modules/organizers/organizer.model.js";
import { BankAccount, Payout } from "../src/modules/payouts/payout.model.js";
import { Refund } from "../src/modules/refunds/refund.model.js";
import { SavedEvent } from "../src/modules/saved-events/saved-event.model.js";
import { Ticket } from "../src/modules/tickets/ticket.model.js";
import { WorkspaceAccount, WorkspaceSession } from "../src/modules/workspace/workspace.models.js";

const { values: args } = parseArgs({
  options: {
    reset: { type: "boolean", default: false },
    "env-file": { type: "string" },
    db: { type: "string" },
    "confirm-db": { type: "string" },
    "credentials-out": { type: "string" },
    "create-indexes": { type: "boolean", default: false },
  },
});
if (args["env-file"]) dotenv.config({ path: args["env-file"] });
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGODB_URI is required (pass --env-file or set it).");
if (!args["confirm-db"]) throw new Error("--confirm-db=<database name> is required.");
const credentialsOut = args["credentials-out"] ?? join(tmpdir(), "gatherly-demo-credentials.md");

const MARK = { demoSeed: true } as const;
const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;
const FAR_FUTURE = new Date("2099-12-31T00:00:00Z");
const now = new Date();
const at = (ms: number) => new Date(now.getTime() + ms);
/** Wall-clock time in WIB, `dayOffset` days from today. */
function wib(dayOffset: number, hour: number, minute = 0) {
  const offset = 7 * HOUR;
  const local = new Date(now.getTime() + offset);
  const dayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(dayStart + dayOffset * DAY + hour * HOUR + minute * MINUTE - offset);
}
/** Deterministic ObjectId so reruns replace the same documents instead of duplicating them. */
const oid = (key: string) =>
  new Types.ObjectId(
    createHash("sha256").update(`gatherly-demo:${key}`).digest("hex").slice(0, 24),
  );
const secret = () => randomBytes(12).toString("base64url");
const base32 = (bytes: Buffer) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  return (bits.match(/.{1,5}/g) ?? [])
    .map((chunk) => alphabet[parseInt(chunk.padEnd(5, "0"), 2)])
    .join("");
};

type AnyModel = Model<any, any, any, any, any, any, any>;
type Item = {
  model: AnyModel;
  doc: Record<string, any> & { _id: Types.ObjectId };
  unique: string[];
  extra?: Record<string, unknown>;
};
const plan: Item[] = [];
const add = (model: AnyModel, doc: Item["doc"], unique: string[] = [], extra?: Item["extra"]) => {
  plan.push({ model, doc, unique, extra });
  return doc;
};
const credentials: string[] = [];

// ---------------------------------------------------------------- participants
type Buyer = { key: string; id: Types.ObjectId; name: string; email: string };
const buyers: Record<string, Buyer> = {};
const participantSpecs = [
  { key: "budi", name: "Budi Santoso", phone: "+6281200000101" },
  { key: "sari", name: "Sari Wulandari", phone: "+6281200000102" },
  { key: "raka", name: "Raka Pratama", phone: "+6281200000103" },
  { key: "dimas", name: "Dimas Ardiansyah", phone: "+6281200000104" },
  { key: "nadia", name: "Nadia Putri", phone: "+6281200000105", googleOnly: true },
];
const participantRows: string[] = [];
for (const spec of participantSpecs) {
  const email = `demo.${spec.key}@gatherlyy.fun`;
  const password = spec.googleOnly ? undefined : secret();
  const user = add(
    User,
    {
      _id: oid(`user:${spec.key}`),
      name: `${spec.name} (Demo)`,
      emailNormalized: email,
      ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
      ...(spec.googleOnly ? { googleId: `demo-google-${spec.key}` } : {}),
      emailVerifiedAt: wib(-40, 10),
      phone: spec.phone,
      passwordFailures: 0,
      notifications: { reminders: false, recommendations: false },
      createdAt: wib(-40, 10),
      updatedAt: now,
    },
    ["emailNormalized", "googleId"],
  );
  buyers[spec.key] = { key: spec.key, id: user._id, name: user.name, email };
  participantRows.push(
    `| ${user.name} | \`${email}\` | ${password ? `\`${password}\`` : "Google only (no password, cannot log in)"} |`,
  );
}

// ---------------------------------------------------------------- organizers + workspace
const workspaceRows: string[] = [];
async function workspaceUser(username: string, name: string) {
  return add(
    User,
    {
      _id: oid(`user:ws:${username}`),
      name,
      emailNormalized: `demo.ws.${username}@workspace.invalid`,
      passwordFailures: 0,
      notifications: { reminders: false, recommendations: false },
      createdAt: wib(-30, 9),
      updatedAt: now,
    },
    ["emailNormalized"],
  );
}
async function workspaceAccount(input: {
  username: string;
  name: string;
  role: "organizer" | "committee";
  userId: Types.ObjectId;
  organizerId: Types.ObjectId;
  email?: string;
  mustChangePassword?: boolean;
  active?: boolean;
  lastLoginAt?: Date;
  note: string;
}) {
  const password = secret();
  workspaceRows.push(`| \`${input.username}\` | ${input.role} | \`${password}\` | ${input.note} |`);
  return add(
    WorkspaceAccount,
    {
      _id: oid(`ws:${input.username}`),
      username: input.username,
      name: input.name,
      role: input.role,
      userId: input.userId,
      organizerId: input.organizerId,
      ...(input.email ? { email: input.email } : {}),
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePassword: input.mustChangePassword ?? false,
      ...(input.mustChangePassword ? { temporaryExpiresAt: at(7 * DAY) } : {}),
      active: input.active ?? true,
      ...(input.lastLoginAt ? { lastLoginAt: input.lastLoginAt } : {}),
      failures: 0,
      createdAt: wib(-30, 9),
      updatedAt: now,
    },
    ["username", "userId"],
  );
}

const lensaOwner = await workspaceUser("demo-lensa", "Laras Hapsari (Demo)");
const lensa = add(
  Organizer,
  {
    _id: oid("org:lensa"),
    ownerId: lensaOwner._id,
    name: "Kolektif Lensa Kota (Demo)",
    description:
      "Penyelenggara demo Gatherly. Kolektif fotografi dan musik independen di Yogyakarta. Semua acara dari akun ini adalah data contoh, bukan acara sungguhan.",
    contactEmail: "demo.lensa@gatherlyy.fun",
    username: "demo-lensa",
    city: "Kota Yogyakarta",
    links: [{ type: "website", url: "https://gatherlyy.fun" }],
    status: "active",
    applicationNumber: "PNG-DEMO-0004",
    pic: {
      name: "Laras Hapsari",
      role: "Koordinator",
      email: "demo.lensa@gatherlyy.fun",
      phone: "+6281200000201",
    },
    createdAt: wib(-30, 9),
    updatedAt: now,
  },
  ["ownerId", "username"],
);
await workspaceAccount({
  username: "demo-lensa",
  name: "Laras Hapsari (Demo)",
  role: "organizer",
  userId: lensaOwner._id,
  organizerId: lensa._id,
  email: "demo.lensa@gatherlyy.fun",
  lastLoginAt: wib(-1, 20),
  note: "Organizer aktif (Kolektif Lensa Kota)",
});

const rakitOwner = await workspaceUser("demo-rakit", "Gilang Ramadhan (Demo)");
const rakit = add(
  Organizer,
  {
    _id: oid("org:rakit"),
    ownerId: rakitOwner._id,
    name: "Ruang Rakit Studio (Demo)",
    description:
      "Penyelenggara demo Gatherly untuk pasar kriya di Bandung. Akun ini sengaja dibekukan untuk contoh tampilan organizer beku.",
    contactEmail: "demo.rakit@gatherlyy.fun",
    username: "demo-rakit",
    city: "Kota Bandung",
    links: [],
    status: "frozen",
    frozenReason: "Demo: akun dibekukan sementara karena dokumen legal perlu diperbarui.",
    pic: {
      name: "Gilang Ramadhan",
      role: "Pemilik",
      email: "demo.rakit@gatherlyy.fun",
      phone: "+6281200000202",
    },
    createdAt: wib(-60, 9),
    updatedAt: now,
  },
  ["ownerId", "username"],
);
await workspaceAccount({
  username: "demo-rakit",
  name: "Gilang Ramadhan (Demo)",
  role: "organizer",
  userId: rakitOwner._id,
  organizerId: rakit._id,
  email: "demo.rakit@gatherlyy.fun",
  lastLoginAt: wib(-8, 11),
  note: "Organizer dibekukan (hanya bisa melihat, tidak bisa mengubah)",
});

add(
  BankAccount,
  {
    _id: oid("bank:lensa"),
    organizerId: lensa._id,
    bank: "BCA",
    accountNumber: "8800012345",
    holderName: "Kolektif Lensa Kota (Demo)",
    createdAt: wib(-29, 9),
    updatedAt: wib(-29, 9),
  },
  ["organizerId"],
);
add(
  BankAccount,
  {
    _id: oid("bank:rakit"),
    organizerId: rakit._id,
    bank: "Mandiri",
    accountNumber: "1300009876543",
    holderName: "Ruang Rakit Studio (Demo)",
    createdAt: wib(-59, 9),
    updatedAt: wib(-59, 9),
  },
  ["organizerId"],
);

// Committee accounts of Kolektif Lensa Kota.
const gate1User = await workspaceUser("demo-lensa-gerbang1", "Yoga Prasetyo (Demo)");
const gate2User = await workspaceUser("demo-lensa-gerbang2", "Intan Maharani (Demo)");
const gate3User = await workspaceUser("demo-lensa-gerbang3", "Fajar Nugroho (Demo)");
await workspaceAccount({
  username: "demo-lensa-gerbang1",
  name: "Yoga Prasetyo (Demo)",
  role: "committee",
  userId: gate1User._id,
  organizerId: lensa._id,
  lastLoginAt: wib(-1, 10),
  note: "Panitia aktif, ditugaskan ke pameran (check-in terbuka) dan festival kuliner",
});
await workspaceAccount({
  username: "demo-lensa-gerbang2",
  name: "Intan Maharani (Demo)",
  role: "committee",
  userId: gate2User._id,
  organizerId: lensa._id,
  mustChangePassword: true,
  note: "Panitia belum pernah login (password sementara berlaku 7 hari)",
});
await workspaceAccount({
  username: "demo-lensa-gerbang3",
  name: "Fajar Nugroho (Demo)",
  role: "committee",
  userId: gate3User._id,
  organizerId: lensa._id,
  active: false,
  lastLoginAt: wib(-20, 10),
  note: "Panitia dinonaktifkan (login ditolak)",
});

// ---------------------------------------------------------------- admin
const adminPassword = secret() + secret();
const totpSecret = base32(randomBytes(20));
const backupCodes = Array.from({ length: 8 }, () => randomBytes(5).toString("hex"));
const adminEmail = "demo.admin@gatherlyy.fun";
const admin = add(
  AdminAccount,
  {
    _id: oid("admin:demo"),
    email: adminEmail,
    name: "Admin Demo",
    passwordHash: await bcrypt.hash(adminPassword, 12),
    totpSecretEncrypted: encryptTotpSecret(totpSecret),
    backupCodeHashes: backupCodes.map(hashToken),
    active: true,
    primary: false,
    failures: 0,
    createdAt: wib(-30, 8),
    updatedAt: now,
  },
  ["email"],
);

// ---------------------------------------------------------------- organizer applications
const appBase = (n: number, status: string) => ({
  _id: oid(`app:${n}`),
  number: `PNG-DEMO-000${n}`,
  status,
  links: [{ type: "website", url: "https://gatherlyy.fun" }],
  version: 0,
  flags: [] as Array<{ field: string; note: string }>,
});
add(
  OrganizerApplication,
  {
    ...appBase(1, "new"),
    organizerName: "Komunitas Lari Senja (Demo)",
    organizerType: "komunitas",
    description:
      "Komunitas lari sore di Semarang yang ingin menjual tiket fun run bulanan. Pengajuan contoh untuk demo.",
    address: {
      province: "Jawa Tengah",
      city: "Kota Semarang",
      street: "Jl. Pahlawan No. 10",
      postalCode: "50241",
    },
    pic: {
      name: "Ayu Lestari",
      role: "Ketua",
      email: "demo.pic.larisenja@gatherlyy.fun",
      phone: "+6281200000301",
    },
    username: "demo-lari-senja",
    activeEmail: "demo.pic.larisenja@gatherlyy.fun",
    submittedAt: at(-1 * DAY),
    emailVerifiedAt: at(-1 * DAY + HOUR),
    createdAt: at(-1 * DAY),
    updatedAt: at(-1 * DAY + HOUR),
  },
  ["number", "activeEmail"],
);
add(
  OrganizerApplication,
  {
    ...appBase(2, "needs_fix"),
    organizerName: "Himpunan Mahasiswa Desain (Demo)",
    organizerType: "organisasi_kampus",
    description: "Himpunan mahasiswa desain komunikasi visual. Pengajuan contoh untuk demo.",
    address: {
      province: "Jawa Barat",
      city: "Kota Bandung",
      street: "Jl. Ganesa No. 10",
      postalCode: "40132",
    },
    pic: {
      name: "Rizky Maulana",
      role: "Ketua Himpunan",
      email: "demo.pic.himades@gatherlyy.fun",
      phone: "+6281200000302",
    },
    username: "demo-himades",
    activeEmail: "demo.pic.himades@gatherlyy.fun",
    submittedAt: at(-6 * DAY),
    emailVerifiedAt: at(-6 * DAY + HOUR),
    fixDeadline: at(12 * DAY),
    flags: [
      {
        field: "legalDocument",
        note: "Surat keterangan organisasi belum ditandatangani pembina.",
      },
    ],
    version: 1,
    createdAt: at(-6 * DAY),
    updatedAt: at(-2 * DAY),
  },
  ["number", "activeEmail"],
);
add(
  OrganizerApplication,
  {
    ...appBase(3, "fix_submitted"),
    organizerName: "PT Gema Nusantara Kreatif (Demo)",
    organizerType: "perusahaan",
    description:
      "Event organizer konser skala menengah di Surabaya dengan pengalaman lima tahun. Deskripsi sudah diperbarui sesuai permintaan admin.",
    address: {
      province: "Jawa Timur",
      city: "Kota Surabaya",
      street: "Jl. Tunjungan No. 45",
      postalCode: "60261",
    },
    pic: {
      name: "Hendra Wijaya",
      role: "Direktur",
      email: "demo.pic.gemanusantara@gatherlyy.fun",
      phone: "+6281200000303",
    },
    username: "demo-gema-nusantara",
    activeEmail: "demo.pic.gemanusantara@gatherlyy.fun",
    submittedAt: at(-10 * DAY),
    emailVerifiedAt: at(-10 * DAY + HOUR),
    fixDeadline: at(4 * DAY),
    flags: [{ field: "description", note: "Jelaskan jenis acara dan pengalaman penyelenggaraan." }],
    previousValues: { description: "Event organizer di Surabaya." },
    version: 2,
    createdAt: at(-10 * DAY),
    updatedAt: at(-1 * DAY),
  },
  ["number", "activeEmail"],
);
add(
  OrganizerApplication,
  {
    ...appBase(4, "approved"),
    organizerName: "Kolektif Lensa Kota (Demo)",
    organizerType: "komunitas",
    description: lensa.description,
    address: {
      province: "DI Yogyakarta",
      city: "Kota Yogyakarta",
      street: "Jl. Tirtodipuran No. 3",
      postalCode: "55143",
    },
    pic: lensa.pic,
    username: "demo-lensa",
    submittedAt: wib(-33, 9),
    emailVerifiedAt: wib(-33, 10),
    decidedAt: wib(-30, 9),
    documentsExpireAt: wib(60, 9),
    version: 1,
    createdAt: wib(-33, 9),
    updatedAt: wib(-30, 9),
  },
  ["number"],
);
add(
  OrganizerApplication,
  {
    ...appBase(5, "rejected"),
    organizerName: "Bazar Kilat Untung (Demo)",
    organizerType: "individu",
    description: "Bazar dadakan dengan hadiah undian berbayar. Pengajuan contoh yang ditolak.",
    address: {
      province: "DKI Jakarta",
      city: "Kota Jakarta Barat",
      street: "Jl. Contoh No. 1",
      postalCode: "11410",
    },
    pic: {
      name: "Tono Saputra",
      role: "Pemilik",
      email: "demo.pic.bazarkilat@gatherlyy.fun",
      phone: "+6281200000305",
    },
    username: "demo-bazar-kilat",
    submittedAt: at(-9 * DAY),
    emailVerifiedAt: at(-9 * DAY + HOUR),
    rejectionReason: "Demo: acara mengandung undian berbayar yang tidak diizinkan di Gatherly.",
    decidedAt: at(-5 * DAY),
    documentsExpireAt: at(85 * DAY),
    version: 1,
    createdAt: at(-9 * DAY),
    updatedAt: at(-5 * DAY),
  },
  ["number"],
);

// ---------------------------------------------------------------- events
type TypeSpec = {
  key: string;
  name: string;
  description: string;
  price: number;
  capacity: number;
  salesStopped?: boolean;
  salesStartsAt?: Date;
  salesEndsAt?: Date;
};
type EventSpec = {
  key: string;
  organizer: typeof lensa;
  title: string;
  description: string;
  category: string;
  startsAt: Date;
  endsAt: Date;
  venueName: string;
  address: string;
  city: string;
  publicationStatus?: "draft" | "published" | "cancelled";
  extra?: Record<string, unknown>;
  performerLabel?: string;
  performers?: Array<{ name: string; note: string; time: string }>;
  types: TypeSpec[];
};
const defaultTerms = [
  "Ini acara demo Gatherly. Tiket tidak berlaku untuk acara sungguhan.",
  "Satu e-ticket berlaku untuk satu orang dan satu kali check-in.",
  "Tunjukkan QR e-ticket di pintu masuk.",
  "Refund diajukan paling lambat satu bulan sebelum acara. Biaya layanan tidak dikembalikan.",
];
const events: Record<string, any> = {};
const ticketTypes: Record<string, any> = {};
function addEvent(spec: EventSpec) {
  const event = add(
    Event,
    {
      _id: oid(`event:${spec.key}`),
      organizerId: spec.organizer._id,
      slug: `demo-${spec.key}`,
      title: `[DEMO] ${spec.title}`,
      description: `${spec.description}\n\nCatatan: ini acara demo untuk mencoba Gatherly. Jangan membeli tiket untuk menghadiri acara ini.`,
      category: spec.category,
      startsAt: spec.startsAt,
      endsAt: spec.endsAt,
      timezone: "Asia/Jakarta",
      venueName: spec.venueName,
      address: spec.address,
      city: spec.city,
      publicationStatus: spec.publicationStatus ?? "published",
      salesClosed: false,
      locationType: "offline",
      terms: defaultTerms,
      performerLabel: spec.performerLabel ?? "Penampil",
      performers: spec.performers ?? [],
      showRemaining: true,
      checkInOpensAt: new Date(spec.startsAt.getTime() - 2 * HOUR),
      checkInClosesAt: spec.endsAt,
      financialVersion: 0,
      checkoutVersion: 0,
      createdAt: wib(-28, 9),
      updatedAt: now,
      ...spec.extra,
    },
    ["slug"],
  );
  events[spec.key] = event;
  for (const type of spec.types)
    ticketTypes[`${spec.key}:${type.key}`] = add(TicketType, {
      _id: oid(`type:${spec.key}:${type.key}`),
      eventId: event._id,
      name: type.name,
      description: type.description,
      price: type.price,
      capacity: type.capacity,
      reserved: 0,
      sold: 0,
      salesStartsAt: type.salesStartsAt ?? wib(-25, 9),
      salesEndsAt: type.salesEndsAt ?? spec.startsAt,
      salesStopped: type.salesStopped ?? false,
      createdAt: wib(-28, 9),
      updatedAt: now,
    });
}

const jogja = {
  venueName: "Kedai Kebun Forum",
  address: "Jl. Tirtodipuran No. 3, Mantrijeron",
  city: "Kota Yogyakarta",
};
addEvent({
  key: "malam-akustik-jogja",
  organizer: lensa,
  title: "Malam Akustik Tirtodipuran",
  description:
    "Malam musik akustik di halaman kedai dengan tiga musisi independen Yogyakarta. Kursi lesehan dan teh hangat tersedia.",
  category: "Musik",
  startsAt: wib(45, 19),
  endsAt: wib(45, 23),
  ...jogja,
  performers: [
    { name: "Sore di Selatan", note: "Folk akustik", time: "19.30" },
    { name: "Nara Kinanti", note: "Penyanyi dan penulis lagu", time: "20.30" },
    { name: "Trio Angkringan", note: "Keroncong modern", time: "21.30" },
  ],
  types: [
    { key: "reguler", name: "Reguler", description: "Area lesehan", price: 85_000, capacity: 120 },
    {
      key: "vip",
      name: "VIP",
      description: "Kursi depan dan minuman",
      price: 175_000,
      capacity: 30,
    },
  ],
});
addEvent({
  key: "lokakarya-foto-analog",
  organizer: lensa,
  title: "Lokakarya Fotografi Analog untuk Pemula",
  description:
    "Belajar dasar kamera film, memilih rol, dan memotret di sekitar Prawirotaman. Termasuk satu rol film dan cuci cetak.",
  category: "Lokakarya",
  startsAt: wib(60, 9),
  endsAt: wib(60, 15),
  venueName: "Studio Lensa Kota",
  address: "Jl. Prawirotaman II No. 12, Mergangsan",
  city: "Kota Yogyakarta",
  performerLabel: "Pemateri",
  performers: [
    { name: "Laras Hapsari", note: "Fotografer dokumenter", time: "09.00" },
    { name: "Bima Adi", note: "Teknisi kamar gelap", time: "13.00" },
  ],
  types: [
    {
      key: "peserta",
      name: "Peserta",
      description: "Termasuk satu rol film",
      price: 150_000,
      capacity: 25,
    },
  ],
});
addEvent({
  key: "konser-senja-sold-out",
  organizer: lensa,
  title: "Konser Senja di Bukit Bintang",
  description:
    "Konser kecil saat matahari terbenam dengan kapasitas sangat terbatas. Tiket sudah habis.",
  category: "Musik",
  startsAt: wib(20, 16),
  endsAt: wib(20, 19),
  venueName: "Bukit Bintang Patuk",
  address: "Jl. Jogja-Wonosari Km 17, Patuk",
  city: "Kabupaten Gunungkidul",
  performers: [{ name: "Langit Jingga", note: "Indie pop", time: "17.00" }],
  types: [
    { key: "festival", name: "Festival", description: "Berdiri", price: 120_000, capacity: 6 },
  ],
});
addEvent({
  key: "pameran-seni-rupa",
  organizer: lensa,
  title: "Pameran Seni Rupa Ruang Antara",
  description:
    "Pameran karya dua puluh perupa muda selama satu minggu. Penjualan tiket dihentikan karena kuota harian sudah penuh, check-in sedang dibuka.",
  category: "Seni & Budaya",
  startsAt: wib(-1, 10),
  endsAt: wib(6, 21),
  venueName: "Galeri Ruang Antara",
  address: "Jl. Suryodiningratan No. 8, Mantrijeron",
  city: "Kota Yogyakarta",
  performerLabel: "Perupa",
  performers: [
    { name: "Kolektif Gambar Pagi", note: "Instalasi", time: "Sepanjang pameran" },
    { name: "Dewi Anggraini", note: "Lukisan", time: "Sepanjang pameran" },
  ],
  extra: { checkInOpensAt: wib(-1, 9), checkInClosesAt: wib(6, 21) },
  types: [
    {
      key: "harian",
      name: "Tiket Harian",
      description: "Masuk satu kali",
      price: 50_000,
      capacity: 200,
      salesStopped: true,
      salesEndsAt: wib(6, 21),
    },
  ],
});
addEvent({
  key: "meetup-teknologi-gratis",
  organizer: lensa,
  title: "Meetup Komunitas Web Jogja",
  description: "Meetup gratis untuk pengembang web: dua sesi berbagi dan sesi jejaring.",
  category: "Teknologi",
  startsAt: wib(10, 18, 30),
  endsAt: wib(10, 21),
  venueName: "Ruang Kolaborasi Kotabaru",
  address: "Jl. Suroto No. 2, Kotabaru",
  city: "Kota Yogyakarta",
  performerLabel: "Pembicara",
  performers: [
    { name: "Arif Rahman", note: "Membangun API yang tahan gangguan", time: "19.00" },
    { name: "Putri Ayu", note: "Aksesibilitas formulir", time: "19.45" },
  ],
  types: [{ key: "gratis", name: "Gratis", description: "Wajib daftar", price: 0, capacity: 80 }],
});
addEvent({
  key: "draft-kelas-menulis-lagu",
  organizer: lensa,
  title: "Kelas Menulis Lagu",
  description: "Draf acara yang belum dipublikasikan. Hanya terlihat di dasbor organizer.",
  category: "Lokakarya",
  startsAt: wib(90, 13),
  endsAt: wib(90, 17),
  ...jogja,
  publicationStatus: "draft",
  types: [
    {
      key: "peserta",
      name: "Peserta",
      description: "Kelas kecil",
      price: 100_000,
      capacity: 20,
      salesStartsAt: wib(30, 9),
    },
  ],
});
addEvent({
  key: "festival-kuliner-selesai",
  organizer: lensa,
  title: "Festival Kuliner Kampung Tirtodipuran",
  description: "Festival jajanan kampung yang sudah selesai. Dananya sudah dicairkan.",
  category: "Kuliner",
  startsAt: wib(-14, 16),
  endsAt: wib(-14, 22),
  ...jogja,
  types: [
    {
      key: "masuk",
      name: "Tiket Masuk",
      description: "Termasuk satu kupon",
      price: 35_000,
      capacity: 300,
    },
  ],
});
addEvent({
  key: "workshop-kopi-selesai",
  organizer: lensa,
  title: "Workshop Seduh Kopi Manual",
  description: "Workshop seduh manual yang sudah selesai. Pencairan dana sedang diajukan.",
  category: "Lokakarya",
  startsAt: wib(-7, 13),
  endsAt: wib(-7, 17),
  ...jogja,
  types: [
    {
      key: "peserta",
      name: "Peserta",
      description: "Termasuk biji kopi",
      price: 125_000,
      capacity: 20,
    },
  ],
});
addEvent({
  key: "lari-pagi-selesai",
  organizer: lensa,
  title: "Lari Pagi Keliling Benteng",
  description: "Fun run 5K yang sudah selesai. Dana siap diajukan untuk pencairan.",
  category: "Olahraga",
  startsAt: wib(-3, 5, 30),
  endsAt: wib(-3, 9),
  venueName: "Alun-Alun Selatan",
  address: "Jl. Alun-Alun Kidul, Kraton",
  city: "Kota Yogyakarta",
  types: [
    {
      key: "5k",
      name: "Pelari 5K",
      description: "Termasuk kaus dan medali",
      price: 75_000,
      capacity: 150,
    },
  ],
});
addEvent({
  key: "malam-jazz-dibatalkan",
  organizer: lensa,
  title: "Malam Jazz Tepi Pantai",
  description: "Acara ini dibatalkan. Pembeli menerima refund penuh termasuk biaya layanan.",
  category: "Musik",
  startsAt: wib(25, 19),
  endsAt: wib(25, 23),
  venueName: "Pantai Parangkusumo",
  address: "Jl. Parangtritis Km 27, Kretek",
  city: "Kabupaten Bantul",
  publicationStatus: "cancelled",
  extra: {
    salesClosed: true,
    cancellationStatus: "approved",
    cancellationReason: "Demo: venue tidak mendapat izin keramaian.",
    cancellationRequestedAt: at(-3 * DAY),
    cancellationDecidedAt: at(-2 * DAY),
    cancellationDecidedBy: admin._id,
    cancellationDecisionNote: "Demo: pembatalan disetujui, refund diproses otomatis.",
    checkoutVersion: 2,
    financialVersion: 4,
  },
  types: [
    { key: "reguler", name: "Reguler", description: "Area pasir", price: 95_000, capacity: 100 },
  ],
});
addEvent({
  key: "futsal-antarkampus-menunggu-batal",
  organizer: lensa,
  title: "Turnamen Futsal Antarkampus",
  description:
    "Turnamen futsal mahasiswa. Organizer sudah mengajukan pembatalan dan sedang menunggu keputusan admin.",
  category: "Olahraga",
  startsAt: wib(35, 8),
  endsAt: wib(35, 17),
  venueName: "GOR Universitas Contoh",
  address: "Jl. Kaliurang Km 5, Depok",
  city: "Kabupaten Sleman",
  extra: {
    cancellationStatus: "requested",
    cancellationReason: "Demo: GOR dipakai untuk kegiatan wisuda pada tanggal yang sama.",
    cancellationRequestedAt: at(-1 * DAY),
    checkoutVersion: 1,
    financialVersion: 1,
  },
  types: [
    {
      key: "penonton",
      name: "Penonton",
      description: "Tribun bebas",
      price: 25_000,
      capacity: 400,
    },
  ],
});
addEvent({
  key: "pasar-kriya-bandung",
  organizer: rakit,
  title: "Pasar Kriya Akhir Pekan",
  description:
    "Pasar kriya dari organizer yang sedang dibekukan. Acara ini tidak tampil di daftar publik selama organizer dibekukan.",
  category: "Seni & Budaya",
  startsAt: wib(15, 10),
  endsAt: wib(15, 18),
  venueName: "Taman Kriya Dago",
  address: "Jl. Ir. H. Juanda No. 100, Coblong",
  city: "Kota Bandung",
  types: [
    {
      key: "masuk",
      name: "Tiket Masuk",
      description: "Masuk sehari",
      price: 20_000,
      capacity: 500,
    },
  ],
});

// ---------------------------------------------------------------- orders + tickets
type OrderState = "paid" | "pending" | "expired" | "failed";
type TicketOverride = { status: "used"; by: Types.ObjectId; at: Date };
const orders: Record<string, any> = {};
const tickets: Record<string, any[]> = {};
let orderSeq = 0;
function addOrder(input: {
  key: string;
  event: string;
  type: string;
  buyer: string;
  attendees: Array<[string, string]>;
  state: OrderState;
  createdAt: Date;
  paymentMethod?: string;
  used?: Record<number, TicketOverride>;
}) {
  const event = events[input.event];
  const type = ticketTypes[`${input.event}:${input.type}`];
  const buyer = buyers[input.buyer]!;
  const quantity = input.attendees.length;
  const pricing = orderPricing(type.price, quantity);
  const free = type.price === 0;
  const createdAt = input.createdAt;
  const paidAt = new Date(createdAt.getTime() + 3 * MINUTE);
  const code = (++orderSeq).toString().padStart(4, "0");
  const snapshot = {
    slug: event.slug,
    endsAt: event.endsAt,
    title: event.title,
    startsAt: event.startsAt,
    timezone: event.timezone,
    venueName: event.venueName,
    address: event.address,
    city: event.city,
  };
  const state = {
    paid: {
      paymentStatus: "paid",
      reservationStatus: "converted",
      issuanceStatus: "issued",
      paymentSessionState: "closed",
      paidAt,
      issuanceAttempts: 1,
      paymentSessionAttempts: free ? 0 : 1,
      paymentTimeline: free
        ? []
        : [
            { status: "pending", at: createdAt },
            { status: "paid", at: paidAt },
          ],
      expiresAt: new Date(createdAt.getTime() + 15 * MINUTE),
    },
    pending: {
      paymentStatus: "pending",
      reservationStatus: "held",
      issuanceStatus: "not_ready",
      paymentSessionState: "not_started",
      issuanceAttempts: 0,
      paymentSessionAttempts: 0,
      paymentTimeline: [],
      expiresAt: new Date(createdAt.getTime() + 15 * MINUTE),
    },
    expired: {
      paymentStatus: "expired",
      reservationStatus: "released",
      issuanceStatus: "not_ready",
      paymentSessionState: "closed",
      issuanceAttempts: 0,
      paymentSessionAttempts: 1,
      paymentTimeline: [
        { status: "pending", at: createdAt },
        { status: "expired", at: new Date(createdAt.getTime() + 15 * MINUTE) },
      ],
      expiresAt: new Date(createdAt.getTime() + 15 * MINUTE),
    },
    failed: {
      paymentStatus: "failed",
      reservationStatus: "released",
      issuanceStatus: "not_ready",
      paymentSessionState: "closed",
      issuanceAttempts: 0,
      paymentSessionAttempts: 0,
      paymentTimeline: [],
      cancelledAt: new Date(createdAt.getTime() + 2 * MINUTE),
      cancelledBy: "buyer",
      expiresAt: new Date(createdAt.getTime() + 15 * MINUTE),
    },
  }[input.state];
  const order = add(
    Order,
    {
      _id: oid(`order:${input.key}`),
      buyerId: buyer.id,
      eventId: event._id,
      ticketTypeId: type._id,
      orderCode: `GTH-DEMO-${code}`,
      providerOrderId: `gatherly-demo-${input.key}`,
      quantity,
      attendees: input.attendees.map(([name, email]) => ({ name, email })),
      unitPrice: type.price,
      ...pricing,
      refundedAmount: 0,
      refundedBaseAmount: 0,
      refundStatus: "none",
      currency: "IDR",
      eventSnapshot: snapshot,
      ticketTypeSnapshot: { name: type.name, unitPrice: type.price },
      buyerSnapshot: { name: buyer.name, email: buyer.email },
      ...(input.state === "paid" && !free ? { paymentMethod: input.paymentMethod ?? "qris" } : {}),
      contactPhone: "+6281200000100",
      idempotencyKey: `demo-${input.key}`,
      requestHash: hashToken(`demo-${input.key}`),
      // Pending orders are first reconciled after expiry, so the worker expires them locally
      // without calling Midtrans.
      nextReconcileAt: state.expiresAt,
      reconcileMisses: 0,
      reconciliationRequired: false,
      createdAt,
      updatedAt: input.state === "paid" ? paidAt : createdAt,
      ...state,
    },
    ["orderCode", "providerOrderId"],
    // The worker's repairTicketEmails() queues e-ticket emails for issued orders without this.
    input.state === "paid" ? { ticketEmailQueuedAt: paidAt } : undefined,
  );
  orders[input.key] = order;
  if (input.state === "pending") type.reserved += quantity;
  if (input.state !== "paid") return;
  type.sold += quantity;
  tickets[input.key] = input.attendees.map(([name, email], sequence) => {
    const used = input.used?.[sequence];
    return add(
      Ticket,
      {
        _id: oid(`ticket:${input.key}:${sequence}`),
        orderId: order._id,
        eventId: event._id,
        buyerId: buyer.id,
        ticketTypeId: type._id,
        sequence,
        attendeeName: name,
        attendeeEmail: email,
        ticketCode: `GTH-T-DEMO${code}${sequence}`,
        qrToken: randomBytes(32).toString("base64url"),
        checkInStatus: used ? "used" : "unused",
        ...(used ? { checkedInAt: used.at, checkedInBy: used.by } : {}),
        eventSnapshot: snapshot,
        ticketTypeSnapshot: { name: type.name },
        createdAt: paidAt,
        updatedAt: used?.at ?? paidAt,
      },
      ["ticketCode", "qrToken"],
    );
  });
}
const b = (key: string): [string, string] => [buyers[key]!.name, buyers[key]!.email];
const guest = (name: string, host: string): [string, string] => [name, buyers[host]!.email];
const ago = (days: number, hours = 0) => at(-days * DAY - hours * HOUR);
const gate = (when: Date): TicketOverride => ({ status: "used", by: gate1User._id, at: when });

// Malam Akustik: upcoming, on sale.
addOrder({
  key: "akustik-budi",
  event: "malam-akustik-jogja",
  type: "reguler",
  buyer: "budi",
  attendees: [b("budi"), guest("Rina Kusuma", "budi")],
  state: "paid",
  createdAt: ago(9),
});
addOrder({
  key: "akustik-sari",
  event: "malam-akustik-jogja",
  type: "vip",
  buyer: "sari",
  attendees: [b("sari")],
  state: "paid",
  createdAt: ago(8),
  paymentMethod: "gopay",
});
addOrder({
  key: "akustik-nadia",
  event: "malam-akustik-jogja",
  type: "reguler",
  buyer: "nadia",
  attendees: [b("nadia")],
  state: "paid",
  createdAt: ago(7),
});
addOrder({
  key: "akustik-raka-pending",
  event: "malam-akustik-jogja",
  type: "reguler",
  buyer: "raka",
  attendees: [b("raka")],
  state: "pending",
  createdAt: now,
});
addOrder({
  key: "akustik-raka-expired",
  event: "malam-akustik-jogja",
  type: "reguler",
  buyer: "raka",
  attendees: [b("raka"), guest("Teguh Wibowo", "raka")],
  state: "expired",
  createdAt: ago(3),
});
addOrder({
  key: "akustik-dimas-failed",
  event: "malam-akustik-jogja",
  type: "vip",
  buyer: "dimas",
  attendees: [b("dimas")],
  state: "failed",
  createdAt: ago(2),
});
// Lokakarya: upcoming, refunds in several states.
addOrder({
  key: "foto-nadia",
  event: "lokakarya-foto-analog",
  type: "peserta",
  buyer: "nadia",
  attendees: [b("nadia")],
  state: "paid",
  createdAt: ago(12),
  paymentMethod: "credit_card",
});
addOrder({
  key: "foto-dimas",
  event: "lokakarya-foto-analog",
  type: "peserta",
  buyer: "dimas",
  attendees: [b("dimas"), guest("Wulan Sari", "dimas")],
  state: "paid",
  createdAt: ago(11),
});
addOrder({
  key: "foto-budi",
  event: "lokakarya-foto-analog",
  type: "peserta",
  buyer: "budi",
  attendees: [b("budi")],
  state: "paid",
  createdAt: ago(10),
});
// Konser Senja: sold out (6 of 6).
for (const key of ["budi", "sari", "raka"])
  addOrder({
    key: `senja-${key}`,
    event: "konser-senja-sold-out",
    type: "festival",
    buyer: key,
    attendees: [b(key), guest(`Teman ${buyers[key]!.name.split(" ")[0]}`, key)],
    state: "paid",
    createdAt: ago(15),
  });
// Pameran: running now, check-in open, sales stopped.
addOrder({
  key: "pameran-budi",
  event: "pameran-seni-rupa",
  type: "harian",
  buyer: "budi",
  attendees: [b("budi")],
  state: "paid",
  createdAt: ago(6),
  used: { 0: gate(wib(-1, 11)) },
});
addOrder({
  key: "pameran-sari",
  event: "pameran-seni-rupa",
  type: "harian",
  buyer: "sari",
  attendees: [b("sari"), guest("Andi Saputra", "sari")],
  state: "paid",
  createdAt: ago(5),
});
addOrder({
  key: "pameran-dimas",
  event: "pameran-seni-rupa",
  type: "harian",
  buyer: "dimas",
  attendees: [b("dimas")],
  state: "paid",
  createdAt: ago(4),
});
// Meetup: free tickets.
addOrder({
  key: "meetup-raka",
  event: "meetup-teknologi-gratis",
  type: "gratis",
  buyer: "raka",
  attendees: [b("raka")],
  state: "paid",
  createdAt: ago(3),
});
addOrder({
  key: "meetup-nadia",
  event: "meetup-teknologi-gratis",
  type: "gratis",
  buyer: "nadia",
  attendees: [b("nadia"), guest("Kevin Hartono", "nadia")],
  state: "paid",
  createdAt: ago(2),
});
// Festival Kuliner: ended, payout transferred.
const kuliner = (h: number, m: number) => wib(-14, h, m);
addOrder({
  key: "kuliner-budi",
  event: "festival-kuliner-selesai",
  type: "masuk",
  buyer: "budi",
  attendees: [b("budi"), guest("Rina Kusuma", "budi")],
  state: "paid",
  createdAt: ago(25),
  used: { 0: gate(kuliner(16, 12)), 1: gate(kuliner(16, 13)) },
});
addOrder({
  key: "kuliner-sari",
  event: "festival-kuliner-selesai",
  type: "masuk",
  buyer: "sari",
  attendees: [b("sari")],
  state: "paid",
  createdAt: ago(24),
  used: { 0: gate(kuliner(17, 5)) },
});
addOrder({
  key: "kuliner-dimas",
  event: "festival-kuliner-selesai",
  type: "masuk",
  buyer: "dimas",
  attendees: [b("dimas"), guest("Wulan Sari", "dimas"), guest("Eko Prasetyo", "dimas")],
  state: "paid",
  createdAt: ago(22),
  used: { 0: gate(kuliner(18, 40)), 1: gate(kuliner(18, 41)) },
});
// Workshop Kopi: ended, payout requested.
addOrder({
  key: "kopi-raka",
  event: "workshop-kopi-selesai",
  type: "peserta",
  buyer: "raka",
  attendees: [b("raka")],
  state: "paid",
  createdAt: ago(20),
  used: { 0: gate(wib(-7, 12, 50)) },
});
addOrder({
  key: "kopi-nadia",
  event: "workshop-kopi-selesai",
  type: "peserta",
  buyer: "nadia",
  attendees: [b("nadia"), guest("Kevin Hartono", "nadia")],
  state: "paid",
  createdAt: ago(18),
  used: { 0: gate(wib(-7, 12, 55)), 1: gate(wib(-7, 12, 56)) },
});
// Lari Pagi: ended, balance available for payout.
addOrder({
  key: "lari-budi",
  event: "lari-pagi-selesai",
  type: "5k",
  buyer: "budi",
  attendees: [b("budi")],
  state: "paid",
  createdAt: ago(16),
  used: { 0: gate(wib(-3, 5, 5)) },
});
addOrder({
  key: "lari-sari",
  event: "lari-pagi-selesai",
  type: "5k",
  buyer: "sari",
  attendees: [b("sari")],
  state: "paid",
  createdAt: ago(15),
  used: { 0: gate(wib(-3, 5, 10)) },
});
addOrder({
  key: "lari-dimas",
  event: "lari-pagi-selesai",
  type: "5k",
  buyer: "dimas",
  attendees: [b("dimas"), guest("Eko Prasetyo", "dimas")],
  state: "paid",
  createdAt: ago(14),
  used: { 0: gate(wib(-3, 5, 12)) },
});
// Malam Jazz: cancelled event with refunds.
addOrder({
  key: "jazz-sari",
  event: "malam-jazz-dibatalkan",
  type: "reguler",
  buyer: "sari",
  attendees: [b("sari"), guest("Andi Saputra", "sari")],
  state: "paid",
  createdAt: ago(10),
  paymentMethod: "gopay",
});
addOrder({
  key: "jazz-raka",
  event: "malam-jazz-dibatalkan",
  type: "reguler",
  buyer: "raka",
  attendees: [b("raka")],
  state: "paid",
  createdAt: ago(9),
  paymentMethod: "bank_transfer",
});
// Futsal: cancellation awaiting admin review.
addOrder({
  key: "futsal-dimas",
  event: "futsal-antarkampus-menunggu-batal",
  type: "penonton",
  buyer: "dimas",
  attendees: [b("dimas"), guest("Wulan Sari", "dimas")],
  state: "paid",
  createdAt: ago(6),
});

// ---------------------------------------------------------------- refunds
function addRefund(input: {
  key: string;
  order: string;
  sequences: number[];
  kind: "buyer" | "event_cancelled";
  status: "requested" | "approved" | "rejected" | "refunded" | "manual_required";
  reason: string;
  requestedAt: Date;
  decisionNote?: string;
}) {
  const order = orders[input.order];
  const id = oid(`refund:${input.key}`);
  const selected = input.sequences.map((s) => tickets[input.order]![s]);
  const amount =
    input.kind === "buyer"
      ? order.unitPrice * selected.length
      : order.totalAmount - order.refundedAmount;
  const baseAmount =
    input.kind === "buyer" ? amount : order.subtotalAmount - order.refundedBaseAmount;
  const decided = input.status !== "requested";
  const decidedAt = new Date(input.requestedAt.getTime() + DAY);
  const refundedAt = new Date(decidedAt.getTime() + 2 * HOUR);
  const cancelsTickets = ["approved", "refunded", "manual_required"].includes(input.status);
  for (const ticket of selected)
    if (cancelsTickets)
      Object.assign(ticket, {
        checkInStatus: "cancelled",
        cancelledAt: decidedAt,
        cancellationReason: input.reason,
        refundId: id,
        updatedAt: decidedAt,
      });
  if (input.status === "refunded") {
    order.refundedAmount += amount;
    order.refundedBaseAmount += baseAmount;
    order.refundStatus = order.refundedBaseAmount >= order.subtotalAmount ? "full" : "partial";
    order.paymentTimeline = [...order.paymentTimeline, { status: "refunded", at: refundedAt }];
    order.updatedAt = refundedAt;
  }
  add(
    Refund,
    {
      _id: id,
      orderId: order._id,
      eventId: order.eventId,
      buyerId: order.buyerId,
      ticketIds: selected.map((t) => t._id),
      reason: input.reason,
      kind: input.kind,
      status: input.status,
      amount,
      baseAmount,
      refundKey: `gth-${id}`,
      ...(decided
        ? { decidedBy: admin._id, decidedAt, decisionNote: input.decisionNote ?? "" }
        : {}),
      ...(input.status === "refunded"
        ? { refundedAt, transferReference: `gth-${id}`, attempts: 1, firstAttemptAt: decidedAt }
        : {}),
      ...(input.status === "manual_required"
        ? {
            attempts: 1,
            firstAttemptAt: decidedAt,
            lastError: "Provider does not support this refund method/amount.",
          }
        : {}),
      // Approved refunds are parked so the worker never sends them to Midtrans.
      nextAttemptAt:
        input.status === "approved" ? FAR_FUTURE : decided ? decidedAt : input.requestedAt,
      createdAt: input.requestedAt,
      updatedAt: input.status === "refunded" ? refundedAt : decided ? decidedAt : input.requestedAt,
    },
    ["refundKey"],
  );
}
addRefund({
  key: "akustik-budi-partial",
  order: "akustik-budi",
  sequences: [1],
  kind: "buyer",
  status: "refunded",
  reason: "Teman saya batal ikut.",
  requestedAt: ago(6),
  decisionNote: "Demo: disetujui.",
});
addRefund({
  key: "akustik-sari-requested",
  order: "akustik-sari",
  sequences: [0],
  kind: "buyer",
  status: "requested",
  reason: "Bentrok dengan jadwal kerja.",
  requestedAt: ago(1),
});
addRefund({
  key: "foto-nadia-full",
  order: "foto-nadia",
  sequences: [0],
  kind: "buyer",
  status: "refunded",
  reason: "Sedang di luar kota pada tanggal acara.",
  requestedAt: ago(8),
  decisionNote: "Demo: disetujui.",
});
addRefund({
  key: "foto-dimas-approved",
  order: "foto-dimas",
  sequences: [0, 1],
  kind: "buyer",
  status: "approved",
  reason: "Jadwal kuliah berubah.",
  requestedAt: ago(3),
  decisionNote: "Demo: disetujui, menunggu transfer.",
});
addRefund({
  key: "foto-budi-rejected",
  order: "foto-budi",
  sequences: [0],
  kind: "buyer",
  status: "rejected",
  reason: "Ingin ganti ke kelas lain.",
  requestedAt: ago(5),
  decisionNote: "Demo: alasan tidak termasuk kebijakan refund penyelenggara.",
});
addRefund({
  key: "jazz-sari-cancelled",
  order: "jazz-sari",
  sequences: [0, 1],
  kind: "event_cancelled",
  status: "refunded",
  reason: "Demo: venue tidak mendapat izin keramaian.",
  requestedAt: ago(2),
});
addRefund({
  key: "jazz-raka-manual",
  order: "jazz-raka",
  sequences: [0],
  kind: "event_cancelled",
  status: "manual_required",
  reason: "Demo: venue tidak mendapat izin keramaian.",
  requestedAt: ago(2),
});

// ---------------------------------------------------------------- check-in logs + committee
for (const [orderKey, list] of Object.entries(tickets))
  for (const ticket of list)
    if (ticket.checkInStatus === "used")
      add(ScanLog, {
        _id: oid(`scan:${orderKey}:${ticket.sequence}`),
        eventId: ticket.eventId,
        actorId: gate1User._id,
        ticketId: ticket._id,
        ticketCode: ticket.ticketCode,
        attendeeName: ticket.attendeeName,
        ticketTypeName: ticket.ticketTypeSnapshot.name,
        method: "scan",
        accepted: true,
        code: "CHECKED_IN",
        createdAt: ticket.checkedInAt,
      });
const reused = tickets["pameran-budi"]![0];
add(ScanLog, {
  _id: oid("scan:pameran-budi:duplicate"),
  eventId: reused.eventId,
  actorId: gate1User._id,
  ticketId: reused._id,
  ticketCode: reused.ticketCode,
  attendeeName: reused.attendeeName,
  ticketTypeName: reused.ticketTypeSnapshot.name,
  method: "manual",
  accepted: false,
  code: "TICKET_ALREADY_USED",
  createdAt: new Date(reused.checkedInAt.getTime() + 20 * MINUTE),
});
const assignments: Array<[typeof gate1User, string]> = [
  [gate1User, "pameran-seni-rupa"],
  [gate1User, "festival-kuliner-selesai"],
  [gate1User, "workshop-kopi-selesai"],
  [gate1User, "lari-pagi-selesai"],
  [gate2User, "malam-akustik-jogja"],
  [gate3User, "konser-senja-sold-out"],
];
for (const [user, eventKey] of assignments)
  add(CommitteeAssignment, {
    _id: oid(`assign:${user._id}:${eventKey}`),
    eventId: events[eventKey]._id,
    userId: user._id,
    assignedBy: lensaOwner._id,
    checkInVersion: 0,
    createdAt: wib(-20, 9),
    updatedAt: wib(-20, 9),
  });

// ---------------------------------------------------------------- payouts
const balance = (eventKey: string) =>
  Object.values(orders)
    .filter((o) => o.eventId.equals(events[eventKey]._id) && o.paymentStatus === "paid")
    .reduce((sum, o) => sum + Math.max(0, o.subtotalAmount - o.refundedBaseAmount), 0);
const payoutBase = (eventKey: string) => ({
  _id: oid(`payout:${eventKey}`),
  organizerId: lensa._id,
  eventId: events[eventKey]._id,
  amount: balance(eventKey),
  bank: "BCA",
  accountNumber: "8800012345",
  holderName: "Kolektif Lensa Kota (Demo)",
});
add(
  Payout,
  {
    ...payoutBase("festival-kuliner-selesai"),
    status: "transferred",
    requestedAt: wib(-12, 10),
    transferredAt: wib(-10, 14),
    transferReference: "DEMO-TRF-20260001",
    transferredBy: admin._id,
    createdAt: wib(-12, 10),
    updatedAt: wib(-10, 14),
  },
  ["eventId"],
);
add(
  Payout,
  {
    ...payoutBase("workshop-kopi-selesai"),
    status: "requested",
    requestedAt: wib(-5, 9),
    createdAt: wib(-5, 9),
    updatedAt: wib(-5, 9),
  },
  ["eventId"],
);

// ---------------------------------------------------------------- saved events + reports
const saved: Array<[string, string]> = [
  ["budi", "malam-akustik-jogja"],
  ["budi", "lokakarya-foto-analog"],
  ["budi", "konser-senja-sold-out"],
  ["sari", "pameran-seni-rupa"],
  ["nadia", "meetup-teknologi-gratis"],
  ["raka", "malam-akustik-jogja"],
];
for (const [buyer, eventKey] of saved)
  add(SavedEvent, {
    _id: oid(`saved:${buyer}:${eventKey}`),
    userId: buyers[buyer]!.id,
    eventId: events[eventKey]._id,
    createdAt: ago(5),
    updatedAt: ago(5),
  });
add(EventReport, {
  _id: oid("report:open"),
  eventId: events["konser-senja-sold-out"]._id,
  organizerId: lensa._id,
  reporterId: buyers.dimas!.id,
  eventTitle: events["konser-senja-sold-out"].title,
  organizerName: lensa.name,
  reason: "wrong_info",
  note: "Demo: jam mulai di poster berbeda dengan yang tertulis di halaman acara.",
  status: "new",
  createdAt: ago(1),
  updatedAt: ago(1),
});
add(EventReport, {
  _id: oid("report:closed"),
  eventId: events["lari-pagi-selesai"]._id,
  organizerId: lensa._id,
  reporterId: buyers.sari!.id,
  eventTitle: events["lari-pagi-selesai"].title,
  organizerName: lensa.name,
  reason: "other",
  note: "Demo: rute lari tidak sesuai peta yang dibagikan.",
  status: "done",
  resolutionNote: "Demo: organizer sudah mengirim peta rute yang benar ke semua peserta.",
  closedBy: admin._id.toString(),
  closedAt: ago(2),
  createdAt: ago(3),
  updatedAt: ago(2),
});

// ---------------------------------------------------------------- write
// The worker scans cancelled events every second and creates refunds for paid orders that lack
// one. Events are therefore deleted first and written last, so a cancelled demo event never
// exists while its orders or refunds are missing.
const models = [Event, ...new Set(plan.map((item) => item.model).filter((m) => m !== Event))];
const writeOrder = [
  ...plan.filter((item) => item.model !== Event),
  ...plan.filter((item) => item.model === Event),
];
const demoUserIds = plan.filter((i) => i.model === User).map((i) => i.doc._id);
const demoAccountIds = plan.filter((i) => i.model === WorkspaceAccount).map((i) => i.doc._id);
const demoEventIds = Object.values(events).map((e) => e._id);
const read = (doc: Record<string, any>, path: string) =>
  path.split(".").reduce<any>((value, key) => value?.[key], doc);

await mongoose.connect(mongoUri, {
  ...(args.db ? { dbName: args.db } : {}),
  autoIndex: false,
  serverSelectionTimeoutMS: 15_000,
});
try {
  const dbName = mongoose.connection.db?.databaseName;
  if (dbName !== args["confirm-db"])
    throw new Error(`Connected to "${dbName}", but --confirm-db is "${args["confirm-db"]}".`);
  console.info(`Database: ${dbName} on ${mongoose.connection.host}`);
  if (args["create-indexes"]) for (const model of models) await model.createIndexes();

  // 1. Refuse to touch anything that looks like real data.
  const problems: string[] = [];
  for (const item of plan) {
    const existing = await item.model.collection.findOne(
      { _id: item.doc._id },
      { projection: { demoSeed: 1 } },
    );
    if (existing && existing.demoSeed !== true)
      problems.push(`${item.model.modelName} ${item.doc._id} exists without the demo marker`);
    for (const path of item.unique) {
      const value = read(item.doc, path);
      if (value === undefined) continue;
      const clash = await item.model.collection.findOne(
        { [path]: value, _id: { $ne: item.doc._id } },
        { projection: { _id: 1 } },
      );
      if (clash) problems.push(`${item.model.modelName}.${path}=${value} is used by ${clash._id}`);
    }
  }
  for (const model of [Order, Ticket, Refund, Payout] as AnyModel[]) {
    const foreign = await model.collection.countDocuments({
      eventId: { $in: demoEventIds },
      demoSeed: { $ne: true },
    });
    if (foreign)
      problems.push(`${foreign} non-demo ${model.modelName} document(s) reference demo events`);
  }
  if (problems.length)
    throw new Error(`Aborted before writing anything:\n- ${problems.join("\n- ")}`);

  // 2. Optional reset: delete only documents carrying the demo marker.
  if (args.reset)
    for (const model of models) {
      const { deletedCount } = await model.collection.deleteMany({ demoSeed: true });
      console.info(`reset ${model.modelName}: deleted ${deletedCount}`);
    }

  // 3. Credentials rotate on every run, so drop sessions and pending logins of demo accounts.
  // Bookmarks, committee assignments and reports made by demo accounts are replaced below.
  await Promise.all([
    Session.collection.deleteMany({ userId: { $in: demoUserIds } }),
    AuthChallenge.collection.deleteMany({ userId: { $in: demoUserIds } }),
    PasswordReset.collection.deleteMany({ userId: { $in: demoUserIds } }),
    WorkspaceSession.collection.deleteMany({ accountId: { $in: demoAccountIds } }),
    AdminSession.collection.deleteMany({ accountId: admin._id }),
    AdminChallenge.collection.deleteMany({ accountId: admin._id }),
    SavedEvent.collection.deleteMany({ userId: { $in: demoUserIds }, demoSeed: { $ne: true } }),
    CommitteeAssignment.collection.deleteMany({
      userId: { $in: demoUserIds },
      demoSeed: { $ne: true },
    }),
    EventReport.collection.deleteMany({
      reporterId: { $in: demoUserIds },
      eventId: { $in: demoEventIds },
      demoSeed: { $ne: true },
    }),
  ]);

  // 4. Validate with the app schemas, then replace by deterministic _id.
  const written = new Map<string, number>();
  for (const item of writeOrder) {
    const document = new item.model(item.doc);
    await document.validate();
    const raw = {
      ...document.toObject({ depopulate: true, versionKey: false }),
      createdAt: item.doc.createdAt,
      updatedAt: item.doc.updatedAt,
      ...item.extra,
      ...MARK,
    };
    await item.model.collection.replaceOne({ _id: item.doc._id }, raw, { upsert: true });
    written.set(item.model.modelName, (written.get(item.model.modelName) ?? 0) + 1);
  }

  // 5. Check the invariants the app relies on.
  const errors: string[] = [];
  for (const type of await TicketType.find({ demoSeed: true } as any).lean()) {
    const paid = await Order.find({ ticketTypeId: type._id, paymentStatus: "paid" }).lean();
    const held = await Order.find({
      ticketTypeId: type._id,
      paymentStatus: "pending",
      reservationStatus: "held",
    }).lean();
    const sold = paid.reduce((n, o) => n + o.quantity, 0);
    const reserved = held.reduce((n, o) => n + o.quantity, 0);
    if (type.sold !== sold || type.reserved !== reserved || type.capacity < sold + reserved)
      errors.push(`ticket type ${type._id} counts do not match orders`);
  }
  for (const order of await Order.find({ demoSeed: true } as any).lean()) {
    if (order.totalAmount !== (order.subtotalAmount ?? 0) + (order.serviceFeeAmount ?? 0))
      errors.push(`order ${order.orderCode} total mismatch`);
    if (order.refundedAmount > order.totalAmount)
      errors.push(`order ${order.orderCode} over-refunded`);
    const count = await Ticket.countDocuments({ orderId: order._id });
    if (count !== (order.issuanceStatus === "issued" ? order.quantity : 0))
      errors.push(`order ${order.orderCode} has ${count} tickets`);
    const done = await Refund.find({ orderId: order._id, status: "refunded" }).lean();
    if (done.reduce((n, r) => n + r.amount, 0) !== order.refundedAmount)
      errors.push(`order ${order.orderCode} refundedAmount mismatch`);
  }
  for (const ticket of await Ticket.find({ demoSeed: true } as any).lean()) {
    const user = await User.findOne({ emailNormalized: ticket.attendeeEmail }).lean();
    if (user?.notifications?.reminders !== false)
      errors.push(`ticket ${ticket.ticketCode} attendee would receive reminders`);
  }
  if (errors.length) throw new Error(`Invariant check failed:\n- ${errors.join("\n- ")}`);

  for (const [name, count] of written) console.info(`upserted ${name}: ${count}`);

  // 6. Credentials go to a private local file only.
  const otpauth = `otpauth://totp/Gatherly:${encodeURIComponent(adminEmail)}?secret=${totpSecret}&issuer=Gatherly`;
  credentials.push(
    "# Gatherly demo credentials",
    "",
    `Generated ${now.toISOString()} for database \`${dbName}\`. Rerunning the seed rotates every password below.`,
    "Do not commit this file or paste it into GitHub.",
    "",
    "## Participants (login with email and password)",
    "",
    "| Name | Email | Password |",
    "| --- | --- | --- |",
    ...participantRows,
    "",
    "## Organizer and committee workspace (login with username)",
    "",
    "| Username | Role | Password | Notes |",
    "| --- | --- | --- | --- |",
    ...workspaceRows,
    "",
    "## Admin",
    "",
    `- Email: \`${adminEmail}\``,
    `- Password: \`${adminPassword}\``,
    `- TOTP secret (base32): \`${totpSecret}\``,
    `- otpauth URI: \`${otpauth}\``,
    `- Backup codes (single use): ${backupCodes.map((c) => `\`${c}\``).join(", ")}`,
    "",
  );
  await writeFile(credentialsOut, credentials.join("\n"), { mode: 0o600 });
  await chmod(credentialsOut, 0o600);
  console.info(`Credentials written to ${credentialsOut} (mode 600). They were not printed.`);
} finally {
  await mongoose.disconnect();
}
