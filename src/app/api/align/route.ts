import Replicate from "replicate";
import { NextRequest, NextResponse } from "next/server";
import { LineTimestamp } from "@/types";
import fs from "fs";
import path from "path";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

export const maxDuration = 600;

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

/** Returns true if the character is a CJK kanji (not hiragana/katakana) */
function isKanji(c: string): boolean {
  const code = c.charCodeAt(0);
  return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf);
}

/**
 * From position `fromWi` onward, return the first character of the first
 * non-kanji word. Used to know where to resume kana matching after a kanji word.
 */
function nextKanaChar(words: WordStamp[], fromWi: number): string {
  for (let i = fromWi; i < words.length; i++) {
    const n = norm(words[i].word);
    if (n && !isKanji(n[0])) return n[0];
  }
  return "";
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
 * Sequential scan alignment — matches kana characters one-by-one against
 * WhisperX word-level timestamps, with special handling for kanji words.
 *
 * WhisperX outputs character-level timestamps for Japanese (each "word" = 1 char).
 * For each lyric line we advance through the words array, matching kana query chars:
 *   - Exact match  → record as start/end word, advance both pointers
 *   - Kanji word   → advance kana pointer past the kanji's reading (until next kana char)
 *   - No match     → advance only the WhisperX word pointer (drift correction)
 */
function alignByKana(
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

  let prevLineEndWi = -1;

  for (const { lineIndex, text } of nonEmpty) {
    const query = norm(kanaLines[lineIndex] ?? originalLines[lineIndex] ?? "");

    let wi = prevLineEndWi + 1;
    let ki = 0;
    let startWordIdx = -1;
    let endWordIdx = prevLineEndWi >= 0 ? prevLineEndWi : 0;

    while (wi < words.length && ki < query.length) {
      const wNorm = norm(words[wi].word);
      if (!wNorm) { wi++; continue; }

      if (isKanji(wNorm[0])) {
        // Kanji word: mark as end candidate, skip kana chars until next kana word's first char
        if (startWordIdx === -1) startWordIdx = wi;
        endWordIdx = wi;
        const nk = nextKanaChar(words, wi + 1);
        // Skip kana query chars that correspond to this kanji's reading.
        // Use indexOf so that if nk is absent from the remaining query
        // (e.g. WhisperX mis-read 胸(むね) as 群れ(むれ)), we don't
        // exhaust ki and prematurely end the line.
        const nkIdx = nk ? query.indexOf(nk, ki) : -1;
        if (nkIdx !== -1) ki = nkIdx;
        wi++;
      } else if (wNorm[0] === query[ki]) {
        // Exact match
        if (startWordIdx === -1) startWordIdx = wi;
        endWordIdx = wi;
        wi++;
        ki++;
      } else {
        // No match — advance only the WhisperX pointer to correct drift
        wi++;
      }
    }

    // Fallback: if nothing matched, use word right after previous line
    if (startWordIdx === -1) {
      startWordIdx = Math.min(prevLineEndWi + 1, words.length - 1);
      endWordIdx = startWordIdx;
    }

    prevLineEndWi = endWordIdx;

    const ts: LineTimestamp = {
      lineIndex,
      startTime: words[startWordIdx].start,
      endTime:   words[endWordIdx].end,
    };
    timestamps.push(ts);
    details.push({
      lineIndex,
      text,
      kana: query,
      startWordIdx,
      endWordIdx,
      timestamp: ts,
    });
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
          initial_prompt: lines.filter((l) => l.trim()).join("　"),
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

    const { timestamps, details } = alignByKana(allWords, kana, lines);
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
