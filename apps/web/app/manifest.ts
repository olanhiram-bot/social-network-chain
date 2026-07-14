import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nexo — Onchain social network",
    short_name: "Nexo",
    description: "Your social layer for the onchain internet.",
    start_url: "/",
    display: "standalone",
    background_color: "#06162d",
    theme_color: "#06162d",
    icons: [{ src: "/icon.png", sizes: "1254x1254", type: "image/png", purpose: "any" }],
  };
}
