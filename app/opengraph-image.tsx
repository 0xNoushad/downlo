import { ImageResponse } from "next/og";

export const alt =
  "Video Downloader - Download videos from YouTube, TikTok, Instagram and more";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f0f8ff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#1a1a1a",
            borderRadius: 20,
            width: 120,
            height: 120,
            marginBottom: 40,
          }}
        >
          <div style={{ fontSize: 60, color: "white" }}>⬇️</div>
        </div>
        <div
          style={{
            fontSize: 60,
            fontWeight: "bold",
            color: "#1a1a1a",
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          Video Downloader
        </div>
        <div
          style={{
            fontSize: 30,
            color: "#4a5568",
            textAlign: "center",
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          Download videos from YouTube, TikTok, Instagram and more
        </div>
        <div
          style={{
            display: "flex",
            gap: 20,
            marginTop: 40,
            fontSize: 24,
          }}
        >
          <div
            style={{
              backgroundColor: "#1a1a1a",
              color: "white",
              padding: "10px 20px",
              borderRadius: 10,
            }}
          >
            🎬 YouTube
          </div>
          <div
            style={{
              backgroundColor: "#1a1a1a",
              color: "white",
              padding: "10px 20px",
              borderRadius: 10,
            }}
          >
            🎵 TikTok
          </div>
          <div
            style={{
              backgroundColor: "#1a1a1a",
              color: "white",
              padding: "10px 20px",
              borderRadius: 10,
            }}
          >
            📸 Instagram
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
