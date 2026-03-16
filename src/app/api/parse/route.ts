import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { ParsedResult } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BATCH_SIZE = 25; // lines per Claude request
const MAX_CHARS  = 15000;

const SYSTEM_PROMPT = `You are a Japanese language expert specializing in song lyric analysis for Chinese-speaking learners.

The user will provide Japanese song lyrics (one or more lines). Analyze EVERY non-empty line and return one entry per line in the "lines" array using the analyze_lyrics tool.

Segment rules:
- For kanji or kanji+kana segments: set hiragana to their reading
- For pure hiragana or katakana segments: set hiragana to null
- Split at natural word/morpheme boundaries

Grammar breakdown rules:
- Group each line into meaningful grammatical/morphological units
- For conjugated verbs, explain the conjugation pattern in detail
- All explanations must be in Chinese and be educational
- IMPORTANT: partOfSpeech must be in Simplified Chinese (简体中文), e.g. 名词、动词、助词、形容词、副词、代词、助动词、接续词 — never use Traditional Chinese characters
- IMPORTANT: In explanation text, use 「」brackets for word meanings — never use ASCII double-quote characters`;

const TOOL: Anthropic.Tool = {
  name: "analyze_lyrics",
  description:
    "Analyze all lines of Japanese lyrics and return structured data for each line",
  input_schema: {
    type: "object" as const,
    properties: {
      lines: {
        type: "array",
        description: "One analysis object per non-empty lyric line, in order",
        items: {
          type: "object",
          properties: {
            originalText: { type: "string", description: "The original Japanese text of this line" },
            segments: {
              type: "array",
              description: "Segments for ruby annotation",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  hiragana: {
                    type: ["string", "null"],
                    description: "Reading for kanji, null for pure kana",
                  },
                  romaji: { type: "string" },
                },
                required: ["text", "hiragana", "romaji"],
              },
            },
            fullRomaji: { type: "string", description: "Full line in romaji" },
            chineseTranslation: { type: "string", description: "Chinese translation" },
            grammarBreakdown: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  hiragana: { type: "string" },
                  romaji: { type: "string" },
                  partOfSpeech: { type: "string" },
                  explanation: {
                    type: "string",
                    description: "Chinese explanation. Use 「」for word meanings, not ASCII quotes.",
                  },
                },
                required: ["text", "hiragana", "romaji", "partOfSpeech", "explanation"],
              },
            },
          },
          required: [
            "originalText",
            "segments",
            "fullRomaji",
            "chineseTranslation",
            "grammarBreakdown",
          ],
        },
      },
    },
    required: ["lines"],
  },
};

function normalizeLineData(line: Record<string, unknown>): ParsedResult {
  for (const key of ["segments", "grammarBreakdown"] as const) {
    if (typeof line[key] === "string") {
      try { line[key] = JSON.parse(line[key] as string); }
      catch { line[key] = []; }
    }
  }
  return line as unknown as ParsedResult;
}

function attachKana(result: ParsedResult): ParsedResult {
  result.kana = (result.segments ?? [])
    .map((s) => s.hiragana ?? s.text)
    .join("")
    .replace(/[\u30A1-\u30F6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s\u3000\u3001\u3002\uff0c\uff01\uff1f\u300c\u300d\u30fb\u00b7\u2019\uff08\uff09]/g, "");
  return result;
}

const LEVEL_PROMPT: Record<string, string> = {
  "初级": "",
  "中级": `
Grammar level: INTERMEDIATE. Skip overly basic items — do NOT include entries for:
- Common single particles used in standard roles: は (topic), が (subject), を (object), に (location/direction), で (means/location), も (also), の (possessive)
- Simple pronouns and interrogatives: これ/それ/あれ/どれ, こ/そ/あ/ど series, ここ/そこ/あそこ/どこ
- Basic copula: です、だ、である
- Simple conjunctions: そして、でも、だから (when used standalone without special nuance)
Focus instead on: verb conjugations and their nuance, grammar patterns, compound expressions, sentence-final forms, and any particle used with non-obvious meaning.`,
  "高级": `
Grammar level: ADVANCED. Only include grammar items that are N3 level or above. Skip ALL of the following:
- All basic particles in standard usage (は、が、を、に、で、も、の、と、や、か、ね、よ)
- All basic pronouns, demonstratives, interrogatives
- て-form, ない-form, dictionary form, ます-form when used in straightforward conjugation
- です/だ copula, simple い/な adjective conjugation
- Common adverbs: とても、もっと、まだ、もう、ちょっと
Only explain: advanced grammar patterns (passive, causative, conditionals ば/たら/と/なら, potential form nuances, te-form compounds with non-obvious meaning, formal/literary expressions, honorific/humble forms, complex compound particles like にとって/において/に関して, sentence-ending patterns expressing nuance).`,
};

async function parseBatch(batchLines: string[], level = "初级"): Promise<ParsedResult[]> {
  const levelNote = LEVEL_PROMPT[level] ?? "";
  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 32000,
    system: SYSTEM_PROMPT + levelNote,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "analyze_lyrics" },
    messages: [{ role: "user", content: batchLines.join("\n") }],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === "max_tokens") {
    throw new Error("歌词批次过长，响应被截断。");
  }

  const toolUse = message.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("No tool_use block in response");
  }

  const { lines: rawLines } = toolUse.input as { lines: unknown };
  let lines: Record<string, unknown>[];
  if (Array.isArray(rawLines)) {
    lines = rawLines;
  } else if (typeof rawLines === "string") {
    try { lines = JSON.parse(rawLines); } catch { lines = []; }
  } else {
    lines = [];
  }
  return lines.map((line) => attachKana(normalizeLineData(line)));
}

export async function POST(request: NextRequest) {
  try {
    const { lyrics, level = "初级" } = await request.json();

    if (!lyrics || typeof lyrics !== "string" || lyrics.length > MAX_CHARS) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    // Filter blank lines
    const allLines = lyrics.split("\n").map((l) => l.trim()).filter(Boolean);

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

    // Split into batches and parse in parallel
    const batches: string[][] = [];
    for (let i = 0; i < uniqueLines.length; i += BATCH_SIZE) {
      batches.push(uniqueLines.slice(i, i + BATCH_SIZE));
    }

    console.log(`[parse] ${uniqueLines.length} unique lines → ${batches.length} batch(es)`);

    const batchResults = await Promise.all(batches.map((b) => parseBatch(b, level)));
    const normalized = batchResults.flat();

    // Expand back to original order
    const expanded = expandMap.map((i) => normalized[i]);

    return NextResponse.json(expanded);
  } catch (error) {
    console.error("Parse error:", error);
    const msg = error instanceof Error ? error.message : "Failed to parse lyrics. Please try again.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
