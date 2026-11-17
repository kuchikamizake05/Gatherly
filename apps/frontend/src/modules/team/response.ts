import { z } from "zod";
export const teamResponse = z.array(
  z.object({
    id: z.string().min(1),
    name: z.string(),
    username: z.string().min(1),
    assignedEvents: z.number().int().min(-1),
    status: z.enum(["owner", "active", "never_logged_in", "inactive"]),
    eventIds: z.array(z.string()).optional(),
    email: z.string().optional(),
  }),
);
export const credentialsResponse = z.object({
  username: z.string().min(1),
  temporaryPassword: z.string().min(1),
  expiresAt: z.string().datetime({ offset: true }),
});
