import Replicate from "replicate";
import { NextRequest, NextResponse } from "next/server";
import { LineTimestamp } from "@/types";
import fs from "fs";
import path from "path";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

export const maxDuration = 600;

interface WordStamp { word: string; start: number; end: number; }
interface FAOutput  extends WordStamp { [key: string]: number | string; }

// ── Text normalization ─────────────────────────────────────────────────────
/** Katakana → hiragana, strip spaces & punctuation */
function norm(text: string): string {
  return text
    .replace(/[\u30A1-\u30F6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s\u3000\u3001\u3002\uff0c\uff01\uff1f\u300c\u300d\u30fb\u00b7\u2019\uff08\uff09]/g, "");
}

// ── Main alignment ─────────────────────────────────────────────────────────
interface AlignDetail {
  lineIndex: number;
  text: string;
  kana: string;
  startWordIdx: number;
  endWordIdx: number;
  timestamp: LineTimestamp;
}

/**
 * Count-based alignment.
 *
 * Forced-alignment outputs one token per character of the script we sent.
 * Each lyric line consumes norm(kana).length consecutive tokens, sequentially.
 *
 * Example: あいはどこからやってくるのでしょう (17 chars) → words[0..16]
 *          next line (N chars) → words[17..17+N-1]
 */
function alignByCount(
  words: WordStamp[],
  kanaLines: string[],
  originalLines: string[],
  wordCountsPerLine: number[],   // romaji word count for each non-empty line, in order
): { timestamps: LineTimestamp[]; details: AlignDetail[] } {
  const nonEmpty = originalLines
    .map((text, lineIndex) => ({ text, lineIndex }))
    .filter(({ text }) => text.replace(/\s/g, "").length > 0);

  if (nonEmpty.length === 0 || words.length === 0) {
    return { timestamps: [], details: [] };
  }

  const timestamps: LineTimestamp[] = [];
  const details: AlignDetail[] = [];

  let wi = 0;

  for (let ni = 0; ni < nonEmpty.length; ni++) {
    const { lineIndex, text } = nonEmpty[ni];
    const count = Math.max(wordCountsPerLine[ni] ?? 1, 1);
    const query = norm(kanaLines[lineIndex] ?? originalLines[lineIndex] ?? "");

    const startWi = Math.min(wi, words.length - 1);
    const endWi   = Math.min(wi + count - 1, words.length - 1);

    const ts: LineTimestamp = {
      lineIndex,
      startTime: words[startWi].start,
      endTime:   words[endWi].end,
    };
    timestamps.push(ts);
    details.push({ lineIndex, text, kana: query, startWordIdx: startWi, endWordIdx: endWi, timestamp: ts });

    wi += count;
  }

  return { timestamps, details };
}

