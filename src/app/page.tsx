"use client";

import { useState, useEffect, useRef } from "react";
import LyricsDisplay from "@/components/LyricsDisplay";
import SavedLyricsSidebar from "@/components/SavedLyricsSidebar";
import { useSavedLyrics } from "@/hooks/useSavedLyrics";
import { useSavedGrammar } from "@/hooks/useSavedGrammar";
import { ParsedResult } from "@/types";

const EXAMPLES = [
  "事が一つ二つ浮いているけど",
  "桜の花びらたちが風に舞いあがる",
  "会いたくて会いたくて震える",
  "夜に駆けるのはやめてよ",
];

const MAX_CHARS = 5000;

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

  // Progress bar animation
  useEffect(() => {
    if (isLoading) {
      setProgress(0);
      const startTime = Date.now();
      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        // Exponential ease-out: fast start, asymptotes toward 90%
        setProgress(90 * (1 - Math.exp(-elapsed / 9000)));
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

  const { saved, save, remove, rename, togglePin } = useSavedLyrics();
  const { savedGrammar, savedIds, save: saveGrammar, remove: removeGrammar } = useSavedGrammar();

  // Parse
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = lyrics.trim();
    if (!trimmed || isLoading) return;
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
      save(trimmed, data);
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
    save(trimmed, result ?? undefined);
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 2000);
  };

  // Load from sidebar
  const handleLoad = (item: import("@/types").SavedLyric) => {
    setLyrics(item.content);
    setResult(item.parsedResult ?? null);
    setError(null);
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
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <span style={{ color: "#E8634A", fontSize: "18px", lineHeight: 1 }}>♪</span>
          <span className="font-semibold text-base" style={{ color: "#f0f0f0" }}>
            歌词解析
          </span>
        </div>

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          title={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
          className="flex items-center justify-center rounded-lg transition-all duration-150"
          style={{
            width: 32,
            height: 32,
            background: sidebarOpen ? "rgba(56,188,212,0.1)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${sidebarOpen ? "rgba(56,188,212,0.25)" : "#2e2e2e"}`,
            color: sidebarOpen ? "#38BCD4" : "rgba(255,255,255,0.35)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(56,188,212,0.15)";
            (e.currentTarget as HTMLElement).style.color = "#38BCD4";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = sidebarOpen ? "rgba(56,188,212,0.1)" : "rgba(255,255,255,0.04)";
            (e.currentTarget as HTMLElement).style.color = sidebarOpen ? "#38BCD4" : "rgba(255,255,255,0.35)";
          }}
        >
          <IconPanel open={sidebarOpen} />
        </button>
      </header>

      {/* ── Sidebar (fixed, slides with translateX) ───────────────────────── */}
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
        />
      </div>

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
              className="text-3xl font-black tracking-tight leading-none mb-1"
              style={{
                background: "linear-gradient(100deg, #E8634A 0%, #f0956c 45%, #38BCD4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              歌詞解析
            </h1>
            <p className="text-[10px] tracking-[0.22em] uppercase" style={{ color: "#444" }}>
              Japanese Lyrics Parser
            </p>
          </div>

          {/* ── Input card ──────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="mb-8">
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "#1a1a1a", border: "1px solid #2e2e2e" }}
            >
              {/* Label */}
              <div className="px-4 pt-4 pb-1">
                <span
                  className="text-[10px] font-bold tracking-widest uppercase"
                  style={{ color: "#38BCD4", opacity: 0.6 }}
                >
                  歌詞入力
                </span>
              </div>

              {/* Textarea with char counter */}
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
                {/* Char counter */}
                <span
                  className="absolute bottom-2 right-3 text-[10px] font-mono pointer-events-none"
                  style={{
                    color: lyrics.length > MAX_CHARS * 0.9 ? "#E8634A" : "#333",
                  }}
                >
                  {lyrics.length}/{MAX_CHARS}
                </span>
              </div>

              {/* Example chips */}
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

            {/* Buttons row — ghost save (left) · coral parse (right) */}
            <div className="flex items-center justify-between gap-3 mt-3">
              {/* Save */}
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

              {/* Parse */}
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
                  <>
                    <Spinner />
                    解析中……
                  </>
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

            {/* ── Progress bar ────────────────────────────────────────── */}
            {progress > 0 && (
              <div className="mt-4 animate-fade-in">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[11px]" style={{ color: "#666" }}>
                    {progress < 30
                      ? "正在分析歌词…"
                      : progress < 65
                      ? "正在解析语法…"
                      : progress < 100
                      ? "即将完成…"
                      : "解析完成 ✓"}
                  </span>
                  <span className="text-[11px] font-mono" style={{ color: "#f0956c" }}>
                    {Math.round(progress)}%
                  </span>
                </div>
                <div
                  className="rounded-full overflow-hidden"
                  style={{ height: 3, background: "#1e1e1e" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${progress}%`,
                      background: "linear-gradient(90deg, #772F1A, #E8634A, #f0956c, #EEC170)",
                      boxShadow: "0 0 6px rgba(240,149,108,0.45)",
                      transition: progress === 100
                        ? "width 0.3s ease"
                        : "width 0.12s linear",
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
          {result && <LyricsDisplay data={result} savedIds={savedIds} onSaveGrammar={saveGrammar} />}

          <div className="h-16" />
        </main>
      </div>
    </div>
  );
}
