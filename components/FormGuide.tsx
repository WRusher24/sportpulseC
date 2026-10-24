import { fmtNum, fmtShortDate } from "@/lib/format";
import type { MatchDTO, TeamDTO } from "@/lib/types";
import { Score } from "./Score";
import { FormPills } from "./StandingsTable";

export function formOf(teamId: string, matches: MatchDTO[]): string {
  return matches
    .filter((m) => m.status === "finished" && m.homeScore !== null && m.awayScore !== null)
    .sort((a, b) => a.matchTimestamp.localeCompare(b.matchTimestamp))
    .slice(-5)
    .map((m) => {
      const own = m.homeTeamId === teamId ? (m.homeScore as number) : (m.awayScore as number);
      const opp = m.homeTeamId === teamId ? (m.awayScore as number) : (m.homeScore as number);
      return own > opp ? "W" : own < opp ? "L" : "D";
    })
    .join("");
}

export function FormGuide({ home, away, homeForm, awayForm, h2h, teams }: { home: TeamDTO; away: TeamDTO; homeForm: string; awayForm: string; h2h: MatchDTO[]; teams: Map<string, TeamDTO> }) {
  const homeWins = h2h.filter((m) => (m.homeTeamId === home.id ? (m.homeScore ?? 0) > (m.awayScore ?? 0) : (m.awayScore ?? 0) > (m.homeScore ?? 0))).length;
  const awayWins = h2h.filter((m) => (m.homeTeamId === away.id ? (m.homeScore ?? 0) > (m.awayScore ?? 0) : (m.awayScore ?? 0) > (m.homeScore ?? 0))).length;
  const draws = h2h.length - homeWins - awayWins;
  return (
    <div className="space-y-4">
      <section className="card" aria-label="כושר אחרון">
        <h3 className="mb-3 font-bold">כושר – 5 משחקים אחרונים</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><span className="text-sm font-semibold">{home.nameHe}</span><FormPills form={homeForm} /></div>
          <div className="flex items-center justify-between"><span className="text-sm font-semibold">{away.nameHe}</span><FormPills form={awayForm} /></div>
        </div>
      </section>
      <section className="card" aria-label="מפגשים קודמים">
        <h3 className="mb-3 font-bold">מפגשים ישירים (H2H)</h3>
        {h2h.length === 0 ? (
          <p className="text-sm text-muted">אין מפגשים קודמים במאגר.</p>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-3 text-center text-sm">
              <div><p className="num text-2xl font-extrabold text-accent">{fmtNum(homeWins)}</p><p className="text-xs text-muted">נצחונות {home.nameHe}</p></div>
              <div><p className="num text-2xl font-extrabold">{fmtNum(draws)}</p><p className="text-xs text-muted">תיקו</p></div>
              <div><p className="num text-2xl font-extrabold text-accent">{fmtNum(awayWins)}</p><p className="text-xs text-muted">נצחונות {away.nameHe}</p></div>
            </div>
            <ul>
              {h2h.map((m) => (
                <li key={m.id} className="flex items-center gap-2 border-t border-line/40 py-2 text-sm first:border-t-0">
                  <span className="num w-20 shrink-0 text-xs text-muted">{fmtShortDate(m.matchTimestamp)}</span>
                  <span className="min-w-0 flex-1 truncate">{teams.get(m.homeTeamId)?.nameHe}</span>
                  <Score home={m.homeScore} away={m.awayScore} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-end">{teams.get(m.awayTeamId)?.nameHe}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
