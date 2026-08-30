import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 40,
        }}
      >
        <svg width="76" height="88" viewBox="0 0 76 88" fill="none">
          <polygon points="0,0 76,44 0,88" fill="#fafafa" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
