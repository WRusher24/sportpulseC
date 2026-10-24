import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ספורט פאלס – SportPulse Israel",
    short_name: "ספורט פאלס",
    description: "חדשות ספורט, משחקים חיים וטבלאות, ואנליסט AI בעברית",
    start_url: "/",
    display: "standalone",
    dir: "rtl",
    lang: "he",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }]
  };
}
