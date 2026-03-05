import { ParsedResult } from "@/types";
import LyricLineCard from "./LyricLineCard";

export default function LyricsDisplay({ data }: { data: ParsedResult[] }) {
  return (
    <div>
      {/* Result header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1" style={{ background: "#2e2e2e" }} />
        <span
          className="text-[10px] font-semibold tracking-[0.18em] uppercase"
          style={{ color: "#444" }}
        >
          解析结果 · {data.length} 行
        </span>
        <div className="h-px flex-1" style={{ background: "#2e2e2e" }} />
      </div>

      <div className="flex flex-col gap-4">
        {data.map((line, i) => (
          <LyricLineCard key={i} line={line} index={i} />
        ))}
      </div>
    </div>
  );
}
