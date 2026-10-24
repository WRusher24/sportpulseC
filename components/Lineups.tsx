import { fmtNum } from "@/lib/format";
import type { LineUps, LineupPlayer } from "@/lib/types";

type Side = "home" | "away";

function Column({ title, formation, players, side, grades, fan }: { title: string; formation: string | null; players: LineupPlayer[]; side: Side; grades?: Record<string, number>; fan: Map<string, number> }) {
  const row = (p: LineupPlayer) => {
    const g = grades?.[`${side}:${p.name}`];
    const f = fan.get(p.name);
    return (
      <li key={p.name} className="flex items-center gap-2 border-t border-line/40 py-1.5 first:border-t-0">
        <span className="num grid h-6 w-7 shrink-0 place-items-center rounded bg-surface2 text-xs font-bold">{p.number !== null ? fmtNum(p.number) : "–"}</span>
        <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
        {f !== undefined && <span className="num text-xs font-bold text-accent" title="ציון האוהדים">{fmtNum(f, 1)}</span>}
        {g !== undefined && <span className="num text-xs text-muted" title="ציון התקשורת">{fmtNum(g, 1)}</span>}
      </li>
    );
  };
  const starters = players.filter((p) => p.starter);
  const subs = players.filter((p) => !p.starter);
  return (
    <div className="card !p-3">
      <h3 className="mb-1 font-bold">{title}</h3>
      {formation && <p className="mb-2 text-xs text-muted">מערך: <span className="num">{formation}</span></p>}
      <ul>{starters.map(row)}</ul>
      {subs.length > 0 && (
        <>
          <p className="mt-3 text-xs font-semibold text-muted">ספסל</p>
          <ul>{subs.map(row)}</ul>
        </>
      )}
    </div>
  );
}

export function Lineups({ lineUps, homeName, awayName, fanAverages }: { lineUps: LineUps | null; homeName: string; awayName: string; fanAverages: Map<string, number> }) {
  if (!lineUps) return <p className="card text-sm text-muted">ההרכבים טרם פורסמו.</p>;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Column title={homeName} formation={lineUps.home.formation} players={lineUps.home.players} side="home" grades={lineUps.mediaGrades} fan={fanAverages} />
        <Column title={awayName} formation={lineUps.away.formation} players={lineUps.away.players} side="away" grades={lineUps.mediaGrades} fan={fanAverages} />
      </div>
      <p className="text-[11px] text-muted"><span className="font-bold text-accent">ירוק</span> = ציון האוהדים · <span className="font-bold">אפור</span> = ציון התקשורת</p>
    </div>
  );
}
