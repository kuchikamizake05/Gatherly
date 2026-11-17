import { PHASE_PRODUCTION_BUILD } from "next/constants.js";

/** @param {string} phase @returns {import('next').NextConfig} */
export default function nextConfig(phase) {
  const apiInternalUrl = (
    process.env.API_INTERNAL_URL?.trim() || "http://localhost:4000"
  ).replace(/\/$/, "");
  if (
    phase === PHASE_PRODUCTION_BUILD &&
    process.env.GATHERLY_PRODUCTION_BUILD === "true"
  ) {
    let backend;
    try {
      backend = new URL(apiInternalUrl);
    } catch {
      throw new Error("API_INTERNAL_URL must be a valid HTTPS backend origin.");
    }
    if (
      backend.protocol !== "https:" ||
      backend.username ||
      backend.password ||
      backend.pathname !== "/" ||
      backend.search ||
      backend.hash ||
      /(^|\.)localhost$|^127\.|^0\.0\.0\.0$|^\[::1\]$/.test(backend.hostname)
    ) {
      throw new Error(
        "API_INTERNAL_URL must be an HTTPS backend origin without credentials, path, query, or fragment for a production release.",
      );
    }
    if (process.env.NEXT_PUBLIC_API_MOCK !== "false")
      throw new Error(
        "Production releases must explicitly disable NEXT_PUBLIC_API_MOCK.",
      );
    const publicApi = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (
      publicApi &&
      !(publicApi.startsWith("/") && !publicApi.startsWith("//"))
    ) {
      const url = new URL(publicApi);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error(
          "NEXT_PUBLIC_API_URL must be an HTTPS URL or a same-origin path.",
        );
    }
  }
  return {
    poweredByHeader: false,
    // Jangan buat AGENTS.md otomatis saat next dev.
    agentRules: false,
    async rewrites() {
      return [
        {
          source: "/api/v1/:path*",
          destination: `${apiInternalUrl}/api/v1/:path*`,
        },
      ];
    },
    async headers() {
      return [
        {
          source: "/:path*",
          headers: [
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "X-Frame-Options", value: "SAMEORIGIN" },
            {
              key: "Content-Security-Policy",
              value:
                "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
            },
            {
              key: "Referrer-Policy",
              value: "strict-origin-when-cross-origin",
            },
            {
              key: "Permissions-Policy",
              value: "camera=(self), microphone=()",
            },
            ...(process.env.NODE_ENV === "production"
              ? [
                  {
                    key: "Strict-Transport-Security",
                    value: "max-age=31536000",
                  },
                ]
              : []),
          ],
        },
      ];
    },
    images: {
      remotePatterns: [
        { protocol: "https", hostname: "res.cloudinary.com" },
        { protocol: "https", hostname: "images.unsplash.com" },
      ],
    },
  };
}
