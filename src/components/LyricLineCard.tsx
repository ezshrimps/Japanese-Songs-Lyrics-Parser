"use client";

import { useState } from "react";
import { ParsedResult } from "@/types";
import GrammarCard from "./GrammarCard";

export default function LyricLineCard({
  line,
  index = 0,
}: {
  line: ParsedResult;
  index?: number;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className="animate-fade-up rounded-xl overflow-hidden relative"
      style={{
        animationDelay: `${index * 55}ms`,
        background: "#1a1a1a",
        border: "1px solid #2e2e2e",
      }}
    >
      {/* Line number badge */}
      <div
        className="absolute top-3 left-3 font-mono text-[10px]"
        style={{ color: "#333" }}
      >
        {String(index + 1).padStart(2, "0")}
      </div>

      {/* ── Lyric body ─────────────────────────────────────────────────── */}
      <div className="px-8 pt-10 pb-8 text-center">
        {/* Ruby text */}
        <div
          className="font-black leading-loose mb-4 flex flex-wrap justify-center"
          style={{ fontSize: "clamp(1.5rem, 4vw, 2.4rem)", color: "#f0f0f0" }}
        >
          {line.segments.map((seg, i) =>
            seg.hiragana ? (
              <ruby key={i}>
                {seg.text}
                <rt>{seg.hiragana}</rt>
              </ruby>
            ) : (
              <span key={i}>{seg.text}</span>
            )
          )}
        </div>

        {/* Romaji */}
        <p
          className="italic mb-5"
          style={{ fontSize: "13px", color: "#888", letterSpacing: "0.04em" }}
        >
          {line.fullRomaji}
        </p>

        {/* Translation — blue pill */}
        <div
          className="inline-block rounded-full px-5 py-1.5"
          style={{
            background: "rgba(74,158,255,0.1)",
            border: "1px solid rgba(74,158,255,0.18)",
          }}
        >
          <p className="text-sm font-medium" style={{ color: "#4a9eff" }}>
            {line.chineseTranslation}
          </p>
        </div>
      </div>

      {/* ── Grammar toggle ──────────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-2.5 transition-colors duration-150"
        style={{ borderTop: "1px solid #2a2a2a", background: "transparent" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "#222";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <span
          className="flex items-center gap-2 text-xs font-medium"
          style={{ color: "#555" }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="transition-transform duration-300"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          语法解析
        </span>
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{
            background: "#222",
            color: "#555",
            border: "1px solid #2e2e2e",
          }}
        >
          {line.grammarBreakdown.length} 项
        </span>
      </button>

      {/* ── Grammar grid (smooth CSS-grid height animation) ─────────────── */}
      <div
        className={`grammar-grid-wrapper ${expanded ? "open" : "closed"}`}
        aria-hidden={!expanded}
      >
        <div className="grammar-grid-inner">
          <div className="p-4" style={{ borderTop: "1px solid #252525" }}>
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              }}
            >
              {line.grammarBreakdown.map((unit, i) => (
                <GrammarCard key={i} unit={unit} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
