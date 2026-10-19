import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // This standalone app has its own dependencies; do not watch local database/runtime files in the monorepo.
  turbopack: { root: process.cwd() },
  // Authorization codes/state must never appear in development request logs.
  logging: { incomingRequests: { ignore: [/\/api\/admin\/callback/] } },
  async headers() {
    return [
      { source: "/:path*", headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'" },
      ] },
      { source: "/dashboard/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
      { source: "/curriculum/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
      { source: "/questions/:path*", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};

export default nextConfig;
