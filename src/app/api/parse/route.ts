import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { ParsedResult } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
  // Defensive: Claude occasionally serializes array fields as JSON strings
  for (const key of ["segments", "grammarBreakdown"] as const) {
    if (typeof line[key] === "string") {
      try {
        line[key] = JSON.parse(line[key] as string);
      } catch {
        line[key] = [];
      }
    }
  }
  return line as unknown as ParsedResult;
}

export async function POST(request: NextRequest) {
  try {
    const { lyrics } = await request.json();

    if (!lyrics || typeof lyrics !== "string" || lyrics.length > 5000) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    // Filter out blank lines
    const allLines = lyrics
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    // Deduplicate: track first-occurrence index for each unique line
    const uniqueLines: string[] = [];
    const lineToIdx = new Map<string, number>();
    const expandMap: number[] = []; // allLines[i] → index in uniqueLines

    for (const line of allLines) {
      if (!lineToIdx.has(line)) {
        lineToIdx.set(line, uniqueLines.length);
        uniqueLines.push(line);
      }
      expandMap.push(lineToIdx.get(line)!);
    }

    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 32000,
      system: SYSTEM_PROMPT,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "analyze_lyrics" },
      messages: [{ role: "user", content: uniqueLines.join("\n") }],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === "max_tokens") {
      throw new Error("歌词过长，响应被截断。请减少行数后重试。");
    }

    const toolUse = message.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("No tool_use block in response");
    }

    const { lines } = toolUse.input as { lines: Record<string, unknown>[] };
    const normalized = (lines ?? []).map((line) => {
      const result = normalizeLineData(line);
      // Compute and store normalized hiragana at parse time so align can use it
      result.kana = (result.segments ?? [])
        .map((s) => s.hiragana ?? s.text)
        .join("")
        .replace(/[\u30A1-\u30F6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
        .replace(/[\s\u3000\u3001\u3002\uff0c\uff01\uff1f\u300c\u300d\u30fb\u00b7\u2019\uff08\uff09]/g, "");
      return result;
    });

    // Expand back to original order, copying results for duplicate lines
    const expanded = expandMap.map((i) => normalized[i]);

    return NextResponse.json(expanded);
  } catch (error) {
    console.error("Parse error:", error);
    const msg = error instanceof Error ? error.message : "Failed to parse lyrics. Please try again.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
