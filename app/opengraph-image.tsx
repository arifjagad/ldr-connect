import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "LDR-Connect";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OGImage() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0A0A0B 0%, #1a1a1f 100%)",
        color: "#FFF5F8",
        fontFamily: "system-ui",
        padding: "40px",
      }}
    >
      <div
        style={{
          fontSize: "72px",
          fontWeight: "900",
          marginBottom: "20px",
          background: "linear-gradient(135deg, #FF3D7F 0%, #FF6B9D 100%)",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        LDR-Connect
      </div>
      <div
        style={{
          fontSize: "48px",
          fontWeight: "600",
          marginBottom: "20px",
          textAlign: "center",
          maxWidth: "800px",
        }}
      >
        Main Bareng, Walau Beda Kota
      </div>
      <div
        style={{
          fontSize: "28px",
          color: "#9B93B0",
          textAlign: "center",
          maxWidth: "800px",
        }}
      >
        Platform gaming untuk pasangan LDR
      </div>
    </div>
  );
}
