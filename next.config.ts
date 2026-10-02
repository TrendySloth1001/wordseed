import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The corpus and neural weights are read from disk at runtime, so they must
  // ship with the server build.
  outputFileTracingIncludes: {
    "/api/*": ["./data/corpus/*.txt", "./data/neural/model.*"],
  },
};

export default nextConfig;
