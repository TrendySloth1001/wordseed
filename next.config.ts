import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating navigation covers the bottom corners, where the development
  // badge would otherwise sit.
  devIndicators: { position: "top-right" },
  // The corpus and neural weights are read from disk at runtime, so they must
  // ship with the server build.
  outputFileTracingIncludes: {
    "/api/*": ["./data/corpus/*.txt", "./data/neural/model.*", "./data/offline-manifest.json"],
    "/corpus/*": ["./data/corpus/*.txt"],
    "/docs": ["./data/corpus/*.txt", "./data/neural/model.*"],
  },
  // The service worker must never be served from the HTTP cache, or browsers
  // would keep running an old version of it.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
