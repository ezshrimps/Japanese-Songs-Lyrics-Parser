"use client";

import { useState, useEffect, useRef } from "react";
import LyricsDisplay from "@/components/LyricsDisplay";
import SavedLyricsSidebar from "@/components/SavedLyricsSidebar";
import LrcSearchPanel from "@/components/LrcSearchPanel";
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
      <span className="text-[11px] font-mono flex-shrink-0" style={{ color: "#666", minWidth: 36 }}>
        {fmtTime(currentTime)}
      </span>
      <div className="flex-1 relative h-1 rounded-full" style={{ background: "#2e2e2e" }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #E8634A, #EEC170)" }}
        />
        <input
          type="range" min={0} max={duration || 1} step={0.1} value={currentTime}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          style={{ height: "100%" }}
        />
      </div>
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
  const audioRef                        = useRef<HTMLAudioElement | null>(null);
  const segmentEndRef                   = useRef<number | null>(null);
  const activeLineRef                   = useRef<number | null>(null);
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
  const [credits, setCredits]           = useState<number | null>(null);
  const [inputModalOpen, setInputModalOpen] = useState(false);
  const [inputTab, setInputTab]             = useState<"paste" | "search">("paste");
  const [showWelcome, setShowWelcome]       = useState(false);

  const setActiveLine = (idx: number | null) => {
    activeLineRef.current = idx;
    setActiveLineIndex(idx);
  };

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

  const safePause = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (pendingPlayRef.current) {
      try { await pendingPlayRef.current; } catch { /* AbortError ok */ }
    }
    audio.pause();
  };

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
  const { saved, save, remove, rename, togglePin, updateTimestamps, updateParsedResult } = useSavedLyrics();

  useEffect(() => {
    fetch("/api/credits").then(r => r.json()).then(d => setCredits(d.remaining ?? null)).catch(() => {});
    if (!localStorage.getItem("jlp_welcomed")) setShowWelcome(true);
  }, []);

  const { savedGrammar, savedIds, save: saveGrammar, remove: removeGrammar } = useSavedGrammar();

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
      const left = res.headers.get("X-Credits-Remaining");
      if (left !== null) setCredits(Number(left));
      setResult(data);
      const id = save(trimmed, data);
      setCurrentSavedId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发生未知错误");
    } finally {
      setIsLoading(false);
      setInputModalOpen(false);
    }
  };

  const handleLrcLoaded = ({
    title,
    lines,
    parsedResult,
    timestamps,
  }: {
    title: string;
    lines: string[];
    parsedResult: ParsedResult[];
    timestamps: LineTimestamp[] | null;
  }) => {
    const raw = lines.join("\n");
    setLyrics(raw);
    setResult(parsedResult);
    setTimestamps(timestamps);
    setError(null);
    setAudioUrl(null);
    setActiveLine(null);
    segmentEndRef.current = null;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    const id = save(raw, parsedResult, title, timestamps ?? undefined);
    setCurrentSavedId(id);
  };

  const handleSave = () => {
    const trimmed = lyrics.trim();
    if (!trimmed) return;
    const id = save(trimmed, result ?? undefined);
    setCurrentSavedId(id);
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 2000);
  };

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

  const stopSegment = () => {
    if (segmentTimerRef.current) { clearTimeout(segmentTimerRef.current); segmentTimerRef.current = null; }
    segmentEndRef.current = null;
    const audio = audioRef.current;
    if (audio && !audio.paused) audio.pause();
    setActiveLine(null);
  };

  const scheduleStop = (endTime: number, startedAt: number) => {
    if (segmentTimerRef.current) clearTimeout(segmentTimerRef.current);
    const remaining = (endTime - startedAt) * 1000;
    segmentTimerRef.current = setTimeout(stopSegment, Math.max(0, remaining));
  };

  const seekToLine = async (lineIndex: number) => {
    const audio = audioRef.current;
    if (!audio || !timestamps) return;

    if (activeLineRef.current === lineIndex && !audio.paused) {
      if (segmentTimerRef.current) { clearTimeout(segmentTimerRef.current); segmentTimerRef.current = null; }
      await safePause();
      return;
    }

    if (activeLineRef.current === lineIndex && audio.paused && segmentEndRef.current !== null) {
      const ok = await safePlay();
      if (ok) scheduleStop(segmentEndRef.current, audio.currentTime);
      return;
    }

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

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
  };

  // ── Form content rendered inside modal ───────────────────────────────────
  const formContent = (
    <form onSubmit={handleSubmit}>
      <div className="flex gap-3 items-start">
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
              style={{ color: lyrics.length > MAX_CHARS * 0.9 ? "#E8634A" : "#333" }}
            >
              {lyrics.length}/{MAX_CHARS}
            </span>
          </div>
          <div
            className="px-4 pb-4 flex flex-wrap gap-2 items-center"
            style={{ borderTop: "1px solid #252525" }}
          >
            <span className="text-[10px] pt-3" style={{ color: "#444" }}>试试：</span>
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
      </div>

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
              <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                </svg>
                −1
              </span>
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
  );

  return (
    <div style={{ background: "#0f0f0f", minHeight: "100vh" }}>

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5"
        style={{ height: 52, background: "#0f0f0f", borderBottom: "1px solid #2e2e2e" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <span style={{ color: "#E8634A", fontSize: "18px", lineHeight: 1 }}>♪</span>
            <span className="font-semibold text-base" style={{ color: "#f0f0f0" }}>歌词解析</span>
          </div>

          {/* New song button */}
          <button
            onClick={() => setInputModalOpen(true)}
            className="text-xs px-3 py-1 rounded-lg transition-all duration-150"
            style={{ background: "transparent", border: "1px solid rgba(232,99,74,0.4)", color: "#E8634A" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(232,99,74,0.1)";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(232,99,74,0.6)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(232,99,74,0.4)";
            }}
          >
            + 新建
          </button>
        </div>

        {/* Credits indicator */}
        {credits !== null && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{
              background: credits <= 3 ? "rgba(232,99,74,0.1)" : "rgba(238,193,112,0.08)",
              border: `1px solid ${credits <= 3 ? "rgba(232,99,74,0.25)" : "rgba(238,193,112,0.2)"}`,
              color: credits <= 3 ? "#E8634A" : "#EEC170",
            }}
            title="每日免费AI语法解析积分（每行消耗1积分）"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
            </svg>
            {credits} / 20
          </div>
        )}
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
          currentId={currentSavedId ?? undefined}
          onNewSong={() => setInputModalOpen(true)}
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
        style={{ marginLeft: sidebarOpen ? 260 : 0, paddingTop: 52 }}
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

          {/* ── Results or empty state ───────────────────────────────────── */}
          {result ? (
            <>
              {/* Audio upload + player */}
              <div className="mb-5 flex flex-col gap-3">
                <div className="flex items-center gap-3">
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
                      <Spinner />正在对位歌词…
                    </span>
                  )}

                  {timestamps && !isAligning && (
                    <span className="text-[11px]" style={{ color: "#585123" }}>
                      ✓ 已对位 {timestamps.length} 行
                    </span>
                  )}
                </div>

                {audioUrl && (
                  <AudioPlayer
                    currentTime={currentTime}
                    duration={duration}
                    isPlaying={isPlaying}
                    onPlayPause={async () => {
                      if (!audioRef.current) return;
                      segmentEndRef.current = null;
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
                creditsRemaining={credits ?? undefined}
                onCreditsChange={setCredits}
                onGrammarLoaded={(idx, units, translation) => {
                  setResult(prev => {
                    if (!prev) return prev;
                    const next = prev.map((line, i) => i === idx ? {
                      ...line,
                      grammarBreakdown: units,
                      ...(translation ? { chineseTranslation: translation } : {}),
                    } : line);
                    if (currentSavedId) updateParsedResult(currentSavedId, next);
                    return next;
                  });
                }}
              />

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
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-24 gap-5">
              <p className="text-sm" style={{ color: "#444" }}>
                ← 从左侧选择已保存的歌曲，或点击「新建歌曲」开始
              </p>
              <button
                onClick={() => setInputModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #e8634a 0%, #cf4f38 100%)",
                  boxShadow: "0 3px 16px rgba(232,99,74,0.3)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 22px rgba(232,99,74,0.45)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 3px 16px rgba(232,99,74,0.3)";
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                新建歌曲
              </button>
            </div>
          )}

          <div className="h-16" />
        </main>
      </div>

      {/* ── Welcome Modal ─────────────────────────────────────────────────── */}
      {showWelcome && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.75)" }}
        >
          <div
            className="rounded-2xl w-full max-w-lg mx-4"
            style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", padding: "40px" }}
          >
            <div className="text-center mb-1" style={{ fontSize: 24, color: "#E8634A" }}>♪</div>
            <h1
              className="text-3xl font-black text-center mb-1"
              style={{
                background: "linear-gradient(100deg, #E8634A 0%, #38BCD4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              虾学日语歌
            </h1>
            <p className="text-sm tracking-widest text-center mb-8" style={{ color: "#444" }}>
              ShrimpLyricsParser
            </p>

            <div className="flex flex-col gap-3 mb-6">
              {[
                { icon: "📖", text: "粘贴日文原版歌词，自动标注假名与罗马字" },
                { icon: "🌏", text: "每行配上中文翻译，轻松理解歌词含义" },
                { icon: "✦",  text: "按需解析语法，点击展开深度学习（每日20次免费）" },
                { icon: "🎵", text: "上传人声音频，实现逐行对位与卡拉OK模式" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-start gap-3">
                  <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                  <span className="text-sm" style={{ color: "#888" }}>{text}</span>
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: "#2a2a2a", margin: "0 0 24px" }} />

            <p className="text-xs text-center mb-6" style={{ color: "#555" }}>
              建议在网上搜索歌曲名 + 歌词，找到日文原版歌词后粘贴进来
            </p>

            <button
              onClick={() => {
                localStorage.setItem("jlp_welcomed", "1");
                setShowWelcome(false);
                setInputModalOpen(true);
              }}
              className="w-full py-3 px-8 rounded-xl font-semibold text-white text-sm transition-all duration-200 active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #e8634a 0%, #cf4f38 100%)",
                boxShadow: "0 3px 16px rgba(232,99,74,0.3)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 22px rgba(232,99,74,0.45)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 3px 16px rgba(232,99,74,0.3)";
              }}
            >
              开始使用 →
            </button>

            <p className="text-xs text-center mt-3" style={{ color: "#444" }}>
              已有保存的歌曲？直接从左侧列表选择
            </p>
          </div>
        </div>
      )}

      {/* ── Input Modal ───────────────────────────────────────────────────── */}
      {inputModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setInputModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl mx-4 rounded-2xl"
            style={{ background: "#1a1a1a", border: "1px solid #2e2e2e" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 pt-5 pb-0"
            >
              <div className="flex items-center gap-2">
                <span style={{ color: "#E8634A", fontSize: 14 }}>♪</span>
                <span className="font-semibold" style={{ color: "#f0f0f0" }}>新建歌曲</span>
              </div>
              <button
                onClick={() => setInputModalOpen(false)}
                className="text-lg leading-none transition-colors duration-150"
                style={{ color: "#555" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#aaa"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#555"; }}
              >
                ×
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 px-6 pt-3 pb-0" style={{ borderBottom: "1px solid #2a2a2a" }}>
              {(["search", "paste"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setInputTab(tab)}
                  className="px-4 py-2 text-sm font-medium transition-colors duration-150 relative"
                  style={{
                    color: inputTab === tab ? "#f0f0f0" : "#555",
                    borderBottom: inputTab === tab ? "2px solid #E8634A" : "2px solid transparent",
                    marginBottom: "-1px",
                  }}
                >
                  {tab === "search" ? (
                    <span className="flex items-center gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      搜索歌曲
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      粘贴歌词
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Modal body */}
            <div className="px-6 pb-6 pt-5">
              {inputTab === "search" ? (
                <LrcSearchPanel
                  onLoaded={handleLrcLoaded}
                  onClose={() => setInputModalOpen(false)}
                />
              ) : (
                formContent
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
