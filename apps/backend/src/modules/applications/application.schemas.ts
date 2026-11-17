import { z } from "zod";
import { usernameSchema } from "../workspace/workspace.routes.js";
export const applicationInputSchema = z
  .object({
    organizerName: z.string().trim().min(2).max(150),
    organizerType: z.enum(["komunitas", "organisasi_kampus", "perusahaan", "individu"]),
    description: z.string().trim().min(10).max(2000),
    address: z.object({
      province: z.string().trim().min(1).max(100),
      city: z.string().trim().min(1).max(100),
      street: z.string().trim().min(5).max(500),
      postalCode: z.string().regex(/^\d{5}$/),
    }),
    links: z
      .array(
        z.object({
          type: z.enum(["instagram", "tiktok", "youtube", "website", "lainnya"]),
          url: z
            .string()
            .trim()
            .min(3)
            .max(500)
            .refine((v) => !/^(javascript|data):/i.test(v), "Invalid link"),
        }),
      )
      .max(5),
    pic: z.object({
      name: z.string().trim().min(2).max(100),
      role: z.string().trim().min(1).max(100),
      email: z.string().trim().email().toLowerCase(),
      phone: z.string().trim().min(8).max(30),
    }),
    username: usernameSchema,
    ktp: z.string().min(1),
    legalDocument: z.string().min(1).nullable().optional(),
  })
  .strict();
export const applicationFlagSchema = z.object({
  flags: z
    .array(
      z.object({
        field: z.enum([
          "organizerName",
          "organizerType",
          "description",
          "address",
          "links",
          "pic",
          "username",
          "ktp",
          "legalDocument",
        ]),
        note: z.string().trim().min(1).max(1000),
      }),
    )
    .min(1)
    .max(10),
});
export function requiresLegalDocument(type: string) {
  return type === "perusahaan" || type === "organisasi_kampus";
}
export function assertDocumentKind(
  kind: "ktp" | "legalDocument",
  file: { type: string; size: number },
) {
  if (kind === "ktp")
    return (
      ["image/jpeg", "image/png", "application/pdf"].includes(file.type) && file.size <= 1024 * 1024
    );
  return file.type === "application/pdf" && file.size <= 2 * 1024 * 1024;
}
