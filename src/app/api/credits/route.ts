import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { remaining, DAILY_LIMIT, getSupabaseCredits } from "@/lib/credits";

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (userId) {
    const balance = await getSupabaseCredits(userId);
    return NextResponse.json({ remaining: balance, limit: null, authenticated: true });
  }

  const ip = getIp(request);
  return NextResponse.json({ remaining: remaining(ip), limit: DAILY_LIMIT, authenticated: false });
}
