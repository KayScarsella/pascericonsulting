import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["@google/earthengine"],
  experimental: {
    optimizePackageImports: ["radix-ui", "@turf/turf"],
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
