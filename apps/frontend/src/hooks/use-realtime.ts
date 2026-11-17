"use client";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

/** API stays behind the Vercel rewrite. Single-use grants authenticate the direct VPS socket. */
export function useRealtime(
  topic: "order" | "event",
  id: string,
  enabled = true,
) {
  const client = useQueryClient();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_WS_URL;
    if (!enabled || !id || !base) return;
    let disposed = false;
    let socket: WebSocket | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (topic === "order") {
        void client.invalidateQueries({ queryKey: ["order", id] });
        void client.invalidateQueries({ queryKey: ["tickets"] });
      } else {
        void client.invalidateQueries({ queryKey: ["scan", id] });
        void client.invalidateQueries({ queryKey: ["org", "event", id] });
        void client.invalidateQueries({ queryKey: ["org", "summary"] });
      }
    };
    async function connect() {
      try {
        const { data } = await api.post<{ data: { token: string } }>(
          "/realtime/ticket",
        );
        if (disposed) return;
        const url = new URL(base!);
        url.searchParams.set("ticket", data.token);
        socket = new WebSocket(url.toString());
        socket.onopen = () =>
          socket?.send(JSON.stringify({ action: "subscribe", topic, id }));
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "subscribed") {
              setConnected(true);
              refresh();
            } else if (data.topic === topic && data.id === id) refresh();
          } catch {
            /* Ignore malformed frames. */
          }
        };
        socket.onclose = () => {
          setConnected(false);
          if (!disposed) timer = setTimeout(connect, 5000);
        };
        socket.onerror = () => socket?.close();
      } catch {
        if (!disposed) timer = setTimeout(connect, 5000);
      }
    }
    void connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      socket?.close();
      setConnected(false);
    };
  }, [topic, id, enabled, client]);
  return connected;
}
