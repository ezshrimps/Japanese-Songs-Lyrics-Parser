import { NextRequest, NextResponse } from "next/server";
import { remaining, DAILY_LIMIT } from "@/lib/credits";

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

