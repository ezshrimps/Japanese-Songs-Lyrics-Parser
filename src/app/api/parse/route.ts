/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest, NextResponse } from "next/server";
import { ParsedResult, Segment } from "@/types";
import { toRomaji } from "wanakana";
import path from "path";

const MAX_CHARS = 20000;

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

// ── Lyric line pre-splitter ───────────────────────────────────────────────
// Some input has two phrases merged on one line with a single space, e.g.:
//   "夜に駆ける 空の向こうへ"  →  ["夜に駆ける", "空の向こうへ"]
// Rule: split at a space only when BOTH resulting parts contain ≥ 4 Japanese
// characters (kanji + kana). Short lines or lines where a part would be too
// small are kept intact.
const JP_RE = /[\u3000-\u9FFF\uF900-\uFAFF\u30A0-\u30FF\u3040-\u309F]/g;
function countJP(s: string): number {
  return (s.match(JP_RE) ?? []).length;
}

function trySplit(line: string): string[] {
  const MIN_JP_PER_PART = 4;
  const spaces: number[] = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "\u3000" || line[i] === " ") spaces.push(i);
  }
  if (spaces.length === 0) return [line];

  const mid = line.length / 2;
  const sorted = [...spaces].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));

  for (const sp of sorted) {
    const left  = line.slice(0, sp).trim();
    const right = line.slice(sp + 1).trim();
    if (countJP(left) >= MIN_JP_PER_PART && countJP(right) >= MIN_JP_PER_PART) {
      // Recurse: each part might also need splitting
      return [...trySplit(left), ...trySplit(right)];
    }
  }
  return [line];
}

function splitMergedLines(raw: string): string {
  const out: string[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed) out.push(...trySplit(trimmed));
  }
  return out.join("\n");
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

// ── Sentence boundary splitter (kuromoji-based) ───────────────────────────
// Detects natural sentence breaks in a long line with no newlines/spaces.
// Uses POS tags: sentence-final particles (終助詞) and verb dictionary forms
// followed by a new clause opener (noun, topic/subject particle, interjection).
const MIN_SEG_JP = 6; // minimum JP chars per split segment

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function splitBySentenceBoundary(tokenizer: any, line: string): string[] {
  // Split on punctuation first (。！？)
  const byPunct = line.split(/(?<=[。！？])/).map((s) => s.trim()).filter(Boolean);
  if (byPunct.length > 1) return byPunct;

  // Not long enough to bother splitting
  if (countJP(line) < MIN_SEG_JP * 2) return [line];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokens: any[] = tokenizer.tokenize(line);
  const boundaries: number[] = [];
  let charPos = 0;

  for (let i = 0; i < tokens.length - 1; i++) {
    const t    = tokens[i];
    const next = tokens[i + 1];
    charPos += t.surface_form.length;

    const isFinalParticle =
      t.pos === "助詞" && t.pos_detail_1 === "終助詞";
    const isFinalVerb =
      (t.pos === "動詞" || t.pos === "助動詞") &&
      (t.conjugated_form === "基本形" || t.conjugated_form === "命令ｙｏ");

    if (!isFinalParticle && !isFinalVerb) continue;

    // Next token should start a new clause: noun, interjection, or topic/subject particle
    const nextStartsClause =
      next.pos === "名詞" ||
      next.pos === "感動詞" ||
      (next.pos === "助詞" && (next.pos_detail_1 === "係助詞" || next.pos_detail_1 === "格助詞"));

    if (nextStartsClause) boundaries.push(charPos);
  }

  if (boundaries.length === 0) return [line];

  const segments: string[] = [];
  let prev = 0;
  for (const pos of boundaries) {
    const seg = line.slice(prev, pos).trim();
    if (countJP(seg) >= MIN_SEG_JP) { segments.push(seg); prev = pos; }
  }
  const last = line.slice(prev).trim();
  if (last) segments.push(last);

  return segments.length > 1 ? segments : [line];
}

// ── Tokenize a single line → ParsedResult (no translation yet) ────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tokenizeLine(tokenizer: any, text: string): ParsedResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokens: any[] = tokenizer.tokenize(text);

  const segments: Segment[] = tokens.map((t) => {
    const hasReading = t.reading !== undefined;
    const reading: string = t.reading ?? t.surface_form;
    const hira = kata2hira(reading);
    // Only attach furigana when kuromoji has a reading AND the surface has kanji
    const hiragana = containsKanji(t.surface_form) && hasReading ? hira : null;
    // Skip romaji for kanji tokens kuromoji couldn't read (avoids raw kanji in romaji line)
    const romaji = !hasReading && containsKanji(t.surface_form) ? "" : toRomaji(hira);
    return {
      text: t.surface_form,
      hiragana,
      romaji,
    };
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
    chineseTranslation: "",   // filled after DeepL call
    grammarBreakdown: [],     // loaded on demand via /api/grammar
  };
}


// ── Route ──────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { lyrics } = await request.json();

    if (!lyrics || typeof lyrics !== "string" || lyrics.length > MAX_CHARS) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const allLines = splitMergedLines(lyrics).split("\n").filter(Boolean);

    // Tokenize first so we can use kuromoji for sentence boundary detection
    const tokenizer = await getTokenizer();

    // Re-split any merged lines that have no spaces/punctuation using POS analysis
    const refinedLines: string[] = [];
    for (const line of allLines) {
      refinedLines.push(...splitBySentenceBoundary(tokenizer, line));
    }

    // Deduplicate
    const uniqueLines: string[] = [];
    const lineToIdx = new Map<string, number>();
    const expandMap: number[] = [];

    for (const line of refinedLines) {
      if (!lineToIdx.has(line)) {
        lineToIdx.set(line, uniqueLines.length);
        uniqueLines.push(line);
      }
      expandMap.push(lineToIdx.get(line)!);
    }

    console.log(`[parse] ${refinedLines.length} lines → ${uniqueLines.length} unique`);
    const parsed = uniqueLines.map((line) => tokenizeLine(tokenizer, line));

    // Expand back to original order
    const expanded = expandMap.map((i) => parsed[i]);

    return NextResponse.json(expanded);
  } catch (error) {
    console.error("Parse error:", error);
    const msg = error instanceof Error ? error.message : "解析失败，请重试";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
