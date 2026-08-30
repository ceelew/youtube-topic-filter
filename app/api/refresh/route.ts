import { NextResponse } from "next/server";
import { refreshAllSources } from "@/lib/refresh";

export async function POST() {
  const results = await refreshAllSources();
  return NextResponse.json({ results });
}
