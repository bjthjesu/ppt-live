import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",

  allowedDevOrigins: [
    "192.168.68.58",
  ],
};

export default nextConfig;
