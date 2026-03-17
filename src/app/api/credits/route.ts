import { NextRequest, NextResponse } from "next/server";
import { remaining, resetIp, DAILY_LIMIT } from "@/lib/credits";

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function GET(request: NextRequest) {
  const ip = getIp(request);
  return NextResponse.json({ remaining: remaining(ip), limit: DAILY_LIMIT });
}

// Dev-only: DELETE /api/credits resets credit counter for caller's IP
export async function DELETE(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }
  const ip = getIp(request);
  resetIp(ip);
  return NextResponse.json({ ok: true, remaining: DAILY_LIMIT });
}
