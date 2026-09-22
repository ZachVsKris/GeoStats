import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GeoStats",
    short_name: "GeoStats",
    description: "A strategy-first geography game powered by verified country data",
    start_url: "/daily",
    display: "standalone",
    background_color: "#e8f3f8",
    theme_color: "#e8f3f8",
    icons: [{ src: "/icon.svg?v=atlas-2", sizes: "any", type: "image/svg+xml" }],
  };
}
