"use client";

import { useState } from "react";
import { SavedLyric, SavedGrammar } from "@/types";

// ── POS colour (mirrors GrammarCard) ──────────────────────────────────────
const POS_MAP: Array<[string, string]> = [
  ["动词", "#4A90E8"], ["名词", "#E8634A"], ["形容", "#9B59B6"],
  ["副词", "#27AE60"], ["数词", "#E67E22"], ["助词", "#38BCD4"],
  ["接续", "#38BCD4"], ["感叹", "#E8634A"],
];
function posColor(pos: string) {
  for (const [k, c] of POS_MAP) if (pos.includes(k)) return c;
  return "#EEC170";
}

function exportGrammarCSV(items: SavedGrammar[]) {
  const header = ["词", "读音", "罗马字", "词性", "解释", "出处"];
  const escape = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const rows = items.map((i) => [
    i.unit.text, i.unit.hiragana, i.unit.romaji,
    i.unit.partOfSpeech, i.unit.explanation, i.sourceLine,
  ].map(escape).join(","));
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "grammar.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── Icons ─────────────────────────────────────────────────────────────────
function IconPin({ active }: { active?: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

// ── SidebarItem (lyrics) ──────────────────────────────────────────────────
function SidebarItem({ item, onLoad, onDelete, onTogglePin, onRename }: {
  item: SavedLyric;
  onLoad: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onRename: (t: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(item.title);

  const commit = () => {
    const t = draft.trim();
    if (t) onRename(t); else setDraft(item.title);
    setEditing(false);
  };

  return (
    <div
      className="group relative mx-2 mb-0.5"
      style={{
        borderRadius: 8,
        background: item.pinned ? "rgba(232,93,74,0.06)" : "transparent",
        borderLeft: item.pinned ? "2px solid #e85d4a" : "2px solid transparent",
      }}
    >
      {editing ? (
        <div className="flex items-center px-3 py-2.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") { setDraft(item.title); setEditing(false); }
            }}
            autoFocus
            className="flex-1 min-w-0 text-sm bg-transparent outline-none"
            style={{ color: "rgba(255,255,255,0.9)", borderBottom: "1.5px solid rgba(56,188,212,0.5)", paddingBottom: 2 }}
          />
        </div>
      ) : (
        <div
          className="flex items-center gap-2 px-3 py-2.5 cursor-pointer rounded-lg transition-colors duration-150"
          onClick={onLoad}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#1e1e1e"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          {item.pinned && <span style={{ color: "#e85d4a", flexShrink: 0 }}><IconPin active /></span>}
          <span className="flex-1 min-w-0 text-[13px] truncate" style={{ color: item.pinned ? "rgba(255,255,255,0.82)" : "#aaa" }}>
            {item.title}
          </span>
          {item.timestamps && item.timestamps.length > 0 && (
            <span title="已保存对位时间轴" style={{ color: "#EEC170", fontSize: 10, flexShrink: 0, opacity: 0.7 }}>♪</span>
          )}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex-shrink-0">
            <button title={item.pinned ? "取消置顶" : "置顶"} onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
              className="p-1 rounded transition-colors" style={{ color: item.pinned ? "#e85d4a" : "rgba(255,255,255,0.3)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <IconPin active={item.pinned} />
            </button>
            <button title="重命名" onClick={(e) => { e.stopPropagation(); setDraft(item.title); setEditing(true); }}
              className="p-1 rounded transition-colors" style={{ color: "rgba(255,255,255,0.3)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <IconEdit />
            </button>
            <button title="删除" onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1 rounded transition-colors" style={{ color: "rgba(232,93,74,0.6)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(232,93,74,0.1)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <IconTrash />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── GrammarItem ───────────────────────────────────────────────────────────
function GrammarItem({ item, onDelete }: { item: SavedGrammar; onDelete: () => void }) {
  const color = posColor(item.unit.partOfSpeech);
  return (
    <div
      className="group relative mx-2 mb-1 rounded-lg overflow-hidden"
      style={{ borderLeft: `3px solid ${color}`, background: "#161616" }}
    >
      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-base font-bold" style={{ color: "#f0f0f0" }}>{item.unit.text}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: `${color}22`, color }}>
                {item.unit.partOfSpeech}
              </span>
            </div>
            <p className="text-[11px]" style={{ color: "#555" }}>
              {item.unit.hiragana}<span className="mx-1 opacity-40">·</span>{item.unit.romaji}
            </p>
            <p className="text-[11px] mt-1 truncate" style={{ color: "#444" }}>
              {item.sourceLine}
            </p>
          </div>
          <button
            title="删除"
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all flex-shrink-0"
            style={{ color: "rgba(232,93,74,0.6)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(232,93,74,0.1)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <IconTrash />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────
interface Props {
  saved: SavedLyric[];
  onLoad: (item: SavedLyric) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (id: string) => void;
  savedGrammar: SavedGrammar[];
  onDeleteGrammar: (id: string) => void;
  onToggleSidebar: () => void;
}

export default function SavedLyricsSidebar({
  saved, onLoad, onDelete, onRename, onTogglePin,
  savedGrammar, onDeleteGrammar, onToggleSidebar,
}: Props) {
  const [activeTab, setActiveTab] = useState<"lyrics" | "grammar">("lyrics");

  const pinned   = saved.filter((s) => s.pinned);
  const unpinned = saved.filter((s) => !s.pinned);

  return (
    <aside className="flex flex-col h-full" style={{ background: "#111111", borderRight: "1px solid #2e2e2e" }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ color: "#555" }}>
            收藏
          </h2>
          <button
            onClick={onToggleSidebar}
            title="收起侧边栏"
            className="flex items-center justify-center rounded-md transition-all duration-150"
            style={{ width: 24, height: 24, color: "#444" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#888"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#444"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <polyline points="15 8 11 12 15 16" />
            </svg>
          </button>
        </div>
        {/* Tabs */}
        <div className="flex gap-1" style={{ borderBottom: "1px solid #2a2a2a", paddingBottom: 0 }}>
          {(["lyrics", "grammar"] as const).map((tab) => {
            const label = tab === "lyrics" ? "歌曲列表" : "语法列表";
            const count = tab === "lyrics" ? saved.length : savedGrammar.length;
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium transition-colors duration-150 relative"
                style={{ color: active ? "#f0f0f0" : "#555" }}
              >
                {label}
                {count > 0 && (
                  <span className="text-[10px] px-1 rounded" style={{ background: active ? "rgba(238,193,112,0.15)" : "rgba(255,255,255,0.06)", color: active ? "#EEC170" : "#444" }}>
                    {count}
                  </span>
                )}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "#EEC170" }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        {activeTab === "lyrics" ? (
          saved.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <div className="text-2xl mb-3 opacity-10">♪</div>
              <p className="text-[11px] leading-relaxed" style={{ color: "#333" }}>暂无保存的歌词</p>
            </div>
          ) : (
            <>
              {pinned.length > 0 && (
                <>
                  <p className="px-5 pt-1.5 pb-1 text-[9px] font-bold tracking-[0.18em] uppercase" style={{ color: "rgba(232,93,74,0.4)" }}>置顶</p>
                  {pinned.map((item) => (
                    <SidebarItem key={item.id} item={item}
                      onLoad={() => onLoad(item)} onDelete={() => onDelete(item.id)}
                      onTogglePin={() => onTogglePin(item.id)} onRename={(t) => onRename(item.id, t)} />
                  ))}
                  {unpinned.length > 0 && <div className="mx-5 my-2" style={{ height: 1, background: "#222" }} />}
                </>
              )}
              {unpinned.map((item) => (
                <SidebarItem key={item.id} item={item}
                  onLoad={() => onLoad(item)} onDelete={() => onDelete(item.id)}
                  onTogglePin={() => onTogglePin(item.id)} onRename={(t) => onRename(item.id, t)} />
              ))}
            </>
          )
        ) : (
          savedGrammar.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <div className="text-2xl mb-3 opacity-10">★</div>
              <p className="text-[11px] leading-relaxed" style={{ color: "#333" }}>点击语法卡片上的星标收藏</p>
            </div>
          ) : (
            <>
              {/* Export button */}
              <div className="px-3 pb-2 pt-1">
                <button
                  onClick={() => exportGrammarCSV(savedGrammar)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150"
                  style={{ background: "rgba(56,188,212,0.08)", border: "1px solid rgba(56,188,212,0.2)", color: "#38BCD4" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(56,188,212,0.15)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(56,188,212,0.08)"; }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  导出 CSV ({savedGrammar.length} 条)
                </button>
              </div>
              {savedGrammar.map((item) => (
                <GrammarItem key={item.id} item={item} onDelete={() => onDeleteGrammar(item.id)} />
              ))}
            </>
          )
        )}
      </div>
    </aside>
  );
}
