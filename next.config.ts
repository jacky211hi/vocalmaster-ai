import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Auth + multipart audio analysis need dynamic request handling
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
