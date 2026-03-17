import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const name = searchParams.get("name") ?? "Candidato";
  const cargo = searchParams.get("cargo") ?? "";
  const partido = searchParams.get("partido") ?? "";
  const region = searchParams.get("region") ?? "";
  const procesos = Number(searchParams.get("procesos") ?? "0");
  const color = searchParams.get("color") ?? "#6b7280";

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#111111",
          fontFamily: "sans-serif",
          padding: "48px 56px",
        }}
      >
        {/* Red top bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, backgroundColor: "#e53935" }} />

        {/* Site label */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 40 }}>
          <span style={{ color: "#9ca3af", fontSize: 18 }}>
            Elecciones{" "}
            <span style={{ color: "#e53935", fontWeight: 700 }}>Perú</span>{" "}
            2026
          </span>
        </div>

        {/* Main content */}
        <div style={{ display: "flex", alignItems: "center", gap: 36, flex: 1 }}>
          {/* Avatar circle */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 42,
              fontWeight: 700,
              color: "#ffffff",
              flexShrink: 0,
            }}
          >
            {initials}
          </div>

          {/* Text block */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 52, fontWeight: 800, color: "#ffffff", lineHeight: 1.1 }}>
              {name}
            </div>
            {cargo && (
              <div style={{ fontSize: 24, color: "#9ca3af", display: "flex", gap: 16 }}>
                {cargo}
                {partido && <span>· {partido}</span>}
                {region && <span>· {region}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Bottom stat row */}
        <div style={{ display: "flex", gap: 20, marginTop: 32 }}>
          <div
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              backgroundColor: procesos > 0 ? "#7f1d1d" : "#14532d",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 28, fontWeight: 700, color: "#ffffff" }}>{procesos}</span>
            <span style={{ fontSize: 13, color: "#d1fae5", marginTop: 2 }}>
              {procesos > 0 ? "Procesos judiciales" : "Sin procesos"}
            </span>
          </div>

          <div
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              backgroundColor: "#1e3a5f",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 20, fontWeight: 700, color: "#ffffff" }}>JNE</span>
            <span style={{ fontSize: 13, color: "#bfdbfe", marginTop: 2 }}>Fuente oficial</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
