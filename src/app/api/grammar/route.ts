import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { GrammarUnit } from "@/types";
import { consumeCredit, remaining, DAILY_LIMIT } from "@/app/api/credits/route";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const LEVEL_FILTER: Record<string, string> = {
  "初级": "",
  "中级": `
Skip entries for: common single particles (は/が/を/に/で/も/の), basic pronouns/demonstratives (こそあど series), simple copula (です/だ), standalone simple conjunctions.
Focus on: verb conjugations, grammar patterns, compound expressions, non-obvious particle usage.`,
  "高级": `
Only include N3+ grammar. Skip ALL basic particles, pronouns, demonstratives, て/ない/ます/dictionary forms in straightforward usage, です/だ, common adverbs (とても/もっと/まだ/もう).
Only explain: passive/causative, conditionals (ば/たら/と/なら), formal/literary expressions, honorific/humble, complex compound particles (にとって/において/に関して).`,
};

const TOOL: Anthropic.Tool = {
  name: "grammar_breakdown",
  description: "Return grammar breakdown for a single Japanese lyric line",
  input_schema: {
    type: "object" as const,
    properties: {
      units: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text:         { type: "string" },
            hiragana:     { type: "string" },
            romaji:       { type: "string" },
            partOfSpeech: { type: "string", description: "词性，必须用简体中文：名词/动词/助词/形容词/副词/助动词/接续词/感叹词" },
            explanation:  { type: "string", description: "中文解释，使用「」而非ASCII引号" },
          },
          required: ["text", "hiragana", "romaji", "partOfSpeech", "explanation"],
        },
      },
    },
    required: ["units"],
  },
};

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  const ip = getIp(request);

  // Check credits before doing anything
  if (remaining(ip) <= 0) {
    return NextResponse.json(
      { error: "今日免费额度已用完，明天再来吧 ✦" },
      { status: 429, headers: { "X-Credits-Remaining": "0", "X-Credits-Limit": String(DAILY_LIMIT) } }
    );
  }

  try {
    const { line, level = "初级" } = await request.json();

    if (!line || typeof line !== "string") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const levelNote = LEVEL_FILTER[level] ?? "";

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: `You are a Japanese language expert. Analyze the grammar of the given Japanese song lyric line for Chinese-speaking learners.
Break it into meaningful grammatical/morphological units. For conjugated verbs, explain the conjugation in detail.
All explanations must be in Simplified Chinese (简体中文). Use 「」for word meanings, never ASCII quotes.${levelNote}`,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "grammar_breakdown" },
      messages: [{ role: "user", content: line }],
    });

    const toolUse = message.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ units: [] });
    }

    const { units } = toolUse.input as { units: GrammarUnit[] };

    // Deduct credit after successful generation
    const left = consumeCredit(ip);

    return NextResponse.json(
      { units: Array.isArray(units) ? units : [] },
      { headers: { "X-Credits-Remaining": String(left), "X-Credits-Limit": String(DAILY_LIMIT) } }
    );
  } catch (error) {
    console.error("Grammar error:", error);
    return NextResponse.json({ error: "语法解析失败" }, { status: 500 });
  }
}
