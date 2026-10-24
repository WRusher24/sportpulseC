import { fmtNum, fmtTime } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/he";
import { isLiveStatus } from "@/lib/data/live-sim";
import type { MatchStatus } from "@/lib/types";

export function StatusBadge({ status, minute, kickoff }: { status: MatchStatus; minute: number | null; kickoff: string }) {
  if (isLiveStatus(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-live">
        <span className="h-2 w-2 animate-pulseDot rounded-full bg-live" aria-hidden />
        <span>{STATUS_LABEL[status]}</span>
        {minute !== null && status !== "half_time" && <span className="num">{fmtNum(minute)}&apos;</span>}
      </span>
    );
  }
  if (status === "scheduled") return <span className="num text-xs text-muted">{fmtTime(kickoff)}</span>;
  return <span className="text-xs text-muted">{STATUS_LABEL[status]}</span>;
}
