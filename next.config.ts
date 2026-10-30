import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    // Next defaults to 1MB, which silently rejects any real attachment.
    // Uploads are additionally capped at 25MB in src/server/ums.ts.
    serverActions: { bodySizeLimit: "26mb" },
    // Optimise client-side navigation by pre-fetching on hover
    optimisticClientCache: true,
  },
  // Compress responses with gzip
  compress: true,
  // Optimise images from any trusted origin
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 3600,
  },
  // Strip console.log in production
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
};

export default nextConfig;
