import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    // Next defaults to 1MB, which silently rejects any real attachment.
    // Uploads are additionally capped at 25MB in src/server/ums.ts.
    serverActions: { bodySizeLimit: "26mb" },
  },
};

export default nextConfig;
