import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep pdfjs-dist out of the server bundle so its worker module resolves from
  // node_modules at runtime (anchors.ts loads the legacy build server-side).
  serverExternalPackages: ["pdfjs-dist"],
  async headers() {
    return [
      {
        source: "/salesforce-sign/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors https://cdcrm--newdocusig.sandbox.lightning.force.com",
          },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        // Allow the closers window to be embedded inside the Five9 agent
        // desktop (Web Connector). Scoped to this route only.
        source: "/closers-window",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https://*.five9.com",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
