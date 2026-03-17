import Replicate from "replicate";
import { NextRequest, NextResponse } from "next/server";
import { LineTimestamp } from "@/types";
import fs from "fs";
import path from "path";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

export const maxDuration = 300;

interface WordStamp { word: string; start: number; end: number; score?: number; }
interface Segment   { start: number; end: number; text: string; words?: WordStamp[]; }
interface WhisperXOutput { segments: Segment[]; detected_language: string; }

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
 * WhisperX with align_output=true produces character-level stamps for Japanese
 * (one word ≈ one kana character). Each lyric line simply consumes
 * norm(kana).length consecutive words from the word list, sequentially.
 *
 * Example: あいはどこからやってくるのでしょう (17 chars) → words[0..16]
 *          next line (N chars) → words[17..17+N-1]
 */
function alignByCount(
  words: WordStamp[],
  kanaLines: string[],
  originalLines: string[],
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

  for (const { lineIndex, text } of nonEmpty) {
    const query = norm(kanaLines[lineIndex] ?? originalLines[lineIndex] ?? "");
    const count = Math.max(query.length, 1);

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
function writeAlignLog(words: WordStamp[], details: AlignDetail[]): void {
  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(3).padStart(6, "0")}`;

  const out: string[] = [];
  out.push("═".repeat(80));
  out.push(`  ALIGNMENT LOG  ${new Date().toISOString()}`);
  out.push("═".repeat(80));
  out.push("");

  // Section 1: all WhisperX words
  out.push("── WhisperX words " + "─".repeat(61));
  out.push(` ${"idx".padEnd(5)} ${"start".padEnd(10)} ${"end".padEnd(10)} word`);
  out.push(" " + "─".repeat(40));
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    out.push(` ${String(i).padEnd(5)} ${fmt(w.start).padEnd(10)} ${fmt(w.end).padEnd(10)} ${w.word}`);
  }
  out.push("");

  // Section 2: per-line mapping
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
    const lines: string[] = JSON.parse(lyricsRaw);
    const kana:  string[] = kanaRaw ? JSON.parse(kanaRaw) : [];

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "Invalid lyrics format" }, { status: 400 });
    }

    const audioBlob = new Blob([await audioFile.arrayBuffer()], {
      type: audioFile.type || "audio/mpeg",
    });

    console.log(`[align] whisperx starting — ${lines.length} lines`);
    const output = (await replicate.run(
      "victor-upmeet/whisperx:84d2ad2d6194fe98a17d2b60bef1c7f910c46b2f6fd38996ca457afd9c8abfcb",
      {
        input: {
          audio_file: audioBlob,
          language: "ja",
          align_output: true,
          batch_size: 16,
          initial_prompt: kana.filter((_, i) => lines[i]?.trim()).map((k) => norm(k)).join("　"),
        },
      },
    )) as WhisperXOutput;

    if (!output?.segments?.length) {
      return NextResponse.json({ error: "whisperx: no segments returned" }, { status: 500 });
    }

    const allWords: WordStamp[] = output.segments
      .flatMap((s) => s.words ?? [])
      .filter((w) => typeof w.start === "number" && typeof w.end === "number");

    console.log(`[align] ${output.segments.length} segments, ${allWords.length} words`);

    if (allWords.length < 2) {
      return NextResponse.json({ error: "whisperx: no word-level timestamps returned" }, { status: 500 });
    }

    console.log(`[align] count-aligning ${allWords.length} words → ${lines.length} lines`);
    const { timestamps, details } = alignByCount(allWords, kana, lines);
    console.log(`[align] mapped ${timestamps.length} / ${lines.length} lines`);

    writeAlignLog(allWords, details);

    return NextResponse.json({ timestamps });

  } catch (error) {
    console.error("[align] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Alignment failed" },
      { status: 500 },
    );
  }
}
