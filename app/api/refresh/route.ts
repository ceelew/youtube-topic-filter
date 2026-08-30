import { NextRequest, NextResponse } from "next/server";
import { refreshAllSourcesAndLog } from "@/lib/refresh";
import { env } from "@/lib/env";

// Vercel Cron invokes this with GET and sends `Authorization: Bearer ${CRON_SECRET}`
// automatically when the CRON_SECRET env var is set on the project. That header check is
// what stops anyone else from hitting this public endpoint and burning YouTube API quota —
// the admin "Refresh now" button does NOT go through this route; it calls
// refreshAllSourcesAndLog() directly from an authenticated Server Action instead
// (see app/admin/actions.ts). POST is also supported for manual/local triggering.
async function handleRefresh(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await refreshAllSourcesAndLog();
  return NextResponse.json({ results });
}

export const GET = handleRefresh;
export const POST = handleRefresh;
