import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pptxgenjs", "almostnode"]
};

export default nextConfig;
