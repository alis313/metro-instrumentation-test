import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel doesn't need "standalone" output - it has its own build system.
  // For self-hosting (VPS/Docker), uncomment the line below:
  // output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow large Excel file uploads (default ~4.5MB on Vercel Hobby, raised to 50MB)
  experimental: {
    proxyClientMaxBodySize: 50 * 1024 * 1024,
  },
  // xlsx is a Node.js module that must be external (not bundled by Turbopack)
  serverExternalPackages: ["xlsx", "@vercel/blob"],
  // For self-hosting with standalone output, add:
  // outputFileTracingIncludes: { "/api/**": ["./node_modules/xlsx/**/*"] },
};

export default nextConfig;
