import mongoose from "mongoose";
import { env } from "./env.js";

let connection: Promise<typeof mongoose> | undefined;

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) return;
  connection ??= mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  try {
    await connection;
  } catch (error) {
    connection = undefined;
    throw error;
  }
}
