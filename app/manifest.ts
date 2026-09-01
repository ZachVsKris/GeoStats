import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GeoStats",
    short_name: "GeoStats",
    description: "A strategy-first geography game powered by verified country data",
    start_url: "/daily",
    display: "standalone",
    background_color: "#08130f",
    theme_color: "#0f2019",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
