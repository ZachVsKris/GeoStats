import type { Metadata, Viewport } from "next";
import "./styles.css";
import AnalyticsPageView from "../components/AnalyticsPageView";

export const viewport: Viewport = { themeColor: "#e8f3f8" };

export const metadata: Metadata = {
  metadataBase: new URL("https://geostats.xyz"),
  title: { default: "GeoStats", template: "%s | GeoStats" },
  description: "A strategy-first geography game powered by verified country data",
  applicationName: "GeoStats",
  alternates: { canonical: "/daily" },
  keywords: ["geography game", "country statistics", "daily game", "world data"],
  openGraph: {
    type: "website",
    siteName: "GeoStats",
    title: "GeoStats — A world of facts. One perfect fit.",
    description: "Draft countries against verified world statistics in a new Daily board",
    url: "/daily",
  },
  twitter: {
    card: "summary_large_image",
    title: "GeoStats — A world of facts. One perfect fit.",
    description: "Draft countries against verified world statistics in a new Daily board",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AnalyticsPageView />{children}</body></html>;
}
