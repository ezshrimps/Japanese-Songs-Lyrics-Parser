import { GrammarUnit } from "@/types";

// ── Part-of-speech colour map ─────────────────────────────────────────────
const POS_MAP: Array<[string, string]> = [
  ["动词", "#EEC170"],
  ["名词", "#F58549"],
  ["形容", "#F2A65A"],
  ["副词", "#585123"],
  ["数词", "#772F1A"],
  ["助词", "#F2A65A"],
  ["接续", "#EEC170"],
  ["感叹", "#F58549"],
];
const DEFAULT_COLOR = "#EEC170";

function posColor(pos: string): string {
  for (const [key, color] of POS_MAP) {
    if (pos.includes(key)) return color;
  }
  return DEFAULT_COLOR;
}

export default function GrammarCard({ unit }: { unit: GrammarUnit }) {
  const color = posColor(unit.partOfSpeech);

  return (
    <div
      className="grammar-card flex overflow-hidden rounded-xl"
      style={{
        background: "#141414",
        border: "1px solid #272727",
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div className="flex flex-col gap-1.5 p-3 flex-1 min-w-0">
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
