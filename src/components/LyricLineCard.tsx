"use client";

import { useState, useMemo } from "react";
import { ParsedResult, GrammarUnit, Segment } from "@/types";
import GrammarCard from "./GrammarCard";
import { grammarId } from "@/hooks/useSavedGrammar";

// ── Styles ────────────────────────────────────────────────────────────────
const HL_STYLE: React.CSSProperties = {
  color: "#EEC170",
  background: "rgba(238,193,112,0.08)",
  borderRadius: 2,
  transition: "color 0.15s ease, background 0.15s ease",
};
const NORMAL_STYLE: React.CSSProperties = {
  color: "#f0f0f0",
  transition: "color 0.15s ease, background 0.15s ease",
};

// ── Render one segment with per-character highlight awareness ─────────────
function SegmentNode({
  seg,
  segStart,
  hlChars,
}: {
  seg: Segment;
  segStart: number;
  hlChars: Set<number>;
}) {
  const charHls = Array.from(seg.text).map((_, i) => hlChars.has(segStart + i));
  const anyHl = charHls.some(Boolean);
  const allHl = anyHl && charHls.every(Boolean);

  if (!anyHl) {
    return seg.hiragana
      ? <ruby style={NORMAL_STYLE}>{seg.text}<rt>{seg.hiragana}</rt></ruby>
      : <span style={NORMAL_STYLE}>{seg.text}</span>;
  }

  if (allHl) {
    return seg.hiragana
      ? <ruby style={HL_STYLE}>{seg.text}<rt>{seg.hiragana}</rt></ruby>
      : <span style={HL_STYLE}>{seg.text}</span>;
  }

  if (seg.hiragana) {
    const hlCount = charHls.filter(Boolean).length;
    const style = hlCount >= seg.text.length / 2 ? HL_STYLE : NORMAL_STYLE;
    return <ruby style={style}>{seg.text}<rt>{seg.hiragana}</rt></ruby>;
  }

  const runs: { text: string; hl: boolean }[] = [];
  let cur = { text: seg.text[0], hl: charHls[0] };
  for (let i = 1; i < seg.text.length; i++) {
    if (charHls[i] === cur.hl) {
      cur.text += seg.text[i];
    } else {
      runs.push(cur);
      cur = { text: seg.text[i], hl: charHls[i] };
    }
  }
  runs.push(cur);

  return (
    <>
      {runs.map((run, ri) => (
        <span key={ri} style={run.hl ? HL_STYLE : NORMAL_STYLE}>{run.text}</span>
      ))}
    </>
  );
}

