import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#18181b",
        }}
      >
        <svg width="72" height="84" viewBox="0 0 72 84" fill="none">
          <polygon points="0,0 72,42 0,84" fill="#fafafa" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
