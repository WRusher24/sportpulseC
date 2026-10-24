import { isLiveStatus } from "@/lib/data/live-sim";
import type { MatchDTO, SportType, StandingDTO } from "@/lib/types";

export type LiveRow = StandingDTO & { liveMatchId: string | null; liveResult: "W" | "D" | "L" | null; positionChange: number };

const order = (a: StandingDTO, b: StandingDTO) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.teamId.localeCompare(b.teamId);

/**
 * "טבלה בזמן אמת": the official table plus every in-progress match counted as if it ended now.
 * Football 3/1/0; basketball 2 for a win and 1 for a loss (NBA ranks by wins). Providers update their official table when a
 * game ends, so a live game is never counted twice.
 */
export function projectLiveTable(rows: StandingDTO[], matches: MatchDTO[], sport: SportType, leagueId: string): LiveRow[] {
  const live = matches.filter((m) => isLiveStatus(m.status) && m.homeScore !== null && m.awayScore !== null);
  const base = [...rows].sort(order).map((r, i) => ({ ...r, position: i + 1 }));
  if (live.length === 0) return base.map((r) => ({ ...r, liveMatchId: null, liveResult: null, positionChange: 0 }));

  const projected = new Map<string, LiveRow>(base.map((r) => [r.teamId, { ...r, liveMatchId: null, liveResult: null, positionChange: 0 }]));
  const win = sport === "football" ? 3 : leagueId === "nba" ? 1 : 2;
  const draw = sport === "football" ? 1 : 0;
  const loss = sport === "football" || leagueId === "nba" ? 0 : 1;

  for (const m of live) {
    const h = projected.get(m.homeTeamId);
    const a = projected.get(m.awayTeamId);
    if (!h || !a) continue;
    const hs = m.homeScore as number;
    const as = m.awayScore as number;
    for (const [row, gf, ga] of [[h, hs, as], [a, as, hs]] as const) {
      row.played += 1;
      row.goalsFor += gf;
      row.goalsAgainst += ga;
      row.goalDifference = row.goalsFor - row.goalsAgainst;
      row.liveMatchId = m.id;
      if (gf > ga) { row.wins += 1; row.points += win; row.liveResult = "W"; }
      else if (gf < ga) { row.losses += 1; row.points += loss; row.liveResult = "L"; }
      else { row.draws += 1; row.points += draw; row.liveResult = "D"; }
    }
  }
  const sorted = [...projected.values()].sort(order);
  return sorted.map((r, i) => ({ ...r, position: i + 1, positionChange: (projected.get(r.teamId) as LiveRow).position - (i + 1) }));
}
