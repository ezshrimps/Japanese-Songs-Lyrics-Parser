/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from "next/server";
import { ParsedResult, Segment } from "@/types";
import { toRomaji } from "wanakana";
import path from "path";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { consumeCredit, remaining, DAILY_LIMIT, getSupabaseCredits, consumeSupabaseCredit } from "@/lib/credits";
import { auth } from "@clerk/nextjs/server";

// A typical J-pop song is 300–800 chars. 2000 gives generous headroom
// while catching abuse (multiple songs concatenated, or padding to farm tokens).
const MAX_CHARS = 2000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

// ── Kuromoji singleton ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tokenizerCache: any | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTokenizer(): Promise<any> {
  if (tokenizerCache) return Promise.resolve(tokenizerCache);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kuromoji = require("kuromoji") as any;
  return new Promise((resolve, reject) => {
    kuromoji
      .builder({ dicPath: path.join(process.cwd(), "node_modules/kuromoji/dict") })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .build((err: Error | null, tokenizer: any) => {
        if (err) return reject(err);
        tokenizerCache = tokenizer;
        resolve(tokenizer);
      });
  });
}

// ── LLM line splitter ─────────────────────────────────────────────────────
// Uses Gemini to split raw lyrics text into individual sung lines.
// Handles missing newlines, merged lines, section headers, etc.
async function splitLyricsWithLLM(raw: string): Promise<string[]> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    systemInstruction: `You are a Japanese lyrics formatter.
Split the given Japanese song lyrics into individual sung lines.
Rules:
- Each element in "lines" is exactly one sung phrase as it would appear in a lyrics booklet.
- Preserve the original Japanese characters exactly — do not translate, romanize, or modify any text.
- Remove empty lines, section markers ([Verse], [サビ], ※, etc.), and any non-lyric annotations.
- Some inputs have inline furigana appended directly after kanji (e.g. "以上いじょう", "傷つくきずつく"). Strip the furigana reading and keep only the kanji/original form (e.g. "以上", "傷つく").
- Some inputs have been pre-split into individual morphemes or very short fragments (single particles, single words). In that case, GROUP them back into natural sung phrases.
- Target length per line: 8–15 Japanese characters. Only exceed 15 characters if the phrase is genuinely one continuous, unsplittable musical phrase.
- Lines shorter than 5 Japanese characters should be merged with adjacent lines unless they truly stand alone as a complete musical phrase (e.g. a one-word title, an exclamation).
- Do not merge multiple distinct sung phrases into one line.`,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          lines: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        },
        required: ["lines"],
      },
      maxOutputTokens: 2000,
      temperature: 0,
    },
  });

  const result = await model.generateContent(raw);
  const parsed = JSON.parse(result.response.text()) as { lines: string[] };
  return (Array.isArray(parsed.lines) ? parsed.lines : [])
    .map((l) => l.trim())
    .filter(Boolean);
}

