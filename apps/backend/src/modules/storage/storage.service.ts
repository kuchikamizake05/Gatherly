import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Schema, model, Types, type ClientSession } from "mongoose";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";

const assetSchema = new Schema(
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
);
export const StorageAsset = model("StorageAsset", assetSchema);

export async function getUpload(id: string, ownerId?: string) {
  if (!Types.ObjectId.isValid(id)) throw new AppError(404, "NOT_FOUND", "Document not found.");
  const asset = await StorageAsset.findOne({ _id: id, ...(ownerId ? { ownerId } : {}) });
  if (!asset) throw new AppError(404, "NOT_FOUND", "Document not found.");
  return asset;
}
export async function claimUploads(ids: string[], ownerId: string, session?: ClientSession) {
  for (const id of ids) {
    if (!Types.ObjectId.isValid(id))
      throw new AppError(400, "INVALID_DOCUMENT", "Document is invalid.");
    const changed = await StorageAsset.updateOne(
      { _id: id, ownerId },
      { $set: { attachedAt: new Date() } },
      { session },
    );
    if (changed.matchedCount !== 1)
      throw new AppError(403, "FORBIDDEN", "Document is not owned by this upload session.");
  }
}

function storage() {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new AppError(503, "STORAGE_UNAVAILABLE", "Storage is unavailable.");
  }
  return new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });
}

export function validateUpload(
  file: { buffer: Buffer; mimetype: string; size: number },
  maxSize = 2 * 1024 * 1024,
) {
  const b = file.buffer;
  const detected =
    b.subarray(0, 5).toString() === "%PDF-"
      ? "application/pdf"
      : b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
        ? "image/jpeg"
        : b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? "image/png"
          : b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP"
            ? "image/webp"
            : null;
  if (!detected || detected !== file.mimetype)
    throw new AppError(
      400,
      "INVALID_FILE_TYPE",
      "Only valid JPEG, PNG, WebP or PDF files are supported.",
    );
  if (
    !file.size ||
    file.size > maxSize ||
    (detected.startsWith("image/") && file.size > 1024 * 1024)
  ) {
    throw new AppError(400, "FILE_TOO_LARGE", "Images must be at most 1 MB and PDFs at most 2 MB.");
  }
  return detected;
}

export async function storeUpload(
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  options: { ownerId?: string; purpose?: string; private?: boolean } = {},
) {
  validateUpload(file);
  const purpose = options.purpose ?? "document";
  const key = `${options.private === false ? "media" : "private"}/${purpose.replace(/[^a-zA-Z0-9_-]/g, "")}/${randomUUID()}`;
  const client = storage();
  await client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }),
  );
  let asset;
  try {
    asset = await StorageAsset.create({
      key,
      name: file.originalname.slice(0, 200),
      type: file.mimetype,
      size: file.size,
      ownerId: options.ownerId,
      purpose,
      private: options.private !== false,
    });
  } catch (error) {
    await client
      .send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }))
      .catch(() => undefined);
    throw error;
  }
  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    size: asset.size,
    url: await signedDocumentUrl(asset.id),
  };
}

export async function signedDocumentUrl(id: string) {
  const asset = await StorageAsset.findById(id);
  if (!asset) throw new AppError(404, "NOT_FOUND", "Document not found.");
  return getSignedUrl(
    storage(),
    new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: asset.key }),
    { expiresIn: 300 },
  );
}

export async function cleanupAssets() {
  const assets = await StorageAsset.find({
    $or: [
      { deleteAfter: { $lte: new Date() } },
      { attachedAt: { $exists: false }, createdAt: { $lt: new Date(Date.now() - 24 * 3600_000) } },
    ],
  }).limit(50);
  for (const asset of assets) {
    await storage().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: asset.key }));
    await StorageAsset.deleteOne({ _id: asset._id });
  }
}

export async function publicAssetUrl(id?: string) {
  if (!id) return null;
  const asset = await StorageAsset.findById(id);
  if (!asset || asset.private) return null;
  return env.R2_PUBLIC_URL
    ? `${env.R2_PUBLIC_URL.replace(/\/$/, "")}/${asset.key}`
    : `/api/v1/media/${asset.id}`;
}
