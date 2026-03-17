import { NextRequest, NextResponse } from "next/server";

const BASE = "https://lrclib.net/api";

// GET /api/lrclib?q=query         → search
// GET /api/lrclib?id=123          → get by ID
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q  = searchParams.get("q");
  const id = searchParams.get("id");

  let url: string;
  if (id) {
    url = `${BASE}/get/${id}`;
  } else if (q) {
    url = `${BASE}/search?q=${encodeURIComponent(q)}`;
  } else {
    return NextResponse.json({ error: "Missing q or id param" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { "Lrclib-Client": "ShrimpLyricsParser/1.0 (https://github.com/ezshrimps)" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "LRCLIB error" }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to reach LRCLIB" }, { status: 502 });
  }
}
