/**
 * Idempotent sample data for Gatherly (participants, organizers, committee, admin).
 *
 * Seeded content reads like real data, so nothing user-visible marks it. Instead every seeded
 * document uses a deterministic `_id`, and the script records every `_id` and R2 object key in the
 * `seedmanifests` collection. Rerunning replaces the same documents. `--reset` deletes exactly the
 * documents and objects listed in the manifest (plus documents from the first version of this
 * script, which carried `demoSeed: true`) before reseeding.
 *
 * The script never calls app services that queue emails or talk to Midtrans. It writes documents
 * directly in states the worker leaves alone (see docs/demo-data.md).
 *
 * Usage (from apps/backend):
 *   pnpm seed:demo --env-file=<path> --confirm-db=<db name> [--db=<db name>] [--reset]
 *     [--credentials-out=<path>] [--create-indexes] [--skip-images]
 */
import { createHash, randomBytes } from "node:crypto";
import { chmod, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose, { Schema, Types, model, type Model } from "mongoose";
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

/**
 * Same collection and fields as `StorageAsset` in src/modules/storage/storage.service.ts. Defined
 * here because importing that module parses the full app env at import time.
 */
const StorageAsset = model(
  "StorageAsset",
  new Schema(
    {
      key: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      type: { type: String, required: true },
      size: { type: Number, required: true },
      ownerId: { type: String, index: true },
      purpose: { type: String, required: true },
      private: { type: Boolean, default: true },
      attachedAt: Date,
      deleteAfter: Date,
    },
    { timestamps: true },
  ),
);

const { values: args } = parseArgs({
  options: {
    reset: { type: "boolean", default: false },
    "env-file": { type: "string" },
    db: { type: "string" },
    "confirm-db": { type: "string" },
    "credentials-out": { type: "string" },
    "create-indexes": { type: "boolean", default: false },
    "skip-images": { type: "boolean", default: false },
  },
});
if (args["env-file"]) dotenv.config({ path: args["env-file"] });
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error("MONGODB_URI is required (pass --env-file or set it).");
if (!args["confirm-db"]) throw new Error("--confirm-db=<database name> is required.");
const credentialsOut = args["credentials-out"] ?? join(tmpdir(), "gatherly-seed-credentials.md");
const withImages = !args["skip-images"];
const bucket = process.env.R2_BUCKET_NAME || "gatherly";
const r2 = withImages
  ? (() => {
      const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT } = process.env;
      if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY)
        throw new Error("R2 credentials are required for images (or pass --skip-images).");
      return new S3Client({
        region: "auto",
        endpoint: R2_ENDPOINT ?? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
      });
    })()
  : null;

const MANIFEST_COLLECTION = "seedmanifests";
const MANIFEST_ID = "gatherly-sample-data";
/** Marker used by the first version of this script. Only read, never written any more. */
const LEGACY_MARK = { demoSeed: true } as const;
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
const digest = (key: string) => createHash("sha256").update(`gatherly-seed:${key}`).digest("hex");
/** Deterministic ObjectId so reruns replace the same documents instead of duplicating them. */
const oid = (key: string) =>
  new Types.ObjectId(
    createHash("sha256").update(`gatherly-demo:${key}`).digest("hex").slice(0, 24),
  );
