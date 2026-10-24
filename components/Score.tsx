import { fmtNum } from "@/lib/format";

/**
 * Scoreboard digits. Rendered as two flex items inside the RTL flow so the home score always sits on the same side as the
 * home team (right), instead of relying on bidi resolution of "2-1" (which would visually flip it). Western digits only.
 */
export function Score({ home, away, size = "md", muted = false }: { home: number | null; away: number | null; size?: "sm" | "md" | "lg"; muted?: boolean }) {
  const cls = size === "lg" ? "text-4xl gap-3" : size === "md" ? "text-xl gap-2" : "text-base gap-1.5";
  if (home === null || away === null) return <span className={`inline-flex items-center font-bold text-muted ${cls}`}>–</span>;
  return (
    <span className={`inline-flex items-center font-extrabold ${cls} ${muted ? "text-muted" : ""}`} aria-label={`${fmtNum(home)} ${fmtNum(away)}`}>
      <span className="num">{fmtNum(home)}</span>
      <span aria-hidden className="text-muted">:</span>
      <span className="num">{fmtNum(away)}</span>
    </span>
  );
}
