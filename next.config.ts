import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/parse": ["./node_modules/kuromoji/dict/**"],
    },
  },
};

export default nextConfig;
