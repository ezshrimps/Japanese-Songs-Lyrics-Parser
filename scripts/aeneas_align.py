#!/usr/bin/env python3
"""
Forced audio-lyric alignment via stable-ts (Whisper + attention-weight word timestamps).
Usage: python3 aeneas_align.py --audio <path> --lyrics-file <json_path> [--model <name>]
Output: JSON array of { lineIndex, startTime, endTime } to stdout.
"""
import sys
import json
import os
import argparse


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio", required=True)
    parser.add_argument("--lyrics-file", required=True)
    parser.add_argument("--model", default="medium", help="Whisper model: tiny/base/small/medium/large-v2/large-v3")
    args = parser.parse_args()

    with open(args.lyrics_file, "r", encoding="utf-8") as f:
        lyric_lines = [l.strip() for l in json.load(f) if l.strip()]

    import stable_whisper
    model = stable_whisper.load_model(args.model)

    # align() forces the given text onto the audio using cross-attention weights.
    # Pass lyrics joined by newlines — stable-ts splits on newlines into segments.
    text = "\n".join(lyric_lines)
    result = model.align(os.path.abspath(args.audio), text, language="ja")

    segments = result.segments

    timestamps = []

    if len(segments) == len(lyric_lines):
        # Perfect 1-to-1: each segment is one lyric line
        for i, seg in enumerate(segments):
            timestamps.append({
                "lineIndex": i,
                "startTime": round(seg.start, 3),
                "endTime":   round(seg.end,   3),
            })
    else:
        # Mismatch: fall back to word-level mapping.
        # Collect all words with timestamps, then assign to lines by
        # finding the first word whose text overlaps each lyric line.
        words = [w for seg in segments for w in seg.words]

        # Build a flat list of (word_text, start, end)
        word_tokens = [(w.word.strip(), w.start, w.end) for w in words if w.word.strip()]

        # For each lyric line, scan words for the best matching window
        used_up_to = 0
        for i, line in enumerate(lyric_lines):
            line_chars = line.replace(" ", "").replace("\u3000", "")
            best_start = None
            best_end   = None
            # Greedy: find earliest unused word that shares characters with this line
            window_words = word_tokens[used_up_to:]
            for j, (wtxt, wstart, wend) in enumerate(window_words):
                wtxt_clean = wtxt.replace(" ", "")
                overlap = sum(1 for c in wtxt_clean if c in line_chars)
                if overlap > 0:
                    if best_start is None:
                        best_start = wstart
                        used_up_to = used_up_to + j  # advance pointer
                    best_end = wend
            if best_start is None:
                # No word matched — estimate proportionally
                total = segments[-1].end if segments else 0
                best_start = round(i * total / len(lyric_lines), 3)
                best_end   = round((i + 1) * total / len(lyric_lines), 3)
            timestamps.append({
                "lineIndex": i,
                "startTime": round(best_start, 3),
                "endTime":   round(best_end,   3),
            })

    # Clean cuts: each line ends where the next starts
    for i in range(len(timestamps) - 1):
        timestamps[i]["endTime"] = timestamps[i + 1]["startTime"]

    print(json.dumps(timestamps))


if __name__ == "__main__":
    main()
