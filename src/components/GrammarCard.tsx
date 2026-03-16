import { GrammarUnit } from "@/types";

// ── Part-of-speech colour map ─────────────────────────────────────────────
const POS_MAP: Array<[string, string]> = [
  ["动词", "#4A90E8"],
  ["名词", "#E8634A"],
  ["形容", "#9B59B6"],
  ["副词", "#27AE60"],
  ["数词", "#E67E22"],
  ["助词", "#38BCD4"],
  ["接续", "#38BCD4"],
  ["感叹", "#E8634A"],
];
const DEFAULT_COLOR = "#EEC170";

function posColor(pos: string): string {
  for (const [key, color] of POS_MAP) {
    if (pos.includes(key)) return color;
  }
  return DEFAULT_COLOR;
}

interface Props {
  unit: GrammarUnit;
  onHoverIn: () => void;
  onHoverOut: () => void;
  onSave: () => void;
  isSaved: boolean;
}

export default function GrammarCard({ unit, onHoverIn, onHoverOut, onSave, isSaved }: Props) {
  const color = posColor(unit.partOfSpeech);

  return (
    <div
      className="grammar-card relative flex overflow-hidden rounded-xl"
      style={{
        background: "#141414",
        border: "1px solid #272727",
        borderLeft: `3px solid ${color}`,
      }}
      onMouseEnter={onHoverIn}
      onMouseLeave={onHoverOut}
    >
      {/* Star button */}
      <button
        onClick={(e) => { e.stopPropagation(); onSave(); }}
        title={isSaved ? "已收藏" : "收藏此语法"}
        className="absolute top-1.5 right-1.5 transition-colors duration-150"
        style={{ color: isSaved ? "#EEC170" : "#333", lineHeight: 1 }}
        onMouseEnter={(e) => {
          if (!isSaved) (e.currentTarget as HTMLElement).style.color = "#888";
        }}
        onMouseLeave={(e) => {
          if (!isSaved) (e.currentTarget as HTMLElement).style.color = "#333";
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </button>

      <div className="flex flex-col gap-1.5 p-3 pr-6 flex-1 min-w-0">
        {/* POS badge */}
        <span
          className="self-start text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{ background: `${color}22`, color }}
        >
          {unit.partOfSpeech}
        </span>

        {/* Word */}
        <p className="text-xl font-bold leading-tight" style={{ color: "#f0f0f0" }}>
          {unit.text}
        </p>

        {/* Reading */}
        <p className="text-[11px]" style={{ color: "#555" }}>
          {unit.hiragana}
          <span className="mx-1 opacity-50">·</span>
          <span style={{ color: "#444" }}>{unit.romaji}</span>
        </p>

        {/* Divider */}
        <div style={{ height: 1, background: "#222" }} />

        {/* Explanation */}
        <p className="text-xs leading-relaxed" style={{ color: "#888" }}>
          {unit.explanation}
        </p>
      </div>
    </div>
  );
}
