import { Schema, model } from "mongoose";
import type { RequestHandler } from "express";
import { hashToken } from "./crypto.js";
const schema = new Schema({
  key: { type: String, unique: true, required: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});
export const RateLimitBucket = model("RateLimitBucket", schema);
export function databaseRateLimit(limit: number, windowMs: number): RequestHandler {
  return async (req, res, next) => {
    try {
      const window = Math.floor(Date.now() / windowMs);
      const key = hashToken(`${req.ip}:${req.baseUrl}:${window}`);
      let row;
      try {
        row = await RateLimitBucket.findOneAndUpdate(
          { key },
          { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((window + 1) * windowMs) } },
          { upsert: true, returnDocument: "after" },
        );
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        row = await RateLimitBucket.findOneAndUpdate(
          { key },
          { $inc: { count: 1 } },
          { returnDocument: "after" },
        );
      }
      if ((row?.count ?? limit + 1) > limit) {
        res.setHeader("Retry-After", Math.ceil(((window + 1) * windowMs - Date.now()) / 1000));
        res
          .status(429)
          .json({
            error: { code: "RATE_LIMITED", message: "Too many attempts. Please retry later." },
          });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
