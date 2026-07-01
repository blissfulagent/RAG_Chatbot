import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'better-sqlite3'],
  output: 'standalone',
};

export default nextConfig;
