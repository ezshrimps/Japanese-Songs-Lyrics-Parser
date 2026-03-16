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
    const lines: string[] = JSON.parse(lyricsRaw);
    const kana:  string[] = kanaRaw ? JSON.parse(kanaRaw) : [];

    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "Invalid lyrics format" }, { status: 400 });
    }

    // Build the script: normalized kana for each non-empty line, joined by spaces.
    // Forced-alignment aligns this script character-by-character to the audio.
    const nonEmptyKana = lines
      .map((line, i) => ({ line, kanaLine: kana[i] ?? line, i }))
      .filter(({ line }) => line.replace(/\s/g, "").length > 0)
      .map(({ kanaLine }) => norm(kanaLine));
    const script = nonEmptyKana.join(" ");

    const audioBlob = new Blob([await audioFile.arrayBuffer()], {
      type: audioFile.type || "audio/mpeg",
    });

    console.log(`[align] forced-alignment starting — ${lines.length} lines, script length ${script.length}`);
    const output = (await replicate.run(
      "quinten-kamphuis/forced-alignment:566a5a9530375ba0428344b66027520e83f832527bc04c5c4770cea1d3e6fcc7",
      {
        input: {
          audio: audioBlob,
          script,
        },
      },
    )) as FAOutput[];

    if (!Array.isArray(output) || output.length === 0) {
      return NextResponse.json({ error: "forced-alignment: no output returned" }, { status: 500 });
    }

    // Filter to valid stamps only (model may emit null start/end for unaligned tokens)
    const allWords: WordStamp[] = output
      .filter((w) => typeof w.start === "number" && typeof w.end === "number")
      .map((w) => ({ word: String(w.word ?? ""), start: Number(w.start), end: Number(w.end) }));

    console.log(`[align] ${allWords.length} / ${output.length} tokens with timestamps`);

    if (allWords.length < 2) {
      return NextResponse.json({ error: "forced-alignment: insufficient word timestamps" }, { status: 500 });
    }

    const { timestamps, details } = alignByCount(allWords, kana, lines);
    console.log(`[align] mapped ${timestamps.length} / ${lines.length} lines`);

    writeAlignLog(allWords, details, output);

    return NextResponse.json({ timestamps });

  } catch (error) {
    console.error("[align] error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Alignment failed" },
      { status: 500 },
    );
  }
}
