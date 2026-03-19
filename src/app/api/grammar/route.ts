import { GoogleGenerativeAI, SchemaType, ObjectSchema } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { GrammarUnit } from "@/types";
import { consumeCredit, remaining, DAILY_LIMIT, getSupabaseCredits, consumeSupabaseCredit } from "@/lib/credits";
import { auth } from "@clerk/nextjs/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

const RESPONSE_SCHEMA: ObjectSchema = {
  type: SchemaType.OBJECT,
  properties: {
    translation: { type: SchemaType.STRING },
    units: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          text:         { type: SchemaType.STRING },
          hiragana:     { type: SchemaType.STRING },
          romaji:       { type: SchemaType.STRING },
          partOfSpeech: { type: SchemaType.STRING },
          baseForm:     { type: SchemaType.STRING },
          explanation:  { type: SchemaType.STRING },
        },
        required: ["text", "hiragana", "romaji", "partOfSpeech", "explanation"],
      },
    },
  },
  required: ["translation", "units"],
};

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  const ip = getIp(request);

  try {
    const { line, lineIndex, totalLines } = await request.json() as {
      line: string;
      lineIndex?: number;
      totalLines?: number;
    };

    if (!line || typeof line !== "string") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    // ── 30% free rule ──────────────────────────────────────────────────────
    const freeThreshold = totalLines ? Math.ceil(totalLines * 0.3) : 0;
    const isFree = typeof lineIndex === "number" && lineIndex < freeThreshold;

    // ── Credit check ───────────────────────────────────────────────────────
    if (!isFree) {
      if (userId) {
        const balance = await getSupabaseCredits(userId);
        if (balance <= 0) {
          return NextResponse.json(
            { error: "积分不足，请兑换激活码充值 ✦" },
            { status: 429, headers: { "X-Credits-Remaining": "0" } }
          );
        }
      } else {
        if (remaining(ip) <= 0) {
          return NextResponse.json(
            { error: "今日免费额度已用完，注册登录可获得更多积分 ✦" },
            { status: 429, headers: { "X-Credits-Remaining": "0", "X-Credits-Limit": String(DAILY_LIMIT) } }
          );
        }
      }
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      systemInstruction: `You are a Japanese language expert. IMPORTANT: All output text must be in Simplified Chinese (简体中文) only — never use English, Spanish, or any other language.

For the given Japanese song lyric line:
1. Provide a natural Simplified Chinese translation in the "translation" field. The translation MUST be in Chinese characters (汉字).
2. Break it into grammatical/morphological units in "units". For conjugated verbs, explain the conjugation. For verbs, adjectives, and auxiliary verbs, provide the dictionary form (原型) in "baseForm"; leave "baseForm" empty for particles, pronouns, and other non-inflectable words.
All "explanation" and "translation" values must be written in Simplified Chinese (简体中文). Use 「」for quoting word meanings.
partOfSpeech must be one of: 名词/动词/助词/形容词/副词/助动词/接续词/感叹词`,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        maxOutputTokens: 2000,
        temperature: 0.1,
      },
    });

    const result = await model.generateContent(line);
    const text = result.response.text();
    const parsed = JSON.parse(text) as { units: GrammarUnit[]; translation: string };

    const units = Array.isArray(parsed.units) ? parsed.units : [];

    if (units.length === 0) {
      console.warn("Grammar API: Gemini returned empty units for line:", line);
      return NextResponse.json(
        { error: "解析返回空，不扣积分，请重试", retryFree: true },
        { status: 503 }
      );
    }

    // ── Consume credit (only for non-free lines) ───────────────────────────
    let creditsLeft: number | null = null;

    if (!isFree) {
      if (userId) {
        try {
          creditsLeft = await consumeSupabaseCredit(userId);
        } catch {
          return NextResponse.json({ error: "积分扣除失败，请重试" }, { status: 500 });
        }
      } else {
        creditsLeft = consumeCredit(ip);
      }
    } else {
      // Free line — report current balance without consuming
      if (userId) {
        creditsLeft = await getSupabaseCredits(userId);
      } else {
        creditsLeft = remaining(ip);
      }
    }

    const headers: Record<string, string> = {};
    if (creditsLeft !== null) {
      headers["X-Credits-Remaining"] = String(creditsLeft);
      if (!userId) headers["X-Credits-Limit"] = String(DAILY_LIMIT);
    }

    return NextResponse.json(
      { units, translation: parsed.translation ?? "" },
      { headers }
    );
  } catch (error) {
    console.error("Grammar error:", error);
    return NextResponse.json({ error: "语法解析失败" }, { status: 500 });
  }
}
