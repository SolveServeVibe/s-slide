import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["pptxgenjs", "almostnode"]
  }
};

export default nextConfig;
