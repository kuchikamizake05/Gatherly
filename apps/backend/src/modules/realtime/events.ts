import { Schema, model, type ClientSession } from "mongoose";
export type Update = { topic: "order" | "event"; id: string; type: string };
const schema = new Schema({
  topic: { type: String, enum: ["order", "event"], required: true },
  resourceId: { type: String, required: true },
  type: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, index: { expires: 3600 } },
});
export const RealtimeEvent = model("RealtimeEvent", schema);
export async function publishUpdate(update: Update, session?: ClientSession) {
  await RealtimeEvent.create(
    [{ topic: update.topic, resourceId: update.id, type: update.type }],
    session ? { session } : undefined,
  );
}
