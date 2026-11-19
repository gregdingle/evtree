import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // reactStrictMode: false, // Temporarily disabled to test double-mount issue
  // cacheComponents: true, TODO: actually add some cached components
  reactCompiler: true,
  turbopack: {
    // Pin the root so a stray lockfile in a parent dir isn't picked as the workspace root
    root: __dirname,
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