// ── Log writer ─────────────────────────────────────────────────────────────
function writeAlignLog(words: WordStamp[], details: AlignDetail[], rawOutput?: unknown): void {
  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(3).padStart(6, "0")}`;

  const out: string[] = [];
  out.push("═".repeat(80));
  out.push(`  ALIGNMENT LOG  ${new Date().toISOString()}`);
  out.push("═".repeat(80));
  out.push("");

  out.push("── FA words " + "─".repeat(67));
  out.push(` ${"idx".padEnd(5)} ${"start".padEnd(10)} ${"end".padEnd(10)} word`);
  out.push(" " + "─".repeat(40));
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    out.push(` ${String(i).padEnd(5)} ${fmt(w.start).padEnd(10)} ${fmt(w.end).padEnd(10)} ${w.word}`);
  }
  out.push("");

  out.push("── Line mapping " + "─".repeat(63));
  out.push(
    ` ${"#".padEnd(4)} ${"wi_s".padEnd(6)} ${"wi_e".padEnd(6)}` +
    ` ${"start".padEnd(10)} ${"end".padEnd(10)}` +
    ` ${"startWord→endWord".padEnd(20)} kana → lyric`,
  );
  out.push(" " + "─".repeat(78));

  for (const d of details) {
    const sw = words[d.startWordIdx]?.word ?? "?";
    const ew = words[d.endWordIdx]?.word ?? "?";
    out.push(
      ` ${String(d.lineIndex + 1).padEnd(4)}` +
      ` ${String(d.startWordIdx).padEnd(6)}` +
      ` ${String(d.endWordIdx).padEnd(6)}` +
      ` ${fmt(d.timestamp.startTime).padEnd(10)}` +
      ` ${fmt(d.timestamp.endTime).padEnd(10)}` +
      ` 「${sw}」→「${ew}」`.padEnd(22) +
      ` ${d.kana}  →  ${d.text}`,
    );
  }
  out.push("");

  if (rawOutput !== undefined) {
    out.push("── Raw model output " + "─".repeat(59));
    out.push(JSON.stringify(rawOutput, null, 2));
    out.push("");
  }

  const logPath = path.join(process.cwd(), "align.log");
  fs.writeFileSync(logPath, out.join("\n"), "utf8");
  console.log(`[align] log written → ${logPath}`);
}

// ── Route ──────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const lyricsRaw = formData.get("lyrics") as string | null;
    const kanaRaw   = formData.get("kana")   as string | null;

    if (!audioFile || !lyricsRaw) {
      return NextResponse.json({ error: "Missing audio or lyrics" }, { status: 400 });
    }
    const lines:  string[] = JSON.parse(lyricsRaw);
    const kana:   string[] = kanaRaw ? JSON.parse(kanaRaw) : [];
    const romajiRaw = formData.get("romaji") as string | null;
    const romaji: string[] = romajiRaw ? JSON.parse(romajiRaw) : [];

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "Invalid lyrics format" }, { status: 400 });
    }

    // Build the script: romaji words from each non-empty line, space-delimited.
    // Track how many romaji words each line contributes for count-based alignment.
    const lineWordCounts: number[] = [];
    const allWords: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].replace(/\s/g, "").length === 0) continue;
      const words = (romaji[i] ?? "").trim().split(/\s+/).filter(Boolean);
      lineWordCounts.push(words.length || 1);
      allWords.push(...words);
    }
    const script = allWords.join(" ");

    const audioBlob = new Blob([await audioFile.arrayBuffer()], {
      type: audioFile.type || "audio/mpeg",
    });

    console.log(`[align] force-align-wordstamps starting — ${lines.length} lines, script: "${script.slice(0, 120)}..."`);
    const output = (await replicate.run(
      "cureau/force-align-wordstamps:44dedb84066ba1e00761f45c1003c5c19ed3b12ae9d42c1c1883ca4c016ffa85",
      {
        input: {
          audio_file: audioBlob,
          transcript: script,
        },
      },
    )) as unknown;

    // Write raw output immediately so we can inspect the format
    const rawLogPath = path.join(process.cwd(), "align.log");
    fs.writeFileSync(rawLogPath, `RAW OUTPUT ${new Date().toISOString()}\n\n${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log("[align] raw output written to align.log");

    if (!output || (Array.isArray(output) && (output as unknown[]).length === 0)) {
      return NextResponse.json({ error: "force-align-wordstamps: no output returned" }, { status: 500 });
    }

    // Normalize output to WordStamp[]: handle both array and object-with-words formats
    let rawWords: FAOutput[] = [];
    if (Array.isArray(output)) {
      rawWords = output as FAOutput[];
    } else if (output && typeof output === "object") {
      const obj = output as Record<string, unknown>;
      const arr = obj.words ?? obj.segments ?? obj.results ?? Object.values(obj)[0];
      rawWords = Array.isArray(arr) ? arr as FAOutput[] : [];
    }

    // Filter to valid stamps only
    const faWords: WordStamp[] = rawWords
      .filter((w) => typeof w.start === "number" && typeof w.end === "number")
      .map((w) => ({ word: String(w.word ?? ""), start: Number(w.start), end: Number(w.end) }));

    console.log(`[align] ${faWords.length} / ${rawWords.length} tokens with timestamps`);

    if (faWords.length < 2) {
      return NextResponse.json({ error: "forced-alignment: insufficient word timestamps" }, { status: 500 });
    }

    const { timestamps, details } = alignByCount(faWords, kana, lines, lineWordCounts);
    console.log(`[align] mapped ${timestamps.length} / ${lines.length} lines`);

    writeAlignLog(faWords, details, output);

    return NextResponse.json({ timestamps });

  } catch (error) {
    console.error("[align] error:", error instanceof Error ? error.message : String(error));
    const logPath = path.join(process.cwd(), "align.log");
    fs.writeFileSync(logPath, `ERROR ${new Date().toISOString()}\n\n${String(error)}\n\n${error instanceof Error ? error.stack ?? "" : ""}`, "utf8");
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
