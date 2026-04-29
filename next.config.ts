import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },
  // Increase serverless function timeout for pipeline runs
  serverExternalPackages: [],
};

export default nextConfig;
