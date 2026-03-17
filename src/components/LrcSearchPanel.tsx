"use client";

import { useState } from "react";
import { ParsedResult, LineTimestamp } from "@/types";

interface LrcTrack {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  syncedLyrics: string | null;
  plainLyrics: string | null;
}

interface Props {
  onLoaded: (result: {
    title: string;
    lines: string[];
    parsedResult: ParsedResult[];
    timestamps: LineTimestamp[] | null;
  }) => void;
  onClose: () => void;
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function fmtDur(sec: number) {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
}

// Parse "[mm:ss.xx] text" LRC format
function parseLrc(lrc: string): { text: string; time: number }[] {
  return lrc
    .split("\n")
    .map((line) => {
      const m = line.match(/^\[(\d{2}):(\d{2}(?:\.\d+)?)\]\s*(.*)$/);
      if (!m) return null;
      const time = parseInt(m[1]) * 60 + parseFloat(m[2]);
      return { text: m[3].trim(), time };
    })
    .filter((l): l is { text: string; time: number } => l !== null && l.text.length > 0);
}

function lrcToTimestamps(lines: { text: string; time: number }[]): LineTimestamp[] {
  return lines.map((l, i) => ({
    lineIndex: i,
    startTime: l.time,
    endTime: lines[i + 1]?.time ?? l.time + 5,
  }));
}

export default function LrcSearchPanel({ onLoaded, onClose }: Props) {
  const [query, setQuery]         = useState("");
  const [results, setResults]     = useState<LrcTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading]     = useState<number | null>(null); // track id being loaded
  const [error, setError]         = useState<string | null>(null);
  const [searched, setSearched]   = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || searching) return;
    setSearching(true);
    setError(null);
    setResults([]);
    setSearched(false);
    try {
      const res  = await fetch(`/api/lrclib?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "搜索失败");
      setResults(Array.isArray(data) ? data : []);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "搜索失败");
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = async (track: LrcTrack) => {
    setLoading(track.id);
    setError(null);
    try {
      const lrcText  = track.syncedLyrics ?? track.plainLyrics ?? "";
      const lrcLines = track.syncedLyrics ? parseLrc(track.syncedLyrics) : null;
      const lines    = lrcLines
        ? lrcLines.map((l) => l.text)
        : (track.plainLyrics ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

      if (lines.length === 0) throw new Error("该曲目没有可用歌词");

      const res  = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "解析失败");

      const timestamps = lrcLines ? lrcToTimestamps(lrcLines) : null;
      const title      = `${track.trackName} — ${track.artistName}`;

      onLoaded({ title, lines, parsedResult: data, timestamps });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索日语歌曲名 / 歌手…"
          className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            background: "#111",
            border: "1px solid #2e2e2e",
            color: "#f0f0f0",
            caretColor: "#38BCD4",
          }}
          onFocus={(e) => { (e.target as HTMLElement).style.borderColor = "#38BCD4"; }}
          onBlur={(e)  => { (e.target as HTMLElement).style.borderColor = "#2e2e2e"; }}
          autoFocus
        />
        <button
          type="submit"
          disabled={!query.trim() || searching}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 disabled:opacity-40"
          style={{ background: "#38BCD4", color: "#0f0f0f" }}
        >
          {searching ? <Spinner /> : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )}
          搜索
        </button>
      </form>

      {/* Error */}
      {error && (
        <p className="text-sm px-1" style={{ color: "#e85d4a" }}>{error}</p>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
          {results.map((track) => (
            <button
              key={track.id}
              onClick={() => handleSelect(track)}
              disabled={loading !== null}
              className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 disabled:opacity-50"
              style={{ background: "#111", border: "1px solid #252525" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "#3a3a3a";
                (e.currentTarget as HTMLElement).style.background = "#1a1a1a";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "#252525";
                (e.currentTarget as HTMLElement).style.background = "#111";
              }}
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-semibold truncate" style={{ color: "#f0f0f0" }}>
                  {track.trackName}
                </span>
                <span className="text-xs truncate" style={{ color: "#666" }}>
                  {track.artistName}{track.albumName ? ` · ${track.albumName}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {track.syncedLyrics && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(56,188,212,0.12)", color: "#38BCD4", border: "1px solid rgba(56,188,212,0.25)" }}>
                    时间轴
                  </span>
                )}
                <span className="text-[11px] font-mono" style={{ color: "#444" }}>
                  {fmtDur(track.duration)}
                </span>
                {loading === track.id ? (
                  <Spinner />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {searched && results.length === 0 && !error && (
        <p className="text-sm text-center py-4" style={{ color: "#555" }}>
          没有找到结果，换个关键词试试
        </p>
      )}

      {!searched && (
        <p className="text-xs px-1" style={{ color: "#444" }}>
          数据来源：LRCLIB · 带「时间轴」标记的曲目可跳过音频上传直接同步播放
        </p>
      )}
    </div>
  );
}
