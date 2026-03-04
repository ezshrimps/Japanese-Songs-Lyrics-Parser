import { GrammarUnit } from "@/types";

// ── Part-of-speech colour map ─────────────────────────────────────────────
const POS_MAP: Array<[string, { accent: string; bg: string }]> = [
  ["动词",   { accent: "#4A90E8", bg: "rgba(74,144,232,0.09)"  }],
  ["名词",   { accent: "#E8634A", bg: "rgba(232,99,74,0.09)"   }],
  ["形容",   { accent: "#9B59B6", bg: "rgba(155,89,182,0.09)"  }],
  ["副词",   { accent: "#27AE60", bg: "rgba(39,174,96,0.09)"   }],
  ["数词",   { accent: "#E67E22", bg: "rgba(230,126,34,0.09)"  }],
  ["助词",   { accent: "#38BCD4", bg: "rgba(56,188,212,0.09)"  }],
  ["感叹",   { accent: "#E8634A", bg: "rgba(232,99,74,0.09)"   }],
];
const DEFAULT_POS = { accent: "#94A3B8", bg: "rgba(148,163,184,0.09)" };

function posStyle(pos: string) {
  for (const [key, style] of POS_MAP) {
    if (pos.includes(key)) return style;
  }
  return DEFAULT_POS;
}

export default function GrammarCard({ unit }: { unit: GrammarUnit }) {
  const { accent, bg } = posStyle(unit.partOfSpeech);

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: "#ffffff",
        boxShadow: "0 2px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05)",
        border: "1px solid rgba(0,0,0,0.05)",
      }}
    >
      {/* Coloured top stripe */}
      <div style={{ height: 3, background: accent, opacity: 0.7 }} />

      <div className="p-4 flex flex-col gap-2 flex-1">
        {/* POS badge */}
        <span
          className="self-start text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: bg, color: accent }}
        >
          {unit.partOfSpeech}
        </span>

        {/* Word */}
        <p
          className="text-2xl font-black leading-tight"
          style={{ color: "#1e293b" }}
        >
          {unit.text}
        </p>

        {/* Reading */}
        <p className="text-xs font-medium" style={{ color: accent, opacity: 0.85 }}>
          {unit.hiragana}
          <span className="mx-1 opacity-40">·</span>
          {unit.romaji}
        </p>

        {/* Divider */}
        <div className="h-px" style={{ background: "rgba(0,0,0,0.06)" }} />

        {/* Explanation */}
        <p className="text-xs leading-relaxed flex-1" style={{ color: "#475569" }}>
          {unit.explanation}
        </p>
      </div>
    </div>
  );
}
