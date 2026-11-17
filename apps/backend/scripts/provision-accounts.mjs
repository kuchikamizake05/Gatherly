/** Run with node --import tsx scripts/provision-accounts.mjs. Secrets come from env only. */
import "dotenv/config";
import mongoose from "mongoose";
import { seedAdmin } from "../src/modules/admin/admin-auth.routes.ts";
import { migrateLegacyOrganizer } from "../src/modules/workspace/migrate-organizer.ts";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}
await mongoose.connect(required("MONGODB_URI"));
try {
  if (process.env.PROVISION_MODE === "admin") {
    await seedAdmin({
      email: required("ADMIN_SEED_EMAIL"),
      name: required("ADMIN_SEED_NAME"),
      password: required("ADMIN_SEED_PASSWORD"),
      totpSecret: required("ADMIN_SEED_TOTP_SECRET"),
      backupCodes: required("ADMIN_SEED_BACKUP_CODES")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      primary: process.env.ADMIN_SEED_PRIMARY === "true",
    });
    console.info("Admin account provisioned. Credentials were not printed.");
  } else if (process.env.PROVISION_MODE === "legacy-organizer") {
    await migrateLegacyOrganizer({
      organizerId: required("MIGRATE_ORGANIZER_ID"),
      username: required("MIGRATE_ORGANIZER_USERNAME"),
      temporaryPassword: required("MIGRATE_ORGANIZER_PASSWORD"),
    });
    console.info("Legacy organizer workspace provisioned. Existing event ownership preserved.");
  } else throw new Error("PROVISION_MODE must be admin or legacy-organizer");
} finally {
  await mongoose.disconnect();
}
