"use client";

import { useState } from "react";
import LyricsDisplay from "@/components/LyricsDisplay";
import SavedLyricsSidebar from "@/components/SavedLyricsSidebar";
import { useSavedLyrics } from "@/hooks/useSavedLyrics";
import { ParsedResult } from "@/types";

const EXAMPLES = [
  "事が一つ二つ浮いているけど",
  "桜の花びらたちが風に舞いあがる",
  "会いたくて会いたくて震える",
  "夜に駆けるのはやめてよ",
];

// ── Spinner icon ──────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Sidebar toggle icon ───────────────────────────────────────────────────
function IconPanelLeft({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
  const [lyrics, setLyrics]           = useState("");
  const [result, setResult]           = useState<ParsedResult[] | null>(null);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [sidebarOpen, setSidebarOpen]  = useState(true);
  const [inputFocused, setInputFocused] = useState(false);

  const { saved, save, remove, rename, togglePin } = useSavedLyrics();

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
    save(trimmed);
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 2000);
  };

  // Load from sidebar
  const handleLoad = (content: string) => {
    setLyrics(content);
    setResult(null);
    setError(null);
  };

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        // Aurora: faint coral glow top-right, faint teal glow bottom-left
        background: `
          radial-gradient(ellipse 65% 45% at 92% 4%,  rgba(232,99,74,0.14) 0%, transparent 55%),
          radial-gradient(ellipse 55% 40% at 6%  96%,  rgba(56,188,212,0.14) 0%, transparent 55%),
          radial-gradient(ellipse 40% 30% at 50% 50%,  rgba(100,60,180,0.05) 0%, transparent 60%),
          #07090e
        `,
      }}
    >
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out"
        style={{ width: sidebarOpen ? 240 : 0 }}
      >
        <div style={{ width: 240, height: "100%" }}>
          <SavedLyricsSidebar
            saved={saved}
            onLoad={handleLoad}
            onDelete={remove}
            onRename={rename}
            onTogglePin={togglePin}
          />
        </div>
      </div>

      {/* ── Main scroll area ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <main className="max-w-2xl mx-auto px-6 py-10">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <header className="flex items-start justify-between mb-10">
            <div>
              <h1
                className="text-4xl font-black tracking-tight leading-none mb-1.5"
                style={{
                  background: "linear-gradient(100deg, #E8634A 0%, #f0956c 40%, #38BCD4 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                歌詞解析
              </h1>
              <p
                className="text-xs tracking-[0.22em] font-medium uppercase"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                Japanese Lyrics Parser
              </p>
            </div>

            {/* Sidebar toggle */}
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              title={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
              className="mt-1 p-2 rounded-xl transition-colors duration-150"
              style={{
                color: sidebarOpen ? "rgba(56,188,212,0.8)" : "rgba(255,255,255,0.35)",
                background: sidebarOpen ? "rgba(56,188,212,0.1)" : "rgba(255,255,255,0.06)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "rgba(56,188,212,0.14)";
                (e.currentTarget as HTMLElement).style.color = "rgba(56,188,212,0.9)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = sidebarOpen ? "rgba(56,188,212,0.1)" : "rgba(255,255,255,0.06)";
                (e.currentTarget as HTMLElement).style.color = sidebarOpen ? "rgba(56,188,212,0.8)" : "rgba(255,255,255,0.35)";
              }}
            >
              <IconPanelLeft open={sidebarOpen} />
            </button>
          </header>

          {/* ── Input card ──────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="mb-8">
            <div
              className="rounded-2xl overflow-hidden transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: `1.5px solid ${inputFocused ? "rgba(56,188,212,0.45)" : "rgba(255,255,255,0.09)"}`,
                boxShadow: inputFocused
                  ? "0 0 0 3px rgba(56,188,212,0.1), 0 8px 32px rgba(0,0,0,0.25)"
                  : "0 4px 24px rgba(0,0,0,0.2)",
              }}
            >
              {/* Label */}
              <div
                className="px-5 pt-4 pb-1 flex items-center gap-2"
              >
                <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "rgba(56,188,212,0.55)" }}>
                  歌詞入力
                </span>
              </div>

              {/* Textarea */}
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder={"輸入日語歌詞……支持多行整首歌曲\n\n例：事が一つ二つ浮いているけど\n    回り出したあの子と僕の未来が止まり"}
                className="w-full bg-transparent text-white resize-none outline-none px-5 pb-4"
                style={{
                  fontSize: "1.05rem",
                  lineHeight: "1.75",
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

              {/* Example chips */}
              <div
                className="px-5 pb-4 flex flex-wrap gap-2 items-center"
                style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span
                  className="text-xs"
                  style={{ color: "rgba(255,255,255,0.25)", paddingTop: "0.75rem" }}
                >
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
                      background: "rgba(56,188,212,0.08)",
                      border: "1px solid rgba(56,188,212,0.18)",
                      color: "rgba(255,255,255,0.45)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(56,188,212,0.18)";
                      (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(56,188,212,0.4)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(56,188,212,0.08)";
                      (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(56,188,212,0.18)";
                    }}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3 mt-4">
              {/* Parse */}
              <button
                type="submit"
                disabled={isLoading || !lyrics.trim()}
                className="flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-bold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #e8634a 0%, #cf4f38 100%)",
                  boxShadow: isLoading || !lyrics.trim()
                    ? "none"
                    : "0 4px 20px rgba(232,99,74,0.35)",
                  fontSize: "0.95rem",
                  letterSpacing: "0.02em",
                }}
                onMouseEnter={(e) => {
                  if (!isLoading && lyrics.trim())
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 28px rgba(232,99,74,0.5)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(232,99,74,0.35)";
                }}
              >
                {isLoading ? (
                  <>
                    <Spinner />
                    <span>解析中……约 20–40 秒</span>
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    解析歌词
                  </>
                )}
              </button>

              {/* Save */}
              <button
                type="button"
                onClick={handleSave}
                disabled={!lyrics.trim()}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl font-semibold transition-all duration-200 disabled:opacity-35 disabled:cursor-not-allowed active:scale-[0.98]"
                style={{
                  background: saveFeedback
                    ? "rgba(56,188,212,0.18)"
                    : "rgba(56,188,212,0.08)",
                  border: `1.5px solid ${saveFeedback ? "rgba(56,188,212,0.6)" : "rgba(56,188,212,0.3)"}`,
                  color: saveFeedback ? "#38BCD4" : "rgba(56,188,212,0.75)",
                  fontSize: "0.9rem",
                }}
                onMouseEnter={(e) => {
                  if (lyrics.trim() && !saveFeedback) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(56,188,212,0.15)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(56,188,212,0.5)";
                    (e.currentTarget as HTMLElement).style.color = "#38BCD4";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!saveFeedback) {
                    (e.currentTarget as HTMLElement).style.background = "rgba(56,188,212,0.08)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(56,188,212,0.3)";
                    (e.currentTarget as HTMLElement).style.color = "rgba(56,188,212,0.75)";
                  }
                }}
              >
                {saveFeedback ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    已保存
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    保存
                  </>
                )}
              </button>
            </div>

            {/* Hint */}
            <p
              className="text-center text-xs mt-3"
              style={{ color: "rgba(255,255,255,0.18)" }}
            >
              ⌘ + Enter 快速解析
            </p>
          </form>

          {/* ── Error ───────────────────────────────────────────────────── */}
          {error && (
            <div
              className="rounded-2xl px-5 py-4 mb-6 flex items-center gap-3 animate-fade-in"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#fca5a5",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* ── Results ─────────────────────────────────────────────────── */}
          {result && <LyricsDisplay data={result} />}

          {/* Bottom padding */}
          <div className="h-16" />
        </main>
      </div>
    </div>
  );
}
