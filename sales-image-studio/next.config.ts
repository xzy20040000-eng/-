import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  webpack(config) {
    if (process.env.NETLIFY) {
      config.resolve ??= {};
      const localEnv = path.resolve(process.cwd(), "lib/platform-env.ts");
      const netlifyEnv = path.resolve(process.cwd(), "lib/netlify-workers.ts");
      config.resolve.alias = { ...config.resolve.alias, "@/lib/platform-env": netlifyEnv, [localEnv]: netlifyEnv };
    }
    return config;
  },
};

export default nextConfig;
