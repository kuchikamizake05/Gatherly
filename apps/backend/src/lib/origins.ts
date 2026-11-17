import type { Request } from "express";

import { env } from "../config/env.js";

/**
 * Browser origins allowed to call the API: the main site, the organizer and admin
 * subdomains, and local development hosts. Configure with WEB_ORIGINS (comma separated);
 * WEB_ORIGIN alone is used when WEB_ORIGINS is not set.
 */
export function allowedOrigins(): string[] {
  return (env.WEB_ORIGINS ?? env.WEB_ORIGIN)
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string | undefined | null): origin is string {
  return Boolean(origin) && allowedOrigins().includes(origin!);
}

function originOf(value: string | undefined) {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

/**
 * The allowed site the browser is on. Requests reach the API through the frontend
 * rewrite, so the Origin header, the forwarded host, and the Referer are checked in
 * that order. Anything outside the allow list falls back to WEB_ORIGIN.
 */
export function requestOrigin(request: Request): string {
  const forwardedHost = request.get("X-Forwarded-Host")?.split(",")[0]?.trim();
  const forwardedProto = request.get("X-Forwarded-Proto")?.split(",")[0]?.trim() ?? "https";
  const candidates = [
    request.get("Origin"),
    forwardedHost ? `${forwardedProto}://${forwardedHost}` : undefined,
    originOf(request.get("Referer")),
  ];
  return candidates.find(isAllowedOrigin) ?? env.WEB_ORIGIN.replace(/\/+$/, "");
}

/** Only same-site paths, so a crafted link cannot redirect to another site. */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.includes("\\") || value.length > 500) return "/";
  return value;
}
