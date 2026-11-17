import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { AppError } from "../../lib/app-error.js";
import { Organizer } from "../organizers/organizer.model.js";
import { WorkspaceAccount } from "./workspace.models.js";
import { usernameSchema, strongPassword } from "./workspace.routes.js";

/** Explicit opt-in migration. Existing owner and event identifiers are preserved. */
export async function migrateLegacyOrganizer(input: {
  organizerId: string;
  username: string;
  temporaryPassword: string;
}) {
  const username = usernameSchema.parse(input.username);
  strongPassword.parse(input.temporaryPassword);
  if (!Types.ObjectId.isValid(input.organizerId))
    throw new AppError(400, "INVALID_ID", "Organizer ID is invalid.");
  const organizer = await Organizer.findById(input.organizerId);
  if (!organizer) throw new AppError(404, "NOT_FOUND", "Organizer not found.");
  if (
    await WorkspaceAccount.exists({
      $or: [{ organizerId: organizer._id, role: "organizer" }, { username }],
    })
  )
    throw new AppError(409, "WORKSPACE_EXISTS", "Workspace account or username already exists.");
  const account = await WorkspaceAccount.create({
    userId: organizer.ownerId,
    organizerId: organizer._id,
    username,
    name: organizer.pic?.name ?? organizer.name,
    email: organizer.contactEmail,
    role: "organizer",
    passwordHash: await bcrypt.hash(input.temporaryPassword, 12),
    mustChangePassword: true,
    temporaryExpiresAt: new Date(Date.now() + 7 * 86400_000),
  });
  organizer.username = username;
  organizer.status = "never_logged_in";
  try {
    await organizer.save();
  } catch (error) {
    await account.deleteOne();
    throw error;
  }
  return { accountId: account.id, organizerId: organizer.id };
}