// ── LyricLineCard ─────────────────────────────────────────────────────────
interface Props {
  line: ParsedResult;
  index?: number;
  savedIds: Set<string>;
  onSaveGrammar: (unit: GrammarUnit, sourceLine: string) => void;
  timestamp?: { startTime: number; endTime: number };
  isActive?: boolean;
  isLinePlaying?: boolean;
  onPlay?: () => void;
}

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function LyricLineCard({
  line, index = 0, savedIds, onSaveGrammar,
  timestamp, isActive = false, isLinePlaying = false, onPlay,
}: Props) {
  const [expanded, setExpanded]       = useState(true);
  const [hoveredText, setHoveredText] = useState<string | null>(null);

  const { fullText, segStarts } = useMemo(() => {
    let pos = 0;
    const starts = line.segments.map((seg) => { const s = pos; pos += seg.text.length; return s; });
    return { fullText: line.segments.map(s => s.text).join(""), segStarts: starts };
  }, [line.segments]);

  const hlChars = useMemo((): Set<number> => {
    if (!hoveredText) return new Set();
    const hl = new Set<number>();
    let idx = 0;
    while (idx < fullText.length) {
      const found = fullText.indexOf(hoveredText, idx);
      if (found === -1) break;
      for (let i = found; i < found + hoveredText.length; i++) hl.add(i);
      idx = found + 1;
    }
    return hl;
  }, [hoveredText, fullText]);

  return (
    <div
      className="animate-fade-up rounded-xl overflow-hidden relative transition-all duration-300"
      style={{
        animationDelay: `${index * 55}ms`,
        background: isActive ? "#1f1d18" : "#1a1a1a",
        border: `1px solid ${isActive ? "rgba(238,193,112,0.45)" : "#2e2e2e"}`,
        boxShadow: isActive ? "0 0 0 1px rgba(238,193,112,0.15), 0 4px 24px rgba(238,193,112,0.08)" : "none",
      }}
    >
      {/* Line number */}
      <div className="absolute top-3 left-3 font-mono text-[10px]" style={{ color: "#333" }}>
        {String(index + 1).padStart(2, "0")}
      </div>

      {/* Play button + timestamp (top-right) */}
      {timestamp && onPlay && (
        <div className="absolute top-2.5 right-3 flex items-center gap-1.5">
          <span className="text-[10px] font-mono" style={{ color: "#444" }}>
            {fmt(timestamp.startTime)}
          </span>
          <button
            onClick={onPlay}
            title="从此处播放"
            className="flex items-center justify-center rounded-md transition-all duration-150"
            style={{
              width: 22, height: 22,
              background: isActive ? "rgba(238,193,112,0.2)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${isActive ? "rgba(238,193,112,0.4)" : "#2e2e2e"}`,
              color: isActive ? "#EEC170" : "#555",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(238,193,112,0.15)";
              (e.currentTarget as HTMLElement).style.color = "#EEC170";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = isActive ? "rgba(238,193,112,0.2)" : "rgba(255,255,255,0.05)";
              (e.currentTarget as HTMLElement).style.color = isActive ? "#EEC170" : "#555";
            }}
          >
            {isLinePlaying ? (
              <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* ── Lyric body — click anywhere to seek ─────────────────────────── */}
      <div
        className="px-8 pt-10 pb-8 text-center"
        onClick={onPlay}
        style={{ cursor: onPlay ? "pointer" : "default" }}
      >
        {/* Ruby text */}
        <div
          className="font-black leading-loose mb-4 flex flex-wrap justify-center"
          style={{ fontSize: "clamp(1.5rem, 4vw, 2.4rem)" }}
        >
          {line.segments.map((seg, i) => (
            <SegmentNode key={i} seg={seg} segStart={segStarts[i]} hlChars={hlChars} />
          ))}
        </div>

        {/* Romaji */}
        <p className="italic mb-5" style={{ fontSize: "13px", color: "#888", letterSpacing: "0.04em" }}>
          {line.fullRomaji}
        </p>

        {/* Translation */}
        <p className="font-black leading-loose" style={{ fontSize: "clamp(1.1rem, 3vw, 1.8rem)", color: "#EEC170" }}>
          {line.chineseTranslation}
        </p>
      </div>

      {/* ── Grammar toggle ──────────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-2.5 transition-colors duration-150"
        style={{ borderTop: "1px solid #2a2a2a", background: "transparent" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#222"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        <span className="flex items-center gap-2 text-xs font-medium" style={{ color: "#555" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className="transition-transform duration-300"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          语法解析
        </span>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{ background: "#222", color: "#555", border: "1px solid #2e2e2e" }}>
          {line.grammarBreakdown.length} 项
        </span>
      </button>

      {/* ── Grammar grid ─────────────────────────────────────────────────── */}
      <div className={`grammar-grid-wrapper ${expanded ? "open" : "closed"}`} aria-hidden={!expanded}>
        <div className="grammar-grid-inner">
          <div className="p-4" style={{ borderTop: "1px solid #252525" }}>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
              {line.grammarBreakdown.map((unit, i) => (
                <GrammarCard
                  key={i}
                  unit={unit}
                  onHoverIn={() => setHoveredText(unit.text)}
                  onHoverOut={() => setHoveredText(null)}
                  onSave={() => onSaveGrammar(unit, line.originalText)}
                  isSaved={savedIds.has(grammarId(unit))}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