const uuid = (key: string) => {
  const h = digest(key);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
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

// ---------------------------------------------------------------- images (Unsplash, see docs)
type Image = {
  key: string;
  photo: string;
  kind: "poster" | "square";
  purpose: "event-image" | "organizer-logo";
  ownerId: Types.ObjectId;
  name: string;
  asset: Item["doc"];
};
const images: Image[] = [];
function image(
  key: string,
  photo: string,
  kind: Image["kind"],
  ownerId: Types.ObjectId,
  name: string,
  purpose: Image["purpose"] = "event-image",
) {
  if (!withImages) return undefined;
  const asset = add(
    StorageAsset,
    {
      _id: oid(`asset:${key}`),
      key: `media/${purpose}/${uuid(`asset:${key}`)}`,
      name,
      type: "image/jpeg",
      size: 1,
      ownerId: ownerId.toString(),
      purpose,
      private: false,
      attachedAt: wib(-28, 9),
      createdAt: wib(-28, 9),
      updatedAt: wib(-28, 9),
    },
    ["key"],
  );
  images.push({ key, photo, kind, purpose, ownerId, name, asset });
  return asset._id.toString();
}
const mediaUrl = (id?: string) => (id ? `/api/v1/media/${id}` : undefined);
async function downloadImage(img: Image) {
  const query =
    img.kind === "poster"
      ? "w=1200&q=75&fm=jpg&fit=max"
      : "w=400&h=400&fit=crop&crop=faces&q=75&fm=jpg";
  const response = await fetch(`https://images.unsplash.com/${img.photo}?${query}`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Image ${img.photo} returned HTTP ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (body[0] !== 0xff || body[1] !== 0xd8 || body[2] !== 0xff)
    throw new Error(`Image ${img.photo} is not a JPEG`);
  if (body.length > 1024 * 1024) throw new Error(`Image ${img.photo} is larger than 1 MB`);
  return body;
}

// ---------------------------------------------------------------- participants
type Buyer = { key: string; id: Types.ObjectId; name: string; email: string };
const buyers: Record<string, Buyer> = {};
const participantSpecs = [
  { key: "budi", name: "Budi Santoso", email: "budi.santoso", phone: "+6281200000101" },
  { key: "sari", name: "Sari Wulandari", email: "sari.wulandari", phone: "+6281200000102" },
  { key: "raka", name: "Raka Pratama", email: "raka.pratama", phone: "+6281200000103" },
  { key: "dimas", name: "Dimas Ardiansyah", email: "dimas.ardiansyah", phone: "+6281200000104" },
  {
    key: "nadia",
    name: "Nadia Putri",
    email: "nadia.putri",
    phone: "+6281200000105",
    googleOnly: true,
  },
];
const participantRows: string[] = [];
for (const spec of participantSpecs) {
  const email = `${spec.email}@gatherlyy.fun`;
  const password = spec.googleOnly ? undefined : secret();
  const user = add(
    User,
    {
      _id: oid(`user:${spec.key}`),
      name: spec.name,
      emailNormalized: email,
      ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
      // Not a real Google subject (those are numeric), so no real account can ever match it.
      ...(spec.googleOnly ? { googleId: `seed-${digest(`google:${spec.key}`).slice(0, 20)}` } : {}),
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
      // Same shape the app uses for workspace-only users.
      emailNormalized: `${digest(`ws:${username}`).slice(0, 43)}@workspace.invalid`,
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

const lensaOwner = await workspaceUser("lensakota", "Laras Hapsari");
const lensaLogo = image(
  "logo:lensakota",
  "photo-1516961642265-531546e84af2",
  "square",
  lensaOwner._id,
  "logo-lensa-kota.jpg",
  "organizer-logo",
);
const lensa = add(
  Organizer,
  {
    _id: oid("org:lensa"),
    ownerId: lensaOwner._id,
    name: "Kolektif Lensa Kota",
    description:
      "Kolektif fotografi dan musik independen dari Yogyakarta. Sejak 2019 kami membuat malam akustik, lokakarya foto analog, dan pameran kecil untuk komunitas kreatif kota.",
    contactEmail: "halo.lensakota@gatherlyy.fun",
    username: "lensakota",
    city: "Kota Yogyakarta",
    ...(lensaLogo ? { logoUrl: mediaUrl(lensaLogo) } : {}),
    links: [],
    status: "active",
    applicationNumber: "PNG-2610-0904",
    pic: {
      name: "Laras Hapsari",
      role: "Koordinator",
      email: "laras.hapsari@gatherlyy.fun",
      phone: "+6281200000201",
    },
    createdAt: wib(-30, 9),
    updatedAt: now,
  },
  ["ownerId", "username"],
);
await workspaceAccount({
  username: "lensakota",
  name: "Laras Hapsari",
  role: "organizer",
  userId: lensaOwner._id,
  organizerId: lensa._id,
  email: "laras.hapsari@gatherlyy.fun",
  lastLoginAt: wib(-1, 20),
  note: "Organizer aktif (Kolektif Lensa Kota)",
});

const rakitOwner = await workspaceUser("ruangrakit", "Gilang Ramadhan");
const rakitLogo = image(
  "logo:ruangrakit",
  "photo-1595351298020-038700609878",
  "square",
  rakitOwner._id,
  "logo-ruang-rakit.jpg",
  "organizer-logo",
);
const rakit = add(
  Organizer,
  {
    _id: oid("org:rakit"),
    ownerId: rakitOwner._id,
    name: "Ruang Rakit Studio",
    description:
      "Studio keramik dan kriya di Bandung yang rutin mengadakan pasar kriya akhir pekan bersama perajin lokal.",
    contactEmail: "halo.ruangrakit@gatherlyy.fun",
    username: "ruangrakit",
    city: "Kota Bandung",
    ...(rakitLogo ? { logoUrl: mediaUrl(rakitLogo) } : {}),
    links: [],
    status: "frozen",
    frozenReason: "Dokumen legal perlu diperbarui sebelum akun diaktifkan kembali.",
    pic: {
      name: "Gilang Ramadhan",
      role: "Pemilik",
      email: "gilang.ramadhan@gatherlyy.fun",
      phone: "+6281200000202",
    },
    createdAt: wib(-60, 9),
    updatedAt: now,
  },
  ["ownerId", "username"],
);
await workspaceAccount({
  username: "ruangrakit",
  name: "Gilang Ramadhan",
  role: "organizer",
  userId: rakitOwner._id,
  organizerId: rakit._id,
  email: "gilang.ramadhan@gatherlyy.fun",
  lastLoginAt: wib(-8, 11),
  note: "Organizer dibekukan (hanya bisa melihat, tidak bisa mengubah)",
});

const lensaBank = { bank: "BCA", accountNumber: "8800012345", holderName: "Kolektif Lensa Kota" };
add(
  BankAccount,
  {
    _id: oid("bank:lensa"),
    organizerId: lensa._id,
    ...lensaBank,
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
    holderName: "Ruang Rakit Studio",
    createdAt: wib(-59, 9),
    updatedAt: wib(-59, 9),
  },
  ["organizerId"],
);

// Committee accounts of Kolektif Lensa Kota.
const gate1User = await workspaceUser("lensakota.yoga", "Yoga Prasetyo");
const gate2User = await workspaceUser("lensakota.intan", "Intan Maharani");
const gate3User = await workspaceUser("lensakota.fajar", "Fajar Nugroho");
await workspaceAccount({
  username: "lensakota.yoga",
  name: "Yoga Prasetyo",
  role: "committee",
  userId: gate1User._id,
  organizerId: lensa._id,
  lastLoginAt: wib(-1, 10),
  note: "Panitia aktif, ditugaskan ke pameran (check-in terbuka) dan tiga acara selesai",
});
await workspaceAccount({
  username: "lensakota.intan",
  name: "Intan Maharani",
  role: "committee",
  userId: gate2User._id,
  organizerId: lensa._id,
  mustChangePassword: true,
  note: "Panitia belum pernah login (password sementara berlaku 7 hari)",
});
await workspaceAccount({
  username: "lensakota.fajar",
  name: "Fajar Nugroho",
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
const adminEmail = "tim.operasional@gatherlyy.fun";
const admin = add(
  AdminAccount,
  {
    _id: oid("admin:demo"),
    email: adminEmail,
    name: "Tim Operasional",
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
// October 2026 numbers with a high sequence: the app only allocates numbers for the current
// month, so these can never collide with a future real application.
const appBase = (n: number, status: string) => ({
  _id: oid(`app:${n}`),
  number: `PNG-2610-090${n}`,
  status,
  links: [],
  version: 0,
  flags: [] as Array<{ field: string; note: string }>,
});
add(
  OrganizerApplication,
  {
    ...appBase(1, "new"),
    organizerName: "Komunitas Lari Senja",
    organizerType: "komunitas",
    description:
      "Komunitas lari sore di Semarang dengan 300 anggota aktif. Kami ingin menjual tiket fun run bulanan dan kelas lari pemula.",
    address: {
      province: "Jawa Tengah",
      city: "Kota Semarang",
      street: "Jl. Pahlawan No. 10",
      postalCode: "50241",
    },
    pic: {
      name: "Ayu Lestari",
      role: "Ketua",
      email: "ayu.lestari@gatherlyy.fun",
      phone: "+6281200000301",
    },
    username: "larisenja",
    activeEmail: "ayu.lestari@gatherlyy.fun",
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
    organizerName: "Himpunan Mahasiswa Desain Komunikasi Visual",
    organizerType: "organisasi_kampus",
    description:
      "Himpunan mahasiswa DKV yang menyelenggarakan pameran tugas akhir dan seminar desain setiap semester.",
    address: {
      province: "Jawa Barat",
      city: "Kota Bandung",
      street: "Jl. Ganesa No. 10",
      postalCode: "40132",
    },
    pic: {
      name: "Rizky Maulana",
      role: "Ketua Himpunan",
      email: "rizky.maulana@gatherlyy.fun",
      phone: "+6281200000302",
    },
    username: "himadkv",
    activeEmail: "rizky.maulana@gatherlyy.fun",
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
    organizerName: "PT Gema Nusantara Kreatif",
    organizerType: "perusahaan",
    description:
      "Event organizer konser skala menengah di Surabaya dengan pengalaman lima tahun. Kami menangani konser 500 sampai 3.000 penonton dan festival musik kampus.",
    address: {
      province: "Jawa Timur",
      city: "Kota Surabaya",
      street: "Jl. Tunjungan No. 45",
      postalCode: "60261",
    },
    pic: {
      name: "Hendra Wijaya",
      role: "Direktur",
      email: "hendra.wijaya@gatherlyy.fun",
      phone: "+6281200000303",
    },
    username: "gemanusantara",
    activeEmail: "hendra.wijaya@gatherlyy.fun",
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
    organizerName: "Kolektif Lensa Kota",
    organizerType: "komunitas",
    description: lensa.description,
    address: {
      province: "DI Yogyakarta",
      city: "Kota Yogyakarta",
      street: "Jl. Tirtodipuran No. 3",
      postalCode: "55143",
    },
    pic: lensa.pic,
    username: "lensakota",
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
    organizerName: "Bazar Kilat Untung",
    organizerType: "individu",
    description: "Bazar akhir pekan dengan undian berhadiah bagi setiap pembeli tiket masuk.",
    address: {
      province: "DKI Jakarta",
      city: "Kota Jakarta Barat",
      street: "Jl. Tanjung Duren Raya No. 1",
      postalCode: "11470",
    },
    pic: {
      name: "Tono Saputra",
      role: "Pemilik",
      email: "tono.saputra@gatherlyy.fun",
      phone: "+6281200000305",
    },
    username: "bazarkilat",
    submittedAt: at(-9 * DAY),
    emailVerifiedAt: at(-9 * DAY + HOUR),
    rejectionReason: "Acara mengandung undian berbayar yang tidak diizinkan di Gatherly.",
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
type PerformerSpec = { name: string; note: string; time: string; photo?: string };
type EventSpec = {
  key: string;
  slug: string;
  poster: string;
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
  performers?: PerformerSpec[];
  terms?: string[];
  types: TypeSpec[];
};
const defaultTerms = [
  "Satu e-ticket berlaku untuk satu orang dan satu kali check-in.",
  "Tunjukkan QR e-ticket di pintu masuk.",
  "Refund dapat diajukan paling lambat satu bulan sebelum acara. Biaya layanan tidak dikembalikan.",
  "Dilarang membawa makanan dan minuman dari luar.",
];
const events: Record<string, any> = {};
const ticketTypes: Record<string, any> = {};
function addEvent(spec: EventSpec) {
  const posterAssetId = image(
    `poster:${spec.key}`,
    spec.poster,
    "poster",
    spec.organizer.ownerId,
    `${spec.slug}.jpg`,
  );
  const event = add(
    Event,
    {
      _id: oid(`event:${spec.key}`),
      organizerId: spec.organizer._id,
      slug: spec.slug,
      title: spec.title,
      description: spec.description,
      category: spec.category,
      startsAt: spec.startsAt,
      endsAt: spec.endsAt,
      timezone: "Asia/Jakarta",
      venueName: spec.venueName,
      address: spec.address,
      city: spec.city,
      ...(posterAssetId ? { posterAssetId } : {}),
      publicationStatus: spec.publicationStatus ?? "published",
      salesClosed: false,
      locationType: "offline",
      terms: spec.terms ?? defaultTerms,
      performerLabel: spec.performerLabel ?? "Penampil",
      performers: (spec.performers ?? []).map((performer, index) => {
        const photoAssetId = performer.photo
          ? image(
              `performer:${spec.key}:${index}`,
              performer.photo,
              "square",
              spec.organizer.ownerId,
              `${performer.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.jpg`,
            )
          : undefined;
        return {
          name: performer.name,
          note: performer.note,
          time: performer.time,
          ...(photoAssetId ? { photoAssetId, photoUrl: mediaUrl(photoAssetId) } : {}),
        };
      }),
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
  slug: "malam-akustik-tirtodipuran",
  poster: "photo-1614999098814-23c48ffa512d",
  organizer: lensa,
  title: "Malam Akustik Tirtodipuran",
  description:
    "Malam musik akustik di halaman Kedai Kebun Forum bersama tiga musisi independen Yogyakarta. Duduk lesehan di bawah lampu gantung, teh hangat tersedia sepanjang acara, dan setiap penampil membawakan lagu baru yang belum pernah dirilis.",
  category: "Musik",
  startsAt: wib(45, 19),
  endsAt: wib(45, 23),
  ...jogja,
  performers: [
    {
      name: "Sore di Selatan",
      note: "Folk akustik",
      time: "19.30",
      photo: "photo-1521337581100-8ca9a73a5f79",
    },
    {
      name: "Nara Kinanti",
      note: "Penyanyi dan penulis lagu",
      time: "20.30",
      photo: "photo-1615748562359-3a430a3b5e56",
    },
    {
      name: "Trio Angkringan",
      note: "Keroncong modern",
      time: "21.30",
      photo: "photo-1542813813-1f873f401e9b",
    },
  ],
  types: [
    { key: "reguler", name: "Reguler", description: "Area lesehan", price: 85_000, capacity: 120 },
    {
      key: "vip",
      name: "VIP",
      description: "Kursi depan dan satu minuman",
      price: 175_000,
      capacity: 30,
    },
  ],
});
addEvent({
  key: "lokakarya-foto-analog",
  slug: "lokakarya-fotografi-analog-pemula",
  poster: "photo-1767093061114-fca0e996d6cb",
  organizer: lensa,
  title: "Lokakarya Fotografi Analog untuk Pemula",
  description:
    "Belajar dasar kamera film dalam satu hari: memuat rol, membaca cahaya tanpa light meter, dan memotret suasana kampung Prawirotaman. Harga sudah termasuk satu rol film, cuci cetak, dan pinjaman kamera bagi yang belum punya.",
  category: "Lokakarya",
  startsAt: wib(60, 9),
  endsAt: wib(60, 15),
  venueName: "Studio Lensa Kota",
  address: "Jl. Prawirotaman II No. 12, Mergangsan",
  city: "Kota Yogyakarta",
  performerLabel: "Pemateri",
  performers: [
    {
      name: "Laras Hapsari",
      note: "Fotografer dokumenter",
      time: "09.00",
      photo: "photo-1534528741775-53994a69daeb",
    },
    {
      name: "Bima Adi",
      note: "Teknisi kamar gelap",
      time: "13.00",
      photo: "photo-1544168190-79c17527004f",
    },
  ],
  types: [
    {
      key: "peserta",
      name: "Peserta",
      description: "Termasuk satu rol film dan cuci cetak",
      price: 150_000,
      capacity: 25,
    },
  ],
});
addEvent({
  key: "konser-senja-sold-out",
  slug: "konser-senja-bukit-bintang",
  poster: "photo-1611244806964-91d204d4a2a7",
  organizer: lensa,
  title: "Konser Senja di Bukit Bintang",
  description:
    "Konser kecil menjelang matahari terbenam dengan pemandangan kota Yogyakarta dari ketinggian. Kapasitas sengaja dibatasi supaya suasana tetap akrab.",
  category: "Musik",
  startsAt: wib(20, 16),
  endsAt: wib(20, 19),
  venueName: "Bukit Bintang Patuk",
  address: "Jl. Jogja-Wonosari Km 17, Patuk",
  city: "Kabupaten Gunungkidul",
  performers: [
    {
      name: "Langit Jingga",
      note: "Indie pop",
      time: "17.00",
      photo: "photo-1605340406960-f5b496c38b3d",
    },
  ],
  types: [
    { key: "festival", name: "Festival", description: "Berdiri", price: 120_000, capacity: 6 },
  ],
});
addEvent({
  key: "pameran-seni-rupa",
  slug: "pameran-seni-rupa-ruang-antara",
  poster: "photo-1578855019520-af8101c056e2",
  organizer: lensa,
  title: "Pameran Seni Rupa Ruang Antara",
  description:
    "Pameran karya dua puluh perupa muda Yogyakarta selama satu minggu, dari lukisan, instalasi, sampai arsip foto keluarga. Tur kuratorial berlangsung setiap sore pukul 16.00.",
  category: "Seni & Budaya",
  startsAt: wib(-1, 10),
  endsAt: wib(6, 21),
  venueName: "Galeri Ruang Antara",
  address: "Jl. Suryodiningratan No. 8, Mantrijeron",
  city: "Kota Yogyakarta",
  performerLabel: "Perupa",
  performers: [
    {
      name: "Kolektif Gambar Pagi",
      note: "Instalasi",
      time: "Sepanjang pameran",
      photo: "photo-1541961017774-22349e4a1262",
    },
    {
      name: "Dewi Anggraini",
      note: "Lukisan",
      time: "Sepanjang pameran",
      photo: "photo-1633887091273-a3bd71efddde",
    },
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
  slug: "meetup-komunitas-web-jogja",
  poster: "photo-1556761175-5973dc0f32e7",
  organizer: lensa,
  title: "Meetup Komunitas Web Jogja",
  description:
    "Meetup bulanan untuk pengembang web di Yogyakarta: dua sesi berbagi pengalaman, tanya jawab, lalu ngobrol santai sambil makan malam ringan. Gratis, tetapi tempat terbatas sehingga wajib daftar.",
  category: "Teknologi",
  startsAt: wib(10, 18, 30),
  endsAt: wib(10, 21),
  venueName: "Ruang Kolaborasi Kotabaru",
  address: "Jl. Suroto No. 2, Kotabaru",
  city: "Kota Yogyakarta",
  performerLabel: "Pembicara",
  performers: [
    {
      name: "Arif Rahman",
      note: "Membangun API yang tahan gangguan",
      time: "19.00",
      photo: "photo-1516011362164-3095a82b0af9",
    },
    {
      name: "Putri Ayu",
      note: "Aksesibilitas formulir",
      time: "19.45",
      photo: "photo-1589525231707-f2de2428f59c",
    },
  ],
  types: [{ key: "gratis", name: "Gratis", description: "Wajib daftar", price: 0, capacity: 80 }],
});
addEvent({
  key: "draft-kelas-menulis-lagu",
  slug: "kelas-menulis-lagu",
  poster: "photo-1590796351790-0878afe48943",
  organizer: lensa,
  title: "Kelas Menulis Lagu",
  description:
    "Kelas kecil empat jam untuk menulis lirik dan melodi pertamamu, dibimbing musisi lokal. Peserta pulang membawa satu lagu utuh.",
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
  slug: "festival-kuliner-kampung-tirtodipuran",
  poster: "photo-1551883738-19ffa3dc4c43",
  organizer: lensa,
  title: "Festival Kuliner Kampung Tirtodipuran",
  description:
    "Festival jajanan kampung dengan tiga puluh lapak warga, dari gudeg kering sampai wedang uwuh. Tiket masuk sudah termasuk satu kupon jajan.",
  category: "Kuliner",
  startsAt: wib(-14, 16),
  endsAt: wib(-14, 22),
  ...jogja,
  types: [
    {
      key: "masuk",
      name: "Tiket Masuk",
      description: "Termasuk satu kupon jajan",
      price: 35_000,
      capacity: 300,
    },
  ],
});
addEvent({
  key: "workshop-kopi-selesai",
  slug: "workshop-seduh-kopi-manual",
  poster: "photo-1442512595331-e89e73853f31",
  organizer: lensa,
  title: "Workshop Seduh Kopi Manual",
  description:
    "Belajar menyeduh kopi dengan V60, Kalita, dan tubruk bersama barista lokal. Peserta membawa pulang 100 gram biji kopi Menoreh.",
  category: "Lokakarya",
  startsAt: wib(-7, 13),
  endsAt: wib(-7, 17),
  ...jogja,
  types: [
    {
      key: "peserta",
      name: "Peserta",
      description: "Termasuk 100 gram biji kopi",
      price: 125_000,
      capacity: 20,
    },
  ],
});
addEvent({
  key: "lari-pagi-selesai",
  slug: "lari-pagi-keliling-benteng",
  poster: "photo-1760315972424-1637530daead",
  organizer: lensa,
  title: "Lari Pagi Keliling Benteng",
  description:
    "Fun run 5K mengelilingi benteng Keraton Yogyakarta, mulai dan selesai di Alun-Alun Selatan. Termasuk kaus, medali, dan sarapan.",
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
  slug: "malam-jazz-tepi-pantai",
  poster: "photo-1415201364774-f6f0bb35f28f",
  organizer: lensa,
  title: "Malam Jazz Tepi Pantai",
  description:
    "Malam jazz di tepi Pantai Parangkusumo dengan panggung menghadap laut dan api unggun. Bawa jaket karena angin malam cukup kencang.",
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
    cancellationReason: "Venue tidak mendapat izin keramaian dari pemerintah setempat.",
    cancellationRequestedAt: at(-3 * DAY),
    cancellationDecidedAt: at(-2 * DAY),
    cancellationDecidedBy: admin._id,
    cancellationDecisionNote: "Pembatalan disetujui. Refund penuh diproses otomatis.",
    checkoutVersion: 2,
    financialVersion: 4,
  },
  types: [
    { key: "reguler", name: "Reguler", description: "Area pasir", price: 95_000, capacity: 100 },
  ],
});
addEvent({
  key: "futsal-antarkampus-menunggu-batal",
  slug: "turnamen-futsal-antarkampus",
  poster: "photo-1763775594018-4a84eeadd83d",
  organizer: lensa,
  title: "Turnamen Futsal Antarkampus",
  description:
    "Turnamen futsal enam belas tim mahasiswa se-DIY selama satu hari penuh. Tiket berlaku untuk menonton semua pertandingan dari tribun.",
  category: "Olahraga",
  startsAt: wib(35, 8),
  endsAt: wib(35, 17),
  venueName: "GOR Kampus Kaliurang",
  address: "Jl. Kaliurang Km 5, Depok",
  city: "Kabupaten Sleman",
  extra: {
    cancellationStatus: "requested",
    cancellationReason: "GOR dipakai untuk kegiatan wisuda pada tanggal yang sama.",
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
  slug: "pasar-kriya-akhir-pekan",
  poster: "photo-1780767571176-6e173e76593d",
  organizer: rakit,
  title: "Pasar Kriya Akhir Pekan",
  description:
    "Pasar kriya dengan empat puluh perajin keramik, kayu, dan tekstil dari Bandung Raya, ditambah kelas singkat membuat cangkir tanah liat.",
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
  const snapshot = {
    slug: event.slug,
    ...(event.posterAssetId ? { poster: event.posterAssetId } : {}),
    endsAt: event.endsAt,
    title: event.title,
    startsAt: event.startsAt,
    timezone: event.timezone,
    venueName: event.venueName,
    address: event.address,
    city: event.city,
  };
  const expiresAt = new Date(createdAt.getTime() + 15 * MINUTE);
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
    },
    pending: {
      paymentStatus: "pending",
      reservationStatus: "held",
      issuanceStatus: "not_ready",
      paymentSessionState: "not_started",
      issuanceAttempts: 0,
      paymentSessionAttempts: 0,
      paymentTimeline: [],
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
        { status: "expired", at: expiresAt },
      ],
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
    },
  }[input.state];
  const order = add(
    Order,
    {
      _id: oid(`order:${input.key}`),
      buyerId: buyer.id,
      eventId: event._id,
      ticketTypeId: type._id,
      orderCode: `GTH-${digest(`order:${input.key}`).slice(0, 10).toUpperCase()}`,
      providerOrderId: `gatherly-${uuid(`provider:${input.key}`)}`,
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
      idempotencyKey: uuid(`idempotency:${input.key}`),
      requestHash: digest(`request:${input.key}`),
      expiresAt,
      // Pending orders are first reconciled after expiry, so the worker expires them locally
      // without calling Midtrans.
      nextReconcileAt: expiresAt,
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
        ticketCode: `GTH-T-${digest(`ticket:${input.key}:${sequence}`).slice(0, 12).toUpperCase()}`,
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
// Guests reuse the buyer's email so every ticket email belongs to a seeded user with reminders off.
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
for (const [key, friend] of [
  ["budi", "Rina Kusuma"],
  ["sari", "Andi Saputra"],
  ["raka", "Teguh Wibowo"],
] as const)
  addOrder({
    key: `senja-${key}`,
    event: "konser-senja-sold-out",
    type: "festival",
    buyer: key,
    attendees: [b(key), guest(friend, key)],
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
const cancelReason = "Venue tidak mendapat izin keramaian dari pemerintah setempat.";
addRefund({
  key: "akustik-budi-partial",
  order: "akustik-budi",
  sequences: [1],
  kind: "buyer",
  status: "refunded",
  reason: "Teman saya batal ikut karena tugas kantor ke luar kota.",
  requestedAt: ago(6),
  decisionNote: "Disetujui sesuai kebijakan refund.",
});
addRefund({
  key: "akustik-sari-requested",
  order: "akustik-sari",
  sequences: [0],
  kind: "buyer",
  status: "requested",
  reason: "Bentrok dengan jadwal lembur akhir bulan.",
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
  decisionNote: "Disetujui sesuai kebijakan refund.",
});
addRefund({
  key: "foto-dimas-approved",
  order: "foto-dimas",
  sequences: [0, 1],
  kind: "buyer",
  status: "approved",
  reason: "Jadwal kuliah pengganti jatuh di hari yang sama.",
  requestedAt: ago(3),
  decisionNote: "Disetujui, menunggu proses pengembalian dana.",
});
addRefund({
  key: "foto-budi-rejected",
  order: "foto-budi",
  sequences: [0],
  kind: "buyer",
  status: "rejected",
  reason: "Ingin pindah ke kelas lanjutan.",
  requestedAt: ago(5),
  decisionNote: "Perpindahan kelas tidak termasuk kebijakan refund penyelenggara.",
});
addRefund({
  key: "jazz-sari-cancelled",
  order: "jazz-sari",
  sequences: [0, 1],
  kind: "event_cancelled",
  status: "refunded",
  reason: cancelReason,
  requestedAt: ago(2),
});
addRefund({
  key: "jazz-raka-manual",
  order: "jazz-raka",
  sequences: [0],
  kind: "event_cancelled",
  status: "manual_required",
  reason: cancelReason,
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
  ...lensaBank,
});
add(
  Payout,
  {
    ...payoutBase("festival-kuliner-selesai"),
    status: "transferred",
    requestedAt: wib(-12, 10),
    transferredAt: wib(-10, 14),
    transferReference: "BCA-TRF-0045821",
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
  note: "Jam mulai di poster berbeda dengan yang tertulis di halaman acara.",
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
  note: "Rute lari tidak sesuai dengan peta yang dibagikan sebelumnya.",
  status: "done",
  resolutionNote: "Organizer sudah mengirim peta rute yang benar ke semua peserta.",
  closedBy: admin._id.toString(),
  closedAt: ago(2),
  createdAt: ago(3),
  updatedAt: ago(2),
});

// ---------------------------------------------------------------- write
// The worker scans cancelled events every second and creates refunds for paid orders that lack
// one. Events are therefore deleted first and written last, so a cancelled event never exists
// while its orders or refunds are missing.
const models = [Event, ...new Set(plan.map((item) => item.model).filter((m) => m !== Event))];
const writeOrder = [
  ...plan.filter((item) => item.model !== Event),
  ...plan.filter((item) => item.model === Event),
];
const demoUserIds = plan.filter((i) => i.model === User).map((i) => i.doc._id);
const demoAccountIds = plan.filter((i) => i.model === WorkspaceAccount).map((i) => i.doc._id);
const demoEventIds = Object.values(events).map((e) => e._id);
const plannedKeys = images.map((img) => img.asset.key as string);
const read = (doc: Record<string, any>, path: string) =>
  path.split(".").reduce<any>((value, key) => value?.[key], doc);
type Manifest = { _id: string; collections: Record<string, Types.ObjectId[]>; r2Keys: string[] };

await mongoose.connect(mongoUri, {
  ...(args.db ? { dbName: args.db } : {}),
  autoIndex: false,
  serverSelectionTimeoutMS: 15_000,
});
try {
  const db = mongoose.connection.db!;
  if (db.databaseName !== args["confirm-db"])
    throw new Error(
      `Connected to "${db.databaseName}", but --confirm-db is "${args["confirm-db"]}".`,
    );
  console.info(`Database: ${db.databaseName} on ${mongoose.connection.host}`);
  if (args["create-indexes"]) for (const model of models) await model.createIndexes();

  const manifests = db.collection<Manifest>(MANIFEST_COLLECTION);
  const manifest: Manifest = (await manifests.findOne({ _id: MANIFEST_ID })) ?? {
    _id: MANIFEST_ID,
    collections: {},
    r2Keys: [],
  };
  const seededIds = (collection: string) => manifest.collections[collection] ?? [];
  /** A document is ours if the manifest lists it or the first script version marked it. */
  const ours = (collection: string) => ({
    $or: [{ _id: { $in: seededIds(collection) } }, LEGACY_MARK],
  });
  const notOurs = (collection: string) => ({
    $nor: [{ _id: { $in: seededIds(collection) } }, LEGACY_MARK],
  });

  // 1. Refuse to touch anything that looks like real data.
  const problems: string[] = [];
  for (const item of plan) {
    const name = item.model.collection.collectionName;
    if (await item.model.collection.findOne({ _id: item.doc._id, ...notOurs(name) }))
      problems.push(`${item.model.modelName} ${item.doc._id} exists but was not seeded`);
    for (const path of item.unique) {
      const value = read(item.doc, path);
      if (value === undefined) continue;
      const clash = await item.model.collection.findOne(
        { [path]: value, _id: { $ne: item.doc._id } },
        { projection: { _id: 1 } },
      );
      if (!clash) continue;
      const seeded = await item.model.collection.findOne({ _id: clash._id, ...ours(name) });
      if (!seeded)
        problems.push(`${item.model.modelName}.${path}=${value} is used by real data ${clash._id}`);
      else if (!args.reset)
        problems.push(
          `${item.model.modelName}.${path}=${value} belongs to an older seed; rerun with --reset`,
        );
    }
  }
  const knownEventIds = [
    ...demoEventIds,
    ...seededIds("events"),
    ...(await Event.collection.distinct("_id", LEGACY_MARK)),
  ];
  for (const model of [Order, Ticket, Refund, Payout] as AnyModel[]) {
    const name = model.collection.collectionName;
    const foreign = await model.collection.countDocuments({
      eventId: { $in: knownEventIds },
      ...notOurs(name),
    });
    if (foreign)
      problems.push(`${foreign} non-seeded ${model.modelName} document(s) reference seeded events`);
  }
  if (problems.length)
    throw new Error(`Aborted before writing anything:\n- ${problems.join("\n- ")}`);

  // 2. Optional reset: delete only documents and objects this script created.
  if (args.reset) {
    for (const model of models) {
      const name = model.collection.collectionName;
      const { deletedCount } = await model.collection.deleteMany(ours(name));
      console.info(`reset ${model.modelName}: deleted ${deletedCount}`);
    }
    for (const [name, ids] of Object.entries(manifest.collections)) {
      if (models.some((m) => m.collection.collectionName === name)) continue;
      const { deletedCount } = await db.collection(name).deleteMany({ _id: { $in: ids } });
      console.info(`reset ${name}: deleted ${deletedCount}`);
    }
    if (manifest.r2Keys.length && !r2)
      throw new Error("The manifest lists R2 objects; R2 credentials are needed to reset them.");
    for (const key of manifest.r2Keys)
      await r2!.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    console.info(`reset R2: deleted ${manifest.r2Keys.length} object(s)`);
    manifest.collections = {};
    manifest.r2Keys = [];
  }

  // 3. Record every planned _id and object key before writing, so a crash halfway through still
  // leaves everything findable for --reset.
  for (const item of plan) {
    const name = item.model.collection.collectionName;
    const list = (manifest.collections[name] ??= []);
    if (!list.some((id) => id.equals(item.doc._id))) list.push(item.doc._id);
  }
  manifest.r2Keys = [...new Set([...manifest.r2Keys, ...plannedKeys])];
  await manifests.replaceOne({ _id: MANIFEST_ID }, manifest, { upsert: true });

  // 4. Credentials rotate on every run, so drop sessions and pending logins of seeded accounts.
  // Bookmarks, committee assignments and reports made by seeded accounts are replaced below.
  await Promise.all([
    Session.collection.deleteMany({ userId: { $in: demoUserIds } }),
    AuthChallenge.collection.deleteMany({ userId: { $in: demoUserIds } }),
    PasswordReset.collection.deleteMany({ userId: { $in: demoUserIds } }),
    WorkspaceSession.collection.deleteMany({ accountId: { $in: demoAccountIds } }),
    AdminSession.collection.deleteMany({ accountId: admin._id }),
    AdminChallenge.collection.deleteMany({ accountId: admin._id }),
    SavedEvent.collection.deleteMany({
      userId: { $in: demoUserIds },
      ...notOurs("savedevents"),
    }),
    CommitteeAssignment.collection.deleteMany({
      userId: { $in: demoUserIds },
      ...notOurs("committeeassignments"),
    }),
    EventReport.collection.deleteMany({
      reporterId: { $in: demoUserIds },
      eventId: { $in: demoEventIds },
      ...notOurs("eventreports"),
    }),
  ]);

  // 5. Images: download from Unsplash and store them the way the app stores public uploads.
  for (const img of images) {
    const body = await downloadImage(img);
    await r2!.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: img.asset.key,
        Body: body,
        ContentType: "image/jpeg",
      }),
    );
    img.asset.size = body.length;
  }
  if (images.length) console.info(`uploaded ${images.length} image(s) to R2`);

  // 6. Validate with the app schemas, then replace by deterministic _id.
  const written = new Map<string, number>();
  for (const item of writeOrder) {
    const document = new item.model(item.doc);
    await document.validate();
    const raw = {
      ...document.toObject({ depopulate: true, versionKey: false }),
      createdAt: item.doc.createdAt,
      updatedAt: item.doc.updatedAt,
      ...item.extra,
    };
    await item.model.collection.replaceOne({ _id: item.doc._id }, raw, { upsert: true });
    written.set(item.model.modelName, (written.get(item.model.modelName) ?? 0) + 1);
  }

  // 7. Check the invariants the app relies on.
  const errors: string[] = [];
  const idsOf = (model: AnyModel) => plan.filter((i) => i.model === model).map((i) => i.doc._id);
  for (const type of await TicketType.find({ _id: { $in: idsOf(TicketType) } }).lean()) {
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
  for (const order of await Order.find({ _id: { $in: idsOf(Order) } }).lean()) {
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
  for (const ticket of await Ticket.find({ _id: { $in: idsOf(Ticket) } }).lean()) {
    const user = await User.findOne({ emailNormalized: ticket.attendeeEmail }).lean();
    if (user?.notifications?.reminders !== false)
      errors.push(`ticket ${ticket.ticketCode} attendee would receive reminders`);
  }
  if (withImages)
    for (const event of await Event.find({ _id: { $in: demoEventIds } }).lean())
      if (
        !event.posterAssetId ||
        !(await StorageAsset.exists({ _id: event.posterAssetId, private: false }))
      )
        errors.push(`event ${event.slug} has no public poster asset`);
  const visible = await Event.find({ _id: { $in: demoEventIds } }, { title: 1, slug: 1 }).lean();
  for (const event of visible)
    if (/demo/i.test(`${event.title} ${event.slug}`)) errors.push(`event ${event.slug} says demo`);
  if (errors.length) throw new Error(`Invariant check failed:\n- ${errors.join("\n- ")}`);

  for (const [name, count] of written) console.info(`upserted ${name}: ${count}`);

  // 8. Credentials go to a private local file only.
  const otpauth = `otpauth://totp/Gatherly:${encodeURIComponent(adminEmail)}?secret=${totpSecret}&issuer=Gatherly`;
  credentials.push(
    "# Gatherly sample data credentials",
    "",
    `Generated ${now.toISOString()} for database \`${db.databaseName}\`. Rerunning the seed rotates every password below.`,
    "Do not commit this file or paste it into GitHub.",
    "",
    "## Participants (login with email and password)",
    "",
    "Password login sends an OTP to the email address. `gatherlyy.fun` has no MX record, so these accounts cannot finish login.",
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
