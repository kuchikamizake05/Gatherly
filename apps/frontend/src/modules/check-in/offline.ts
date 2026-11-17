import { get, set } from "idb-keyval";
import type { LookupTicket } from "./api";

export type OfflineBundle = {
  tickets: LookupTicket[];
  qrHashes: string[];
  generatedAt: string;
  expiresAt?: string;
};
export type OfflineEntry = {
  id: string;
  ticketCode: string;
  scannedAt: string;
};
const key = (account: string, event: string, suffix: string) =>
  `gatherly.scan.${account}.${event}.${suffix}`;
export const loadQueue = async (account: string, event: string) =>
  (await get<OfflineEntry[]>(key(account, event, "queue"))) ?? [];
export const saveQueue = (
  account: string,
  event: string,
  queue: OfflineEntry[],
) => set(key(account, event, "queue"), queue);
export const loadBundle = (account: string, event: string) =>
  get<OfflineBundle>(key(account, event, "bundle"));
export const saveBundle = (
  account: string,
  event: string,
  bundle: OfflineBundle,
) => set(key(account, event, "bundle"), bundle);
export async function resolveOffline(
  bundle: OfflineBundle | undefined,
  input: { qrPayload: string } | { ticketCode: string },
  queue: OfflineEntry[],
  now: number,
) {
  if (
    !bundle?.tickets.length ||
    !bundle.expiresAt ||
    Date.parse(bundle.expiresAt) <= now
  )
    throw { code: "NETWORK_ERROR" };
  let ticket: LookupTicket | undefined;
  if ("ticketCode" in input)
    ticket = bundle.tickets.find((t) => t.ticketCode === input.ticketCode);
  else {
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(input.qrPayload),
        ),
      ),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const index = bundle.qrHashes.indexOf(hash);
    if (index >= 0) ticket = bundle.tickets[index];
  }
  if (!ticket) throw { code: "INVALID_TICKET" };
  if (
    ticket.checkInStatus === "used" ||
    queue.some((entry) => entry.ticketCode === ticket.ticketCode)
  )
    throw {
      code: "TICKET_ALREADY_USED",
      details: { checkedInAt: ticket.checkedInAt },
    };
  if (ticket.checkInStatus === "cancelled") throw { code: "TICKET_CANCELLED" };
  return ticket;
}
