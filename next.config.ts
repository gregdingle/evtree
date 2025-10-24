import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // reactStrictMode: false, // Temporarily disabled to test double-mount issue
  experimental: {
    reactCompiler: true,
  },
  turbopack: {
    // See https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#webpack-loaders
    rules: {
      "*.md": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
