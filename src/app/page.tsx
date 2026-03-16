"use client";

import { useState, useEffect, useRef } from "react";
import LyricsDisplay from "@/components/LyricsDisplay";
import SavedLyricsSidebar from "@/components/SavedLyricsSidebar";
import { useSavedLyrics } from "@/hooks/useSavedLyrics";
import { useSavedGrammar } from "@/hooks/useSavedGrammar";
import { ParsedResult, LineTimestamp } from "@/types";

const EXAMPLES = [
  "事が一つ二つ浮いているけど",
  "桜の花びらたちが風に舞いあがる",
  "会いたくて会いたくて震える",
  "夜に駆けるのはやめてよ",
];

const MAX_CHARS = 20000;

// ── Kana helpers ──────────────────────────────────────────────────────────
function toHiragana(text: string): string {
  return text.replace(/[\u30A1-\u30F6]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60),
  );
}
function getLineKana(line: import("@/types").ParsedResult): string {
  return toHiragana(line.segments.map((s) => s.hiragana ?? s.text).join(""));
}

// ── Spinner ────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Sidebar toggle icon ───────────────────────────────────────────────────
function IconPanel({ open }: { open: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      {open ? (
        <polyline points="15 8 11 12 15 16" />
      ) : (
        <polyline points="13 8 17 12 13 16" />
      )}
    </svg>
  );
}

