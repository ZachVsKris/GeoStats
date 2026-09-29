import type { Metadata, Viewport } from "next";
import "./styles.css";
import { animalPreviewEnabled } from "../lib/animalstatsPreview";
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
    title: "GeoStats",
    description: "Match countries to world statistics in a new Daily board",
    url: "/daily",
  },
  twitter: {
    card: "summary_large_image",
    title: "GeoStats",
    description: "Match countries to world statistics in a new Daily board",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AnalyticsPageView />{animalPreviewEnabled() && <nav aria-label="CAT preview worlds" className="catPreviewStrip" style={{ display:"flex", flexWrap:"wrap", gap:16, padding:"10px 16px", background:"#eee9d8", color:"#294032", fontSize:12, borderBottom:"1px solid #bec6ad" }}><a href="/cat" style={{ color:"inherit", fontWeight:700 }}>C A T</a><a href="/daily" style={{ color:"inherit" }}>Countries</a><a href="/animals" style={{ color:"inherit" }}>Animals</a><a href="/cat#things" style={{ color:"inherit" }}>Things · still digging</a></nav>}{children}</body></html>;
}
