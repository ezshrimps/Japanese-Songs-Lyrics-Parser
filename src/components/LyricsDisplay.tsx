import { ParsedResult } from "@/types";
import LyricLineCard from "./LyricLineCard";

export default function LyricsDisplay({ data }: { data: ParsedResult[] }) {
  return (
    <div>
      {/* Result header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.1)" }} />
        <span
          className="text-xs font-semibold tracking-[0.15em] uppercase"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          解析结果 · {data.length} 行
        </span>
        <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.1)" }} />
      </div>

      <div className="flex flex-col gap-4">
        {data.map((line, i) => (
          <LyricLineCard key={i} line={line} index={i} />
        ))}
      </div>
    </div>
  );
}
