import { fmtNum } from "@/lib/format";
import { EVENT_LABEL } from "@/lib/he";
import type { EventDTO } from "@/lib/types";

function icon(e: EventDTO): string {
  if (e.eventType === "goal") return "⚽";
  if (e.eventType === "substitution") return "🔁";
  if (e.eventType === "var") return "📺";
  return e.description?.includes("אדום") ? "🟥" : "🟨";
}

export function EventsTimeline({ events, homeTeamId }: { events: EventDTO[]; homeTeamId: string }) {
  if (events.length === 0) return <p className="card text-sm text-muted">אין עדיין אירועים במשחק זה. אירועי משחק (שערים, כרטיסים, חילופים ו-VAR) זמינים בכדורגל.</p>;
  const ordered = [...events].sort((a, b) => b.minute - a.minute);
  return (
    <ol className="space-y-2" aria-label="ציר זמן אירועים">
      {ordered.map((e) => {
        const home = e.teamId === homeTeamId;
        return (
          <li key={e.id} className={`flex items-center gap-3 ${home ? "" : "flex-row-reverse"}`}>
            <div className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line/50 bg-surface p-2.5 ${home ? "" : "flex-row-reverse text-end"}`}>
              <span aria-hidden className="text-lg">{icon(e)}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{e.playerName}</p>
                <p className="truncate text-xs text-muted">{e.description ?? EVENT_LABEL[e.eventType]}</p>
              </div>
            </div>
            <span className="grid h-9 w-11 shrink-0 place-items-center rounded-lg bg-surface2 text-sm font-bold"><span className="num">{fmtNum(e.minute)}&apos;</span></span>
            <span className="flex-1" aria-hidden />
          </li>
        );
      })}
    </ol>
  );
}