// ── Audio Player ──────────────────────────────────────────────────────────
const fmtTime = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function AudioPlayer({
  currentTime, duration, isPlaying,
  onPlayPause, onSeek,
}: {
  currentTime: number; duration: number; isPlaying: boolean;
  onPlayPause: () => void; onSeek: (t: number) => void;
}) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  return (
    <div
      className="rounded-xl flex items-center gap-3 px-4 py-2.5 animate-fade-in"
      style={{ background: "#1a1a1a", border: "1px solid #2e2e2e" }}
    >
      {/* Play/Pause */}
      <button
        onClick={onPlayPause}
        className="flex items-center justify-center rounded-md flex-shrink-0 transition-all duration-150"
        style={{
          width: 32, height: 32,
          background: "rgba(238,193,112,0.12)",
          border: "1px solid rgba(238,193,112,0.3)",
          color: "#EEC170",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(238,193,112,0.2)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(238,193,112,0.12)"; }}
      >
        {isPlaying ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>

      {/* Time */}
      <span className="text-[11px] font-mono flex-shrink-0" style={{ color: "#666", minWidth: 36 }}>
        {fmtTime(currentTime)}
      </span>

      {/* Seek bar */}
      <div className="flex-1 relative h-1 rounded-full" style={{ background: "#2e2e2e" }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #E8634A, #EEC170)",
          }}
        />
        <input
          type="range" min={0} max={duration || 1} step={0.1} value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          style={{ height: "100%" }}
        />
      </div>

      {/* Duration */}
      <span className="text-[11px] font-mono flex-shrink-0" style={{ color: "#444", minWidth: 36, textAlign: "right" }}>
        {fmtTime(duration)}
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [lyrics, setLyrics]             = useState("");
  const [result, setResult]             = useState<ParsedResult[] | null>(null);
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [sidebarOpen, setSidebarOpen]   = useState(true);
  const [progress, setProgress]         = useState(0);
  const intervalRef                     = useRef<ReturnType<typeof setInterval> | null>(null);
  const lineCountRef                    = useRef(1);
  // Audio state
  const audioRef                        = useRef<HTMLAudioElement | null>(null);
  const segmentEndRef                   = useRef<number | null>(null); // null = free play
  const activeLineRef                   = useRef<number | null>(null); // mirrors state, stale-closure-safe
  const pendingPlayRef                  = useRef<Promise<void> | null>(null);
  const segmentTimerRef                 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [audioUrl, setAudioUrl]         = useState<string | null>(null);
  const [timestamps, setTimestamps]     = useState<LineTimestamp[] | null>(null);
  const [currentTime, setCurrentTime]   = useState(0);
  const [duration, setDuration]         = useState(0);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [isAligning, setIsAligning]     = useState(false);
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
  const [alignModel, setAlignModel]     = useState("medium");
  const [level, setLevel]               = useState<"初级" | "中级" | "高级">("中级");

  // Keep ref in sync with state (avoids stale closure reads in event handlers)
  const setActiveLine = (idx: number | null) => {
    activeLineRef.current = idx;
    setActiveLineIndex(idx);
  };

  // play() that handles the returned Promise and swallows expected AbortErrors
  const safePlay = async (): Promise<boolean> => {
    const audio = audioRef.current;
    if (!audio) return false;
    try {
      pendingPlayRef.current = audio.play();
      await pendingPlayRef.current;
      pendingPlayRef.current = null;
      return true;
    } catch (e) {
      pendingPlayRef.current = null;
      if ((e as Error).name !== "AbortError") console.error("[audio] play error", e);
      return false;
    }
  };

  // pause() that waits for any in-flight play() Promise first
  const safePause = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (pendingPlayRef.current) {
      try { await pendingPlayRef.current; } catch { /* AbortError ok */ }
    }
    audio.pause();
  };

  // Progress bar animation
  useEffect(() => {
    if (isLoading) {
      setProgress(0);
      const startTime = Date.now();
      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const tau = Math.max(5000, lineCountRef.current * 2000);
        setProgress(90 * (1 - Math.exp(-elapsed / tau)));
      }, 80);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setProgress((p) => {
        if (p > 0) {
          setTimeout(() => setProgress(0), 700);
          return 100;
        }
        return 0;
      });
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLoading]);

  const [currentSavedId, setCurrentSavedId] = useState<string | null>(null);
  const { saved, save, remove, rename, togglePin, updateTimestamps } = useSavedLyrics();
  const { savedGrammar, savedIds, save: saveGrammar, remove: removeGrammar } = useSavedGrammar();

  // Parse
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = lyrics.trim();
    if (!trimmed || isLoading) return;
    lineCountRef.current = trimmed.split("\n").filter((l) => l.trim()).length;
    setIsLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "解析失败，请重试");
      setResult(data);
      const id = save(trimmed, data);
      setCurrentSavedId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发生未知错误");
    } finally {
      setIsLoading(false);
    }
  };

  // Save
  const handleSave = () => {
    const trimmed = lyrics.trim();
    if (!trimmed) return;
    const id = save(trimmed, result ?? undefined);
    setCurrentSavedId(id);
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 2000);
  };

  // Load from sidebar
  const handleLoad = (item: import("@/types").SavedLyric) => {
    setLyrics(item.content);
    setResult(item.parsedResult ?? null);
    setError(null);
    setAudioUrl(null);
    setTimestamps(item.timestamps ?? null);
    setActiveLine(null);
    segmentEndRef.current = null;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setCurrentSavedId(item.id);
  };

  // Audio: upload MP3 + call align API
  const handleAudioFile = async (file: File) => {
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setTimestamps(null);
    setCurrentTime(0);
    setIsPlaying(false);
    setActiveLine(null);
    segmentEndRef.current = null;
    if (!result) return;

    const actualDuration = await new Promise<number>((resolve) => {
      const tmp = new Audio();
      tmp.onloadedmetadata = () => resolve(isFinite(tmp.duration) ? tmp.duration : 240);
      tmp.onerror = () => resolve(240);
      tmp.src = url;
    });

    setIsAligning(true);
    try {
      const formData = new FormData();
      formData.append("audio", file);
      formData.append("lyrics", JSON.stringify(result.map((r) => r.originalText)));
      formData.append("kana",   JSON.stringify(result.map((r) => r.kana ?? getLineKana(r))));
      formData.append("duration", String(actualDuration));
      formData.append("model", alignModel);
      const res  = await fetch("/api/align", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.timestamps) {
        setTimestamps(data.timestamps);
        if (currentSavedId) updateTimestamps(currentSavedId, data.timestamps);
      }
    } catch (err) {
      console.error("Align error:", err);
    } finally {
      setIsAligning(false);
    }
  };

  // Stop segment playback and reset state
  const stopSegment = () => {
    if (segmentTimerRef.current) { clearTimeout(segmentTimerRef.current); segmentTimerRef.current = null; }
    segmentEndRef.current = null;
    const audio = audioRef.current;
    if (audio && !audio.paused) audio.pause(); // onPause → setIsPlaying(false)
    setActiveLine(null);
  };

  // Schedule automatic stop at segment end via setTimeout (precision ~1-10ms,
  // far better than timeupdate's ~250ms polling which causes overshoot)
  const scheduleStop = (endTime: number, startedAt: number) => {
    if (segmentTimerRef.current) clearTimeout(segmentTimerRef.current);
    const remaining = (endTime - startedAt) * 1000;
    segmentTimerRef.current = setTimeout(stopSegment, Math.max(0, remaining));
  };

  // Click a lyric line: play / pause / resume
  const seekToLine = async (lineIndex: number) => {
    const audio = audioRef.current;
    if (!audio || !timestamps) return;

    // Same line, currently playing → pause (keep highlight, cancel timer)
    if (activeLineRef.current === lineIndex && !audio.paused) {
      if (segmentTimerRef.current) { clearTimeout(segmentTimerRef.current); segmentTimerRef.current = null; }
      await safePause();
      return;
    }

    // Same line, paused mid-segment → resume + reschedule stop timer
    if (activeLineRef.current === lineIndex && audio.paused && segmentEndRef.current !== null) {
      const ok = await safePlay();
      if (ok) scheduleStop(segmentEndRef.current, audio.currentTime);
      return;
    }

    // Different line (or segment finished) → stop current, seek, play
    stopSegment();
    await safePause();
    const ts = timestamps.find((t) => t.lineIndex === lineIndex);
    if (!ts) return;
    segmentEndRef.current = ts.endTime;
    setActiveLine(lineIndex);
    audio.currentTime = ts.startTime;
    const ok = await safePlay();
    if (ok) scheduleStop(ts.endTime, ts.startTime);
  };

  // timeupdate: update scrubber only; stopSegment is handled by setTimeout
  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
  };

  return (
    <div style={{ background: "#0f0f0f", minHeight: "100vh" }}>

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5"
        style={{
          height: 52,
          background: "#0f0f0f",
          borderBottom: "1px solid #2e2e2e",
        }}
      >
        <div className="flex items-center gap-2.5">
          <span style={{ color: "#E8634A", fontSize: "18px", lineHeight: 1 }}>♪</span>
          <span className="font-semibold text-base" style={{ color: "#f0f0f0" }}>
            歌词解析
          </span>
        </div>

        <div style={{ width: 32 }} />
      </header>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <div
        className="fixed left-0 z-40 transition-transform duration-300"
        style={{
          top: 52,
          width: 260,
          height: "calc(100vh - 52px)",
          transform: sidebarOpen ? "translateX(0)" : "translateX(-260px)",
        }}
      >
        <SavedLyricsSidebar
          saved={saved}
          onLoad={handleLoad}
          onDelete={remove}
          onRename={rename}
          onTogglePin={togglePin}
          savedGrammar={savedGrammar}
          onDeleteGrammar={removeGrammar}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
      </div>

      {/* ── Sidebar open tab (when sidebar is closed) ─────────────────────── */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          title="展开侧边栏"
          className="fixed z-40 flex items-center justify-center transition-all duration-150"
          style={{
            top: 52 + 12,
            left: 0,
            width: 20,
            height: 32,
            background: "#1a1a1a",
            border: "1px solid #2e2e2e",
            borderLeft: "none",
            borderRadius: "0 6px 6px 0",
            color: "#444",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#aaa"; (e.currentTarget as HTMLElement).style.background = "#252525"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#444"; (e.currentTarget as HTMLElement).style.background = "#1a1a1a"; }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* ── Main scroll area ───────────────────────────────────────────────── */}
      <div
        className="transition-all duration-300 min-h-screen overflow-y-auto"
        style={{
          marginLeft: sidebarOpen ? 260 : 0,
          paddingTop: 52,
        }}
      >
        <main className="max-w-4xl mx-auto px-6 py-10">

          {/* ── Page title ───────────────────────────────────────────────── */}
          <div className="mb-8">
            <h1
              className="text-4xl font-black tracking-tight leading-snug mb-1"
              style={{
                background: "linear-gradient(100deg, #E8634A 0%, #f0956c 45%, #38BCD4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              虾学日语歌 ShrimpLyricsParser
            </h1>
            <p className="text-[10px] tracking-[0.22em] uppercase" style={{ color: "#444" }}>
              Japanese Lyrics Parser
            </p>
          </div>

          {/* ── Input card ──────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="mb-8">
            <div className="flex gap-3 items-start">

              {/* Level selector */}
              <div
                className="flex flex-col flex-shrink-0 rounded-xl"
                style={{ background: "#1a1a1a", border: "1px solid #2e2e2e" }}
              >
                <div className="px-3 pt-3 pb-2 flex items-center justify-center gap-1">
                  <div className="relative group/tip">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#444", cursor: "default", flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <div
                      className="absolute z-50 pointer-events-none opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150"
                      style={{
                        left: "50%", bottom: "calc(100% + 6px)",
                        transform: "translateX(-50%)",
                        width: 180,
                        background: "#1e1e1e",
                        border: "1px solid #333",
                        borderRadius: 8,
                        padding: "8px 10px",
                        fontSize: 11,
                        lineHeight: 1.6,
                        color: "#aaa",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                      }}
                    >
                      根据你的日语水平决定语法解析的深度。<br />
                      <span style={{ color: "#27AE60" }}>初级</span>：解析所有语法包括基础助词。<br />
                      <span style={{ color: "#4A90E8" }}>中级</span>：跳过常见助词，聚焦句型变化。<span style={{ color: "#4A90E8" }}>（推荐）</span><br />
                      <span style={{ color: "#9B59B6" }}>高级</span>：仅解析 N3 以上复杂语法。
                    </div>
                  </div>
                  <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: "#444" }}>
                    水平
                  </span>
                </div>
                {(["初级", "中级", "高级"] as const).map((lv) => {
                  const active = level === lv;
                  const colors: Record<string, string> = { "初级": "#27AE60", "中级": "#4A90E8", "高级": "#9B59B6" };
                  const c = colors[lv];
                  return (
                    <button
                      key={lv}
                      type="button"
                      onClick={() => setLevel(lv)}
                      className="px-4 py-2.5 text-xs font-semibold transition-all duration-150 relative"
                      style={{
                        color: active ? c : "#444",
                        background: active ? `${c}14` : "transparent",
                        borderLeft: `2px solid ${active ? c : "transparent"}`,
                      }}
                    >
                      {lv}
                    </button>
                  );
                })}
                <div className="pb-2" />
              </div>

            <div
              className="flex-1 rounded-xl overflow-hidden"
              style={{ background: "#1a1a1a", border: "1px solid #2e2e2e" }}
            >
              <div className="px-4 pt-4 pb-1">
                <span
                  className="text-[10px] font-bold tracking-widest uppercase"
                  style={{ color: "#38BCD4", opacity: 0.6 }}
                >
                  输入歌词
                </span>
              </div>

              <div className="relative">
                <textarea
                  value={lyrics}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX_CHARS) setLyrics(e.target.value);
                  }}
                  placeholder={"输入日语歌词……支持多行整首歌曲\n\n例：事が一つ二つ浮いているけど\n    回り出したあの子と僕の未来が止まり"}
                  className="w-full resize-none outline-none px-4 pb-8"
                  style={{
                    background: "#111111",
                    color: "#f0f0f0",
                    fontSize: "1rem",
                    lineHeight: "1.8",
                    caretColor: "#38BCD4",
                    minHeight: "140px",
                  }}
                  rows={6}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleSubmit(e as unknown as React.FormEvent);
                    }
                  }}
                />
                <span
                  className="absolute bottom-2 right-3 text-[10px] font-mono pointer-events-none"
                  style={{
                    color: lyrics.length > MAX_CHARS * 0.9 ? "#E8634A" : "#333",
                  }}
                >
                  {lyrics.length}/{MAX_CHARS}
                </span>
              </div>

              <div
                className="px-4 pb-4 flex flex-wrap gap-2 items-center"
                style={{ borderTop: "1px solid #252525" }}
              >
                <span className="text-[10px] pt-3" style={{ color: "#444" }}>
                  试试：
                </span>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setLyrics(ex)}
                    className="text-xs rounded-full transition-all duration-150"
                    style={{
                      marginTop: "0.75rem",
                      padding: "3px 10px",
                      background: "#171717",
                      border: "1px solid #2e2e2e",
                      color: "#555",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "#252525";
                      (e.currentTarget as HTMLElement).style.color = "#aaa";
                      (e.currentTarget as HTMLElement).style.borderColor = "#444";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "#171717";
                      (e.currentTarget as HTMLElement).style.color = "#555";
                      (e.currentTarget as HTMLElement).style.borderColor = "#2e2e2e";
                    }}
                  >
                    ♪ {ex}
                  </button>
                ))}
              </div>
            </div>
            </div> {/* end flex gap-3 */}

            {/* Buttons row */}
            <div className="flex items-center justify-between gap-3 mt-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={!lyrics.trim()}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: "transparent",
                  border: `1px solid ${saveFeedback ? "rgba(56,188,212,0.4)" : "#2e2e2e"}`,
                  color: saveFeedback ? "#38BCD4" : "#666",
                }}
                onMouseEnter={(e) => {
                  if (lyrics.trim() && !saveFeedback) {
                    (e.currentTarget as HTMLElement).style.borderColor = "#444";
                    (e.currentTarget as HTMLElement).style.color = "#aaa";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!saveFeedback) {
                    (e.currentTarget as HTMLElement).style.borderColor = "#2e2e2e";
                    (e.currentTarget as HTMLElement).style.color = "#666";
                  }
                }}
              >
                {saveFeedback ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    已保存
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    保存
                  </>
                )}
              </button>

              <button
                type="submit"
                disabled={isLoading || !lyrics.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #e8634a 0%, #cf4f38 100%)",
                  boxShadow: isLoading || !lyrics.trim() ? "none" : "0 3px 16px rgba(232,99,74,0.3)",
                }}
                onMouseEnter={(e) => {
                  if (!isLoading && lyrics.trim())
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 22px rgba(232,99,74,0.45)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 3px 16px rgba(232,99,74,0.3)";
                }}
              >
                {isLoading ? (
                  <><Spinner />解析中……</>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    解析歌词 ⌘↵
                  </>
                )}
              </button>
            </div>

            {/* Progress bar */}
            {progress > 0 && (
              <div className="mt-4 animate-fade-in">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[11px]" style={{ color: "#666" }}>
                    {progress < 30 ? "正在分析歌词…" : progress < 65 ? "正在解析语法…" : progress < 100 ? "即将完成…" : "解析完成 ✓"}
                  </span>
                  <span className="text-[11px] font-mono" style={{ color: "#f0956c" }}>
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: 3, background: "#1e1e1e" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${progress}%`,
                      background: "linear-gradient(90deg, #772F1A, #E8634A, #f0956c, #EEC170)",
                      boxShadow: "0 0 6px rgba(240,149,108,0.45)",
                      transition: progress === 100 ? "width 0.3s ease" : "width 0.12s linear",
                    }}
                  />
                </div>
              </div>
            )}
          </form>

          {/* ── Error ───────────────────────────────────────────────────── */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 mb-6 flex items-center gap-3 animate-fade-in"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.18)",
                color: "#fca5a5",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* ── Results ─────────────────────────────────────────────────── */}
          {result && (
            <>
              {/* Audio upload + player */}
              <div className="mb-5 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  {/* Model selector */}
                  <select
                    value={alignModel}
                    onChange={(e) => setAlignModel(e.target.value)}
                    disabled={isAligning}
                    className="text-xs rounded-lg px-2 py-2 outline-none cursor-pointer disabled:opacity-40"
                    style={{ background: "#171717", border: "1px solid #2e2e2e", color: "#666" }}
                  >
                    <option value="tiny">tiny · 最快</option>
                    <option value="base">base · 快</option>
                    <option value="small">small · 均衡</option>
                    <option value="medium">medium · 推荐</option>
                    <option value="large-v2">large-v2 · 最准</option>
                  </select>

                  {/* Upload button */}
                  <label
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 flex-shrink-0"
                    style={{
                      background: "transparent",
                      border: "1px solid #2e2e2e",
                      color: audioUrl ? "#EEC170" : "#555",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "#444";
                      (e.currentTarget as HTMLElement).style.color = "#aaa";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "#2e2e2e";
                      (e.currentTarget as HTMLElement).style.color = audioUrl ? "#EEC170" : "#555";
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                    </svg>
                    {isAligning ? "对位中…" : audioUrl ? "重新上传音频" : "上传音频对位"}
                    <input
                      type="file" accept="audio/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAudioFile(f); e.target.value = ""; }}
                    />
                  </label>

                  {isAligning && (
                    <span className="text-[11px] flex items-center gap-1.5" style={{ color: "#666" }}>
                      <Spinner />
                      正在对位歌词…
                    </span>
                  )}

                  {timestamps && !isAligning && (
                    <span className="text-[11px]" style={{ color: "#585123" }}>
                      ✓ 已对位 {timestamps.length} 行
                    </span>
                  )}
                </div>

                {/* Audio player */}
                {audioUrl && (
                  <AudioPlayer
                    currentTime={currentTime}
                    duration={duration}
                    isPlaying={isPlaying}
                    onPlayPause={async () => {
                      if (!audioRef.current) return;
                      segmentEndRef.current = null; // exit segment-preview mode
                      setActiveLine(null);
                      if (!audioRef.current.paused) {
                        await safePause();
                      } else {
                        await safePlay();
                      }
                    }}
                    onSeek={(t) => {
                      if (!audioRef.current) return;
                      audioRef.current.currentTime = t;
                    }}
                  />
                )}
              </div>

              <LyricsDisplay
                data={result}
                savedIds={savedIds}
                onSaveGrammar={saveGrammar}
                timestamps={timestamps ?? undefined}
                activeLineIndex={activeLineIndex}
                isPlaying={isPlaying}
                onPlayLine={timestamps ? seekToLine : undefined}
                level={level}
              />

              {/* Hidden audio element */}
              {audioUrl && (
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration); }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => { segmentEndRef.current = null; setActiveLine(null); setIsPlaying(false); }}
                />
              )}
            </>
          )}

          <div className="h-16" />
        </main>
      </div>
    </div>
  );
}
