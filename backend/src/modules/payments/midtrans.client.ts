import { env } from "../../config/env.js";
import { snapResponseSchema, type SnapRequest } from "./payment.schemas.js";

const sandboxSnapUrl = "https://app.sandbox.midtrans.com/snap/v1/transactions";

export type SnapResult =
  | { kind: "success"; token: string; redirectUrl: string }
  | { kind: "rejected"; status: number }
  | { kind: "rate_limited" }
  | { kind: "uncertain"; reason: "timeout" | "network" | "provider" | "malformed" };

export type SnapTransport = (payload: SnapRequest) => Promise<SnapResult>;

export async function createSnapTransaction(
  payload: SnapRequest,
  fetchImplementation: typeof fetch = fetch,
): Promise<SnapResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.MIDTRANS_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImplementation(sandboxSnapUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${env.MIDTRANS_SERVER_KEY}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (response.status === 429) return { kind: "rate_limited" };
    if ([400, 401, 403].includes(response.status)) {
      return { kind: "rejected", status: response.status };
    }
    if (!response.ok) return { kind: "uncertain", reason: "provider" };

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return { kind: "uncertain", reason: "malformed" };
    }
    const parsed = snapResponseSchema.safeParse(json);
    if (!parsed.success) return { kind: "uncertain", reason: "malformed" };
    return { kind: "success", token: parsed.data.token, redirectUrl: parsed.data.redirect_url };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { kind: "uncertain", reason: "timeout" };
    }
    return { kind: "uncertain", reason: "network" };
  } finally {
    clearTimeout(timeout);
  }
}
