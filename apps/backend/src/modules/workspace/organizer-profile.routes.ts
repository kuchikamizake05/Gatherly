import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/app-error.js";
import { multipartUpload } from "../storage/storage.middleware.js";
import { storeUpload, claimUploads, publicAssetUrl } from "../storage/storage.service.js";
import { requireWorkspace, type WorkspaceRequest } from "./workspace.middleware.js";

export const organizerProfileRouter = Router();
organizerProfileRouter.use(requireWorkspace);
organizerProfileRouter.use((req, _res, next) => {
  const account = (req as WorkspaceRequest).workspace!.account;
  if (account.role !== "organizer" || account.mustChangePassword) {
    next(new AppError(403, "FORBIDDEN", "Organizer access is required."));
    return;
  }
  next();
});
function dto(req: WorkspaceRequest) {
  const org = req.workspace!.organizer;
  return {
    name: org.name,
    username: org.username ?? req.workspace!.account.username,
    city: org.city,
    description: org.description,
    logoUrl: org.logoUrl ?? null,
    links: org.links,
  };
}
organizerProfileRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ data: dto(req as WorkspaceRequest) });
  }),
);
organizerProfileRouter.patch(
  "/",
  multipartUpload,
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        name: z.string().trim().min(2).max(150),
        city: z.string().trim().min(1).max(100),
        description: z.string().trim().min(10).max(2000),
        links: z.preprocess(
          (v) => (typeof v === "string" ? JSON.parse(v) : v),
          z
            .array(
              z.object({
                type: z.string().min(1).max(30),
                url: z
                  .string()
                  .min(3)
                  .max(500)
                  .refine((v) => !/^(javascript|data):/i.test(v)),
              }),
            )
            .max(5),
        ),
      })
      .parse(req.body);
    const workspace = (req as WorkspaceRequest).workspace!;
    const file = (
      req as typeof req & {
        file?: { buffer: Buffer; originalname: string; mimetype: string; size: number };
      }
    ).file;
    if (file) {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.mimetype) ||
        file.size > 1024 * 1024
      )
        throw new AppError(400, "INVALID_IMAGE", "Logo must be an image under 1 MB.");
      const stored = await storeUpload(file, {
        ownerId: workspace.account.userId.toString(),
        purpose: "organizer-logo",
        private: false,
      });
      await claimUploads([stored.id], workspace.account.userId.toString());
      workspace.organizer.logoUrl = (await publicAssetUrl(stored.id)) ?? undefined;
    }
    Object.assign(workspace.organizer, input);
    await workspace.organizer.save();
    res.sendStatus(204);
  }),
);
