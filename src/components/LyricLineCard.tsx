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
      className="animate-fade-up rounded-2xl overflow-hidden"
      style={{
        animationDelay: `${index * 55}ms`,
        background: "#ffffff",
        boxShadow:
          "0 4px 24px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      {/* ── Lyric body ─────────────────────────────────────────────────── */}
      <div className="px-8 pt-10 pb-8 text-center">
        {/* Ruby text */}
        <div
          className="font-black leading-loose mb-4 flex flex-wrap justify-center"
          style={{ fontSize: "clamp(1.6rem, 4.5vw, 2.8rem)", color: "#E8634A" }}
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
          className="italic tracking-wider mb-6"
          style={{
            fontSize: "clamp(0.78rem, 1.8vw, 1rem)",
            color: "#2A8FA0",
            letterSpacing: "0.06em",
          }}
        >
          {line.fullRomaji}
        </p>

        {/* Translation */}
        <div
          className="inline-block rounded-2xl px-8 py-3"
          style={{
            background: "linear-gradient(135deg, #edfbff, #e6f7fa)",
            border: "1.5px solid rgba(56,188,212,0.25)",
          }}
        >
          <p
            className="font-bold"
            style={{
              fontSize: "clamp(0.9rem, 2.2vw, 1.15rem)",
              color: "#1B7F94",
            }}
          >
            {line.chineseTranslation}
          </p>
        </div>
      </div>

      {/* ── Grammar toggle ──────────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-8 py-3 transition-colors duration-200"
        style={{
          borderTop: "1px solid rgba(0,0,0,0.06)",
          background: expanded
            ? "rgba(232,99,74,0.03)"
            : "rgba(56,188,212,0.03)",
        }}
      >
        <span
          className="flex items-center gap-2 text-sm font-semibold"
          style={{ color: expanded ? "#C95A3E" : "#2A8FA0" }}
        >
          {/* Chevron — rotates smoothly */}
          <svg
            width="16"
            height="16"
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
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            background: expanded
              ? "rgba(232,99,74,0.1)"
              : "rgba(56,188,212,0.1)",
            color: expanded ? "#C95A3E" : "#2A8FA0",
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
          <div
            className="p-5"
            style={{
              background: "#f8feff",
              borderTop: "1px solid rgba(56,188,212,0.1)",
            }}
          >
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
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