// ── Helpers ───────────────────────────────────────────────────────────────
const KATAKANA_RE = /[\u30A1-\u30F6]/g;
function kata2hira(text: string): string {
  return text.replace(KATAKANA_RE, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

function containsKanji(text: string): boolean {
  return /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/.test(text);
}

const STRIP_RE = /[\s\u3000\u3001\u3002\uff0c\uff01\uff1f\u300c\u300d\u30fb\u00b7\u2019\uff08\uff09]/g;

// ── Tokenize a single line → ParsedResult ────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tokenizeLine(tokenizer: any, text: string): ParsedResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokens: any[] = tokenizer.tokenize(text);

  const segments: Segment[] = tokens.map((t) => {
    const hasReading = t.reading !== undefined;
    const reading: string = t.reading ?? t.surface_form;
    const hira = kata2hira(reading);
    const hiragana = containsKanji(t.surface_form) && hasReading ? hira : null;
    const romaji = !hasReading && containsKanji(t.surface_form) ? "" : toRomaji(hira);
    return { text: t.surface_form, hiragana, romaji };
  });

  const fullRomaji = segments.map((s) => s.romaji).filter(Boolean).join(" ").trim();

  const kana = segments
    .map((s) => s.hiragana ?? s.text)
    .join("")
    .replace(KATAKANA_RE, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(STRIP_RE, "");

  return {
    originalText: text,
    kana,
    segments,
    fullRomaji,
    chineseTranslation: "",
    grammarBreakdown: [],
  };
}

// ── Route ──────────────────────────────────────────────────────────────────
function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const ip = getIp(request);
  const { userId } = await auth();

  try {
    const body = await request.json();
    const { lyrics, lines: preLines } = body as { lyrics?: string; lines?: string[] };

    // ── Path A: pre-split lines from LRC search (free — no Gemini call) ──
    if (Array.isArray(preLines) && preLines.length > 0) {
      const allLines = preLines.map((l) => l.trim()).filter(Boolean);
      const tokenizer = await getTokenizer();
      const uniqueLines: string[] = [];
      const lineToIdx = new Map<string, number>();
      const expandMap: number[] = [];
      for (const line of allLines) {
        if (!lineToIdx.has(line)) { lineToIdx.set(line, uniqueLines.length); uniqueLines.push(line); }
        expandMap.push(lineToIdx.get(line)!);
      }
      const parsed  = uniqueLines.map((l) => tokenizeLine(tokenizer, l));
      const expanded = expandMap.map((i) => parsed[i]);
      const creditsLeft = userId ? await getSupabaseCredits(userId) : remaining(ip);
      return NextResponse.json(expanded, {
        headers: { "X-Credits-Remaining": String(creditsLeft), "X-Credits-Limit": String(DAILY_LIMIT) },
      });
    }

    // ── Path B: raw lyrics input — requires Gemini split (costs 1 credit) ─
    if (userId) {
      const balance = await getSupabaseCredits(userId);
      if (balance <= 0) {
        return NextResponse.json(
          { error: "积分不足，请兑换激活码充值 ✦" },
          { status: 429, headers: { "X-Credits-Remaining": "0" } }
        );
      }
    } else if (remaining(ip) <= 0) {
      return NextResponse.json(
        { error: "今日免费额度已用完，注册登录可获得更多积分 ✦" },
        { status: 429, headers: { "X-Credits-Remaining": "0", "X-Credits-Limit": String(DAILY_LIMIT) } }
      );
    }

    if (!lyrics || typeof lyrics !== "string") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    if (lyrics.length > MAX_CHARS) {
      return NextResponse.json(
        { error: `歌词过长（${lyrics.length} 字符），单首歌曲通常不超过 ${MAX_CHARS} 字符。请检查是否粘贴了多首歌词或多余内容。` },
        { status: 400 }
      );
    }

    const allLines = await splitLyricsWithLLM(lyrics);

    if (allLines.length === 0) {
      return NextResponse.json({ error: "未能识别到有效歌词，请检查输入内容" }, { status: 400 });
    }

    let left: number;
    if (userId) {
      try {
        left = await consumeSupabaseCredit(userId);
      } catch {
        return NextResponse.json({ error: "积分扣除失败，请重试" }, { status: 500 });
      }
    } else {
      left = consumeCredit(ip);
    }

    // Deduplicate
    const uniqueLines: string[] = [];
    const lineToIdx = new Map<string, number>();
    const expandMap: number[] = [];

    for (const line of allLines) {
      if (!lineToIdx.has(line)) {
        lineToIdx.set(line, uniqueLines.length);
        uniqueLines.push(line);
      }
      expandMap.push(lineToIdx.get(line)!);
    }

    console.log(`[parse] ${allLines.length} lines → ${uniqueLines.length} unique`);

    const tokenizer = await getTokenizer();
    const parsed = uniqueLines.map((line) => tokenizeLine(tokenizer, line));
    const expanded = expandMap.map((i) => parsed[i]);

    return NextResponse.json(expanded, {
      headers: {
        "X-Credits-Remaining": String(left),
        "X-Credits-Limit": String(DAILY_LIMIT),
      },
    });
  } catch (error) {
    console.error("Parse error:", error);
    const msg = error instanceof Error ? error.message : "解析失败，请重试";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
