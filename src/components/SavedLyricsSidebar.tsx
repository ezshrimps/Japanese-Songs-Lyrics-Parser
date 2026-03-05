"use client";

import { useState } from "react";
import { SavedLyric } from "@/types";

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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
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

// ── SidebarItem ──────────────────────────────────────────────────────────

function SidebarItem({
  item,
  onLoad,
  onDelete,
  onTogglePin,
  onRename,
}: {
  item: SavedLyric;
  onLoad: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onRename: (t: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.title);

  const commit = () => {
    const t = draft.trim();
    if (t) onRename(t);
    else setDraft(item.title);
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
            style={{
              color: "rgba(255,255,255,0.9)",
              borderBottom: "1.5px solid rgba(56,188,212,0.5)",
              paddingBottom: 2,
            }}
          />
        </div>
      ) : (
        <div
          className="flex items-center gap-2 px-3 py-2.5 cursor-pointer rounded-lg transition-colors duration-150"
          onClick={onLoad}
          style={{ color: "#ccc" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#1e1e1e"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          {/* pin dot */}
          {item.pinned && (
            <span style={{ color: "#e85d4a", flexShrink: 0 }}>
              <IconPin active />
            </span>
          )}

          {/* title */}
          <span
            className="flex-1 min-w-0 text-[13px] truncate"
            style={{ color: item.pinned ? "rgba(255,255,255,0.82)" : "#aaa" }}
          >
            {item.title}
          </span>

          {/* actions — appear on hover */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex-shrink-0">
            <button
              title={item.pinned ? "取消置顶" : "置顶"}
              onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
              className="p-1 rounded transition-colors"
              style={{ color: item.pinned ? "#e85d4a" : "rgba(255,255,255,0.3)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <IconPin active={item.pinned} />
            </button>
            <button
              title="重命名"
              onClick={(e) => { e.stopPropagation(); setDraft(item.title); setEditing(true); }}
              className="p-1 rounded transition-colors"
              style={{ color: "rgba(255,255,255,0.3)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <IconEdit />
            </button>
            <button
              title="删除"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1 rounded transition-colors"
              style={{ color: "rgba(232,93,74,0.6)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(232,93,74,0.1)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <IconTrash />
            </button>
          </div>
        </div>
      )}
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
}

export default function SavedLyricsSidebar({ saved, onLoad, onDelete, onRename, onTogglePin }: Props) {
  const pinned   = saved.filter((s) => s.pinned);
  const unpinned = saved.filter((s) => !s.pinned);

  return (
    <aside
      className="flex flex-col h-full"
      style={{
        background: "#111111",
        borderRight: "1px solid #2e2e2e",
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex-shrink-0"
        style={{ borderBottom: "1px solid #2a2a2a" }}
      >
        <div className="flex items-center justify-between">
          <h2
            className="text-[11px] font-bold tracking-[0.18em] uppercase"
            style={{ color: "#555" }}
          >
            已保存
          </h2>
          {saved.length > 0 && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: "rgba(56,188,212,0.1)", color: "#38BCD4" }}
            >
              {saved.length}
            </span>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        {saved.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="text-2xl mb-3 opacity-10">♪</div>
            <p className="text-[11px] leading-relaxed" style={{ color: "#333" }}>
              暂无保存的歌词
              <br />
              点击「保存」收藏
            </p>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <>
                <p
                  className="px-5 pt-1.5 pb-1 text-[9px] font-bold tracking-[0.18em] uppercase"
                  style={{ color: "rgba(232,93,74,0.4)" }}
                >
                  置顶
                </p>
                {pinned.map((item) => (
                  <SidebarItem
                    key={item.id}
                    item={item}
                    onLoad={() => onLoad(item)}
                    onDelete={() => onDelete(item.id)}
                    onTogglePin={() => onTogglePin(item.id)}
                    onRename={(t) => onRename(item.id, t)}
                  />
                ))}
                {unpinned.length > 0 && (
                  <div
                    className="mx-5 my-2"
                    style={{ height: 1, background: "#222" }}
                  />
                )}
              </>
            )}
            {unpinned.map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                onLoad={() => onLoad(item)}
                onDelete={() => onDelete(item.id)}
                onTogglePin={() => onTogglePin(item.id)}
                onRename={(t) => onRename(item.id, t)}
              />
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
