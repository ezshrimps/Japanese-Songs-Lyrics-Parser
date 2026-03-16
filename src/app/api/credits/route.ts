import { NextRequest, NextResponse } from "next/server";

export const DAILY_LIMIT = 20;

declare global {
  // eslint-disable-next-line no-var
  var grammarUsage: Map<string, { date: string; count: number }> | undefined;
}
if (!global.grammarUsage) global.grammarUsage = new Map();

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function getUsage(ip: string): { date: string; count: number } {
  const store = global.grammarUsage!;
  const entry = store.get(ip);
  if (!entry || entry.date !== today()) {
    const fresh = { date: today(), count: 0 };
    store.set(ip, fresh);
    return fresh;
  }
  return entry;
}

export function consumeCredit(ip: string): number {
  const entry = getUsage(ip);
  entry.count += 1;
  global.grammarUsage!.set(ip, entry);
  return Math.max(0, DAILY_LIMIT - entry.count);
}

export function remaining(ip: string): number {
  return Math.max(0, DAILY_LIMIT - getUsage(ip).count);
}

export async function GET(request: NextRequest) {
  const ip = getIp(request);
  return NextResponse.json({ remaining: remaining(ip), limit: DAILY_LIMIT });
}
