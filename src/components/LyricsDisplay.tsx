import { ParsedResult, GrammarUnit, LineTimestamp } from "@/types";
import LyricLineCard from "./LyricLineCard";

interface Props {
  data: ParsedResult[];
  savedIds: Set<string>;
  onSaveGrammar: (unit: GrammarUnit, sourceLine: string) => void;
  timestamps?: LineTimestamp[];
  activeLineIndex?: number | null;
  isPlaying?: boolean;
  onPlayLine?: (lineIndex: number) => void;
}

export default function LyricsDisplay({
  data, savedIds, onSaveGrammar,
  timestamps, activeLineIndex, isPlaying, onPlayLine,
}: Props) {
  const tsMap = new Map(timestamps?.map(t => [t.lineIndex, t]));

  return (
    <div>
      {/* Result header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1" style={{ background: "#2e2e2e" }} />
        <span className="text-[10px] font-semibold tracking-[0.18em] uppercase" style={{ color: "#444" }}>
          解析结果 · {data.length} 行
        </span>
        <div className="h-px flex-1" style={{ background: "#2e2e2e" }} />
      </div>

      <div className="flex flex-col gap-4">
        {data.map((line, i) => (
          <LyricLineCard
            key={i}
            line={line}
            index={i}
            savedIds={savedIds}
            onSaveGrammar={onSaveGrammar}
            timestamp={tsMap.get(i)}
            isActive={activeLineIndex === i}
            isLinePlaying={activeLineIndex === i && !!isPlaying}
            onPlay={onPlayLine ? () => onPlayLine(i) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
