import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Coastal CRM",
    short_name: "Coastal CRM",
    description: "Debt Settlement Intelligence Platform by Coastal Debt Resolve",
    start_url: "/",
    display: "standalone",
    background_color: "#283044",
    theme_color: "#3052FF",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
