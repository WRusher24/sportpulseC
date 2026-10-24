import { fmtNum } from "@/lib/format";

/** "Fan Social Vibe Check" bar: optimistic vs worried share. */
export function VibeBar({ optimistic, worried, votes }: { optimistic: number; worried: number; votes?: number }) {
  return (
    <div className="w-full" role="img" aria-label={`${fmtNum(optimistic)} אחוז אופטימיים, ${fmtNum(worried)} אחוז מודאגים`}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface2">
        <div className="h-full bg-good transition-all duration-500" style={{ width: `${optimistic}%` }} />
        <div className="h-full bg-hot transition-all duration-500" style={{ width: `${worried}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold text-good">
          <span className="num">{fmtNum(optimistic)}%</span> אופטימיים
        </span>
        {votes ? <span className="text-muted">כולל <span className="num">{fmtNum(votes)}</span> הצבעות אוהדים</span> : null}
        <span className="font-semibold text-hot">
          <span className="num">{fmtNum(worried)}%</span> מודאגים
        </span>
      </div>
    </div>
  );
}
