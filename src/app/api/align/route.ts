import { NextRequest, NextResponse } from "next/server";
import { LineTimestamp } from "@/types";

const ALIGN_SERVER = process.env.ALIGN_SERVER_URL ?? "http://192.168.1.117:8000";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Forward the multipart form directly to the PC server
    const res = await fetch(`${ALIGN_SERVER}/align`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(600_000), // 10 min max
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      return NextResponse.json(
        { error: data.error ?? "Alignment server error" },
        { status: res.status }
      );
    }

    return NextResponse.json({ timestamps: data.timestamps as LineTimestamp[] });

  } catch (error) {
    console.error("Align proxy error:", error);
    const msg = error instanceof Error ? error.message : "Failed to reach alignment server";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
