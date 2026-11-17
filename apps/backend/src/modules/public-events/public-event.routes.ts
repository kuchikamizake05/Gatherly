import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import { hashToken } from "../../lib/crypto.js";
import { Session, User } from "../auth/auth.models.js";
import { parseInput } from "../account/account.schemas.js";
import {
  publicEventList,
  publicEventDetail,
  publicSuggestions,
  publicEventQuery,
} from "./public-event.service.js";

async function optionalUserId(request: Request) {
  const cookie = request.cookies?.gatherly_session;
  if (typeof cookie !== "string") return undefined;
  const session = await Session.findOne({
    tokenHash: hashToken(cookie),
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!session) return undefined;
  return (await User.exists({ _id: session.userId, deletedAt: { $exists: false } }))
    ? session.userId.toString()
    : undefined;
}
export const publicEventRouter = Router();
publicEventRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    response.json(
      await publicEventList(
        parseInput(publicEventQuery, request.query),
        await optionalUserId(request),
      ),
    );
  }),
);
publicEventRouter.get(
  "/suggestions",
  asyncHandler(async (request, response) => {
    const { q } = parseInput(
      z.object({ q: z.string().trim().max(100).default("") }),
      request.query,
    );
    response.json({ data: await publicSuggestions(q ?? "", await optionalUserId(request)) });
  }),
);
publicEventRouter.get(
  "/:slug",
  asyncHandler(async (request, response) => {
    response.json({
      data: await publicEventDetail(String(request.params.slug), await optionalUserId(request)),
    });
  }),
);
