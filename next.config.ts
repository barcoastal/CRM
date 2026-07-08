import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep pdfjs-dist out of the server bundle so its worker module resolves from
  // node_modules at runtime (anchors.ts loads the legacy build server-side).
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
