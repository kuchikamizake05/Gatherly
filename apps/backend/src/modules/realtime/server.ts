import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { Types } from "mongoose";
import { env } from "../../config/env.js";
import { hashToken } from "../../lib/crypto.js";
import { SocketGrant, socketIdentity } from "./auth.js";
import { Order } from "../orders/order.model.js";
import { Event } from "../events/event.models.js";
import { Organizer } from "../organizers/organizer.model.js";
import { CommitteeAssignment } from "../committee/committee-assignment.model.js";
import { RealtimeEvent } from "./events.js";

export function attachRealtime(server: Server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  const subscriptions = new Map<
    WebSocket,
    { sessionId: string; workspace: boolean; topics: Set<string>; alive: boolean }
  >();
  server.on("upgrade", async (req, socket, head) => {
    if (req.url?.split("?")[0] !== "/api/v1/realtime") {
      socket.destroy();
      return;
    }
    const allowed = (env.WEB_ORIGINS ?? env.WEB_ORIGIN).split(",").map((s) => s.trim());
    if (!req.headers.origin || !allowed.includes(req.headers.origin)) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }
    try {
      const token = new URL(req.url!, "http://localhost").searchParams.get("ticket") ?? "";
      const grant = token
        ? await SocketGrant.findOneAndDelete({
            tokenHash: hashToken(token),
            expiresAt: { $gt: new Date() },
          })
        : null;
      if (!grant) throw new Error("Invalid WebSocket ticket");
      await socketIdentity(grant.sessionId, !!grant.workspace);
      wss.handleUpgrade(req, socket, head, (ws) => {
        subscriptions.set(ws, {
          sessionId: grant.sessionId,
          workspace: !!grant.workspace,
          topics: new Set(),
          alive: true,
        });
        ws.on("pong", () => {
          const item = subscriptions.get(ws);
          if (item) item.alive = true;
        });
        ws.on("close", () => subscriptions.delete(ws));
        ws.on("error", () => ws.close());
        ws.on("message", async (raw) => {
          try {
            const data = JSON.parse(raw.toString());
            if (!["order", "event"].includes(data.topic) || !Types.ObjectId.isValid(data.id))
              return;
            const entry = subscriptions.get(ws);
            if (!entry) return;
            const name = `${data.topic}:${data.id}`;
            if (data.action === "unsubscribe") {
              entry.topics.delete(name);
              return;
            }
            if (data.action !== "subscribe" || entry.topics.size >= 20) return;
            const userId = await socketIdentity(entry.sessionId, entry.workspace);
            let allowed = false;
            if (data.topic === "order")
              allowed = !!(await Order.exists({ _id: data.id, buyerId: userId }));
            else {
              const event = await Event.findById(data.id);
              allowed =
                !!event &&
                (!!(await Organizer.exists({ _id: event.organizerId, ownerId: userId })) ||
                  !!(await CommitteeAssignment.exists({ eventId: event._id, userId })));
            }
            if (allowed) {
              entry.topics.add(name);
              ws.send(JSON.stringify({ type: "subscribed", topic: data.topic, id: data.id }));
            } else ws.send(JSON.stringify({ type: "forbidden" }));
          } catch {
            ws.send(JSON.stringify({ type: "error" }));
          }
        });
        ws.send(JSON.stringify({ type: "connected" }));
      });
    } catch {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
    }
  });
  let cursor = new Types.ObjectId();
  let running = false;
  const pump = setInterval(async () => {
    if (running || !subscriptions.size) return;
    running = true;
    try {
      const updates = await RealtimeEvent.find({ _id: { $gt: cursor } })
        .sort({ _id: 1 })
        .limit(200)
        .lean();
      for (const update of updates) {
        cursor = update._id;
        for (const [ws, entry] of subscriptions) {
          if (
            !entry.topics.has(`${update.topic}:${update.resourceId}`) ||
            ws.readyState !== WebSocket.OPEN
          )
            continue;
          // Revalidate the session and current event assignment before every delivery.
          try {
            const uid = await socketIdentity(entry.sessionId, entry.workspace);
            const permitted =
              update.topic === "order"
                ? !!(await Order.exists({ _id: update.resourceId, buyerId: uid }))
                : !!(await CommitteeAssignment.exists({
                    eventId: update.resourceId,
                    userId: uid,
                  })) ||
                  !!(await Event.exists({
                    _id: update.resourceId,
                    organizerId: { $in: await Organizer.find({ ownerId: uid }).distinct("_id") },
                  }));
            if (permitted)
              ws.send(
                JSON.stringify({ topic: update.topic, id: update.resourceId, type: update.type }),
              );
            else entry.topics.delete(`${update.topic}:${update.resourceId}`);
          } catch {
            ws.close(1008, "Session expired");
          }
        }
      }
    } catch {
      console.error("Realtime update delivery failed");
    } finally {
      running = false;
    }
  }, 1000);
  const heartbeat = setInterval(() => {
    for (const [ws, entry] of subscriptions) {
      if (!entry.alive) {
        ws.terminate();
        continue;
      }
      entry.alive = false;
      ws.ping();
    }
  }, 30_000);
  server.on("close", () => {
    clearInterval(pump);
    clearInterval(heartbeat);
    wss.close();
  });
}
