import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/parse": ["./node_modules/kuromoji/dict/**"],
  },
};

export default nextConfig;
