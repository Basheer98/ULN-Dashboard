import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@uln/database", "@uln/shared"],
  devIndicators: false,
};

export default nextConfig;
