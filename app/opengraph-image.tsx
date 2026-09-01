import { ImageResponse } from "next/og";

export const alt = "GeoStats — Geography, with strategy";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 84, background: "#08130f", color: "#eee9d9", border: "18px solid #0f2019" }}>
      <div style={{ display: "flex", color: "#d4bf72", fontSize: 25, letterSpacing: 8, textTransform: "uppercase" }}>The Daily world-data game</div>
      <div style={{ display: "flex", marginTop: 26, fontFamily: "Georgia", fontSize: 112, lineHeight: 1 }}>GeoStats</div>
      <div style={{ display: "flex", marginTop: 22, color: "#a9ad9f", fontSize: 42 }}>Geography, with strategy</div>
      <div style={{ display: "flex", marginTop: 62, width: 760, height: 3, background: "#d4bf72" }} />
      <div style={{ display: "flex", marginTop: 24, color: "#78b99a", fontSize: 25 }}>Draft countries against verified world statistics</div>
    </div>,
    size,
  );
}
