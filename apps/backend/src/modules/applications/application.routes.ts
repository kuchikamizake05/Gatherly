import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import { createToken, hashToken } from "../../lib/crypto.js";
import { env } from "../../config/env.js";
import { WorkspaceAccount } from "../workspace/workspace.models.js";
import { Organizer } from "../organizers/organizer.model.js";
import { multipartUpload } from "../storage/storage.middleware.js";
import { storeUpload, claimUploads } from "../storage/storage.service.js";
import { queueEmail } from "../notifications/email.service.js";
import {
  applicationEmailChangedEmail,
  applicationReceivedEmail,
} from "../notifications/email-templates.js";
import {
  ApplicationCounter,
  ApplicationDocument,
  OrganizerApplication,
} from "./application.models.js";
import {
  applicationInputSchema,
  requiresLegalDocument,
  assertDocumentKind,
} from "./application.schemas.js";
import type { Request } from "express";

export const applicationRouter = Router();
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 3600_000,
};
const uploadCookie = "gatherly_application_upload";
const editCookie = "gatherly_application_edit";
const reservedNames = new Set(["admin", "gatherly", "organizer", "api", "support"]);
export async function usernameAvailable(username: string) {
  return (
    !reservedNames.has(username) &&
    !(await WorkspaceAccount.exists({ username })) &&
    !(await Organizer.exists({ username }))
  );
}
export function applicationDto(app: InstanceType<typeof OrganizerApplication>) {
  const {
    editTokenHash: _edit,
    editTokenExpiresAt: _expiry,
    emailVerificationHash: _verify,
    emailVerificationExpiresAt: _verifyExpiry,
    activeEmail: _email,
    __v: _version,
    ...value
  } = app.toObject();
  return { ...value, id: app.id };
}
applicationRouter.get(
  "/username",
  asyncHandler(async (req, res) => {
    const username = z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(40)
      .regex(/^[a-z0-9][a-z0-9._-]*$/)
      .parse(req.query.username);
    res.json({
      data: {
        available: await usernameAvailable(username),
        suggestions: [`${username}.id`, `${username}event`],
      },
    });
  }),
);
applicationRouter.post(
  "/documents",
  multipartUpload,
  asyncHandler(async (req, res) => {
    const file = (
      req as Request & {
        file?: { buffer: Buffer; originalname: string; mimetype: string; size: number };
      }
    ).file;
    if (!file) throw new AppError(400, "FILE_REQUIRED", "Select a document.");
    if (
      !["image/jpeg", "image/png", "application/pdf"].includes(file.mimetype) ||
      file.size > 2 * 1024 * 1024
    )
      throw new AppError(400, "INVALID_DOCUMENT", "Unsupported document type or size.");
    const token =
      typeof req.cookies?.[uploadCookie] === "string"
        ? (req.cookies[uploadCookie] as string)
        : createToken();
    const stored = await storeUpload(file, {
      ownerId: hashToken(token),
      purpose: "organizer-document",
      private: true,
    });
    await ApplicationDocument.create({
      storageId: stored.id,
      ownerTokenHash: hashToken(token),
      name: stored.name,
      type: stored.type,
      size: stored.size,
    });
    res
      .cookie(uploadCookie, token, cookieOptions)
      .status(201)
      .json({ data: { id: stored.id, name: stored.name, type: stored.type, size: stored.size } });
  }),
);
async function getDocument(
  id: string | null | undefined,
  kind: "ktp" | "legalDocument",
  token: string | undefined,
  applicationId?: mongoose.Types.ObjectId,
) {
  if (!id) return null;
  const document = await ApplicationDocument.findOne({
    storageId: id,
    $or: [
      ...(token ? [{ ownerTokenHash: hashToken(token), applicationId: { $exists: false } }] : []),
      ...(applicationId ? [{ applicationId }] : []),
    ],
  });
  if (!document || !assertDocumentKind(kind, document))
    throw new AppError(
      400,
      "INVALID_DOCUMENT",
      "Document does not belong to this submission or exceeds its limits.",
    );
  return document;
}
applicationRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = applicationInputSchema.parse(req.body);
    if (!(await usernameAvailable(input.username)))
      throw new AppError(409, "USERNAME_TAKEN", "Username is unavailable.");
    const existing = await OrganizerApplication.findOne({ activeEmail: input.pic.email });
    if (existing)
      throw new AppError(
        409,
        "APPLICATION_EXISTS",
        "An active application already exists.",
        {},
        { number: existing.number },
      );
    if (await Organizer.exists({ contactEmail: input.pic.email }))
      throw new AppError(409, "ALREADY_ORGANIZER", "Organizer account already exists.");
    if (
      await OrganizerApplication.exists({
        "pic.email": input.pic.email,
        status: "rejected",
        decidedAt: { $gt: new Date(Date.now() - 30 * 86400_000) },
      })
    )
      throw new AppError(
        409,
        "REAPPLICATION_WAIT",
        "Wait 30 days after rejection before reapplying.",
      );
    if (requiresLegalDocument(input.organizerType) && !input.legalDocument)
      throw new AppError(400, "LEGAL_REQUIRED", "Legal document is required.");
    const ktp = await getDocument(input.ktp, "ktp", req.cookies?.[uploadCookie]);
    const legal = await getDocument(
      input.legalDocument,
      "legalDocument",
      req.cookies?.[uploadCookie],
    );
    const month = new Date().toISOString().slice(2, 7).replace("-", "");
    const counter = await ApplicationCounter.findOneAndUpdate(
      { month },
      { $inc: { sequence: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    const number = `PNG-${month}-${counter.sequence.toString().padStart(4, "0")}`;
    const session = await mongoose.startSession();
    const verificationToken = createToken();
    try {
      await session.withTransaction(async () => {
        const [app] = await OrganizerApplication.create(
          [
            {
              ...input,
              number,
              activeEmail: input.pic.email,
              emailVerificationHash: hashToken(verificationToken),
              emailVerificationExpiresAt: new Date(Date.now() + 86400_000),
              ktp: ktp && { id: ktp.storageId, name: ktp.name, type: ktp.type, size: ktp.size },
              legalDocument: legal && {
                id: legal.storageId,
                name: legal.name,
                type: legal.type,
                size: legal.size,
              },
            },
          ],
          { session },
        );
        const ids = [ktp?._id, legal?._id].filter(Boolean);
        const claimed = await ApplicationDocument.updateMany(
          { _id: { $in: ids }, applicationId: { $exists: false } },
          { $set: { applicationId: app!._id } },
          { session },
        );
        if (claimed.modifiedCount !== ids.length)
          throw new AppError(
            409,
            "DOCUMENT_CLAIMED",
            "Document already belongs to an application.",
          );
        await claimUploads(
          [ktp!.storageId, ...(legal ? [legal.storageId] : [])],
          hashToken(req.cookies[uploadCookie]),
          session,
        );
        await queueEmail(
          applicationReceivedEmail(
            `application-received:${app!.id}`,
            input.pic.email,
            number,
            verificationToken,
          ),
          session,
        );
      });
    } finally {
      await session.endSession();
    }
    res.status(201).json({ data: { number, email: input.pic.email } });
  }),
);
applicationRouter.get(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const token = z.string().min(20).max(200).parse(req.query.token);
    const app = await OrganizerApplication.findOneAndUpdate(
      {
        emailVerificationHash: hashToken(token),
        emailVerificationExpiresAt: { $gt: new Date() },
        status: { $in: ["new", "needs_fix", "fix_submitted"] },
      },
      {
        $set: { emailVerifiedAt: new Date() },
        $unset: { emailVerificationHash: 1, emailVerificationExpiresAt: 1 },
      },
    );
    if (!app)
      throw new AppError(
        410,
        "VERIFICATION_EXPIRED",
        "Email verification link is invalid or expired.",
      );
    res.json({
      data: {
        number: app.number,
        verified: true,
        message: "Email penanggung jawab berhasil diverifikasi.",
      },
    });
  }),
);
applicationRouter.post(
  "/lookup",
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        number: z.string().trim().toUpperCase().max(40),
        email: z.string().trim().email().toLowerCase(),
      })
      .parse(req.body);
    const app = await OrganizerApplication.findOne({
      number: input.number,
      "pic.email": input.email,
    });
    if (!app) throw new AppError(404, "NOT_FOUND", "Application was not found.");
    if (app.status !== "needs_fix")
      throw new AppError(409, "NOT_NEEDS_FIX", "Application is not awaiting corrections.");
    if (!app.fixDeadline || app.fixDeadline <= new Date())
      throw new AppError(410, "FIX_EXPIRED", "Correction deadline has passed.");
    const token = createToken();
    app.editTokenHash = hashToken(token);
    app.editTokenExpiresAt = new Date(Date.now() + 3600_000);
    await app.save();
    res.cookie(editCookie, token, cookieOptions).json({ data: applicationDto(app) });
  }),
);
applicationRouter.post(
  "/:number/fix",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[editCookie];
    if (typeof token !== "string")
      throw new AppError(401, "UNAUTHENTICATED", "Open the correction form again.");
    const app = await OrganizerApplication.findOne({
      number: req.params.number,
      editTokenHash: hashToken(token),
      editTokenExpiresAt: { $gt: new Date() },
      status: "needs_fix",
      fixDeadline: { $gt: new Date() },
    });
    if (!app) throw new AppError(410, "FIX_EXPIRED", "Correction session is unavailable.");
    const changes = applicationInputSchema.partial().parse(req.body);
    const fields = app.flags.map((flag) => flag.field);
    if (Object.keys(changes).some((field) => !fields.includes(field)))
      throw new AppError(400, "FIELD_NOT_FLAGGED", "Only flagged fields may be edited.");
    if (fields.some((field) => !Object.prototype.hasOwnProperty.call(changes, field!)))
      throw new AppError(400, "FIX_INCOMPLETE", "Correct every flagged field.");
    const existing = Object.fromEntries(
      Object.keys(applicationInputSchema.shape).map((field) => [field, app.get(field)]),
    );
    const merged = applicationInputSchema.parse({
      ...existing,
      ktp: app.ktp?.id,
      legalDocument: app.legalDocument?.id ?? null,
      ...changes,
    });
    if (!(await usernameAvailable(merged.username)))
      throw new AppError(409, "USERNAME_TAKEN", "Username is unavailable.");
    if (requiresLegalDocument(merged.organizerType) && !merged.legalDocument)
      throw new AppError(400, "LEGAL_REQUIRED", "Legal document is required.");
    const ktp = await getDocument(merged.ktp, "ktp", req.cookies?.[uploadCookie], app._id);
    const legal = await getDocument(
      merged.legalDocument,
      "legalDocument",
      req.cookies?.[uploadCookie],
      app._id,
    );
    const emailChanged = merged.pic.email !== app.pic?.email;
    const verificationToken = emailChanged ? createToken() : undefined;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const update = {
          ...changes,
          ktp: ktp && { id: ktp.storageId, name: ktp.name, type: ktp.type, size: ktp.size },
          legalDocument: legal && {
            id: legal.storageId,
            name: legal.name,
            type: legal.type,
            size: legal.size,
          },
          status: "fix_submitted",
          previousValues: Object.fromEntries(
            Object.keys(changes).map((field) => [field, app.get(field)]),
          ),
        };
        const changed = await OrganizerApplication.updateOne(
          {
            _id: app._id,
            status: "needs_fix",
            version: app.version,
            editTokenHash: hashToken(token),
          },
          {
            $set: {
              ...update,
              ...(emailChanged
                ? {
                    activeEmail: merged.pic.email,
                    emailVerificationHash: hashToken(verificationToken!),
                    emailVerificationExpiresAt: new Date(Date.now() + 86400_000),
                  }
                : {}),
            },
            $inc: { version: 1 },
            $unset: {
              editTokenHash: 1,
              editTokenExpiresAt: 1,
              ...(emailChanged ? { emailVerifiedAt: 1 } : {}),
            },
          },
          { session },
        );
        if (!changed.modifiedCount)
          throw new AppError(
            409,
            "REVIEW_CONFLICT",
            "Application changed. Reload before retrying.",
          );
        await ApplicationDocument.updateMany(
          {
            _id: { $in: [ktp?._id, legal?._id].filter(Boolean) },
            applicationId: { $exists: false },
          },
          { $set: { applicationId: app._id } },
          { session },
        );
        const newDocuments = [ktp, legal].filter((document) => document && !document.applicationId);
        if (newDocuments.length)
          await claimUploads(
            newDocuments.map((document) => document!.storageId),
            hashToken(req.cookies[uploadCookie]),
            session,
          );
        if (emailChanged)
          await queueEmail(
            applicationEmailChangedEmail(
              `application-email:${app.id}:${app.version + 1}`,
              merged.pic.email,
              app.number,
              verificationToken!,
            ),
            session,
          );
      });
    } finally {
      await session.endSession();
    }
    res.clearCookie(editCookie, cookieOptions).sendStatus(204);
  }),
);
