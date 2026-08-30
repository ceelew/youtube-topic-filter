import { ImageResponse } from "next/og";

// Dedicated route for the manifest's large (512x512) icon — Next's `icon.tsx`
// convention only allows one generated icon per route segment, so the smaller
// favicon-sized icon lives at app/icon.tsx and this covers the larger PWA size.
export const dynamic = "force-static";

export async function GET() {
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
          borderRadius: 108,
        }}
      >
        <svg width="202" height="234" viewBox="0 0 202 234" fill="none">
          <polygon points="0,0 202,117 0,234" fill="#fafafa" />
        </svg>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
