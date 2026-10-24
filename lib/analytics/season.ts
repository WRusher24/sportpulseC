import { mulberry32 } from "@/lib/util";
import type { StandingDTO } from "@/lib/types";

export type FinishDistribution = {
  teamId: string;
  /** probability (0-1) of finishing in each position, index 0 = 1st place */
  positions: number[];
  expectedPosition: number;
  expectedPoints: number;
};

export type SimConfig = {
  /** Games each team plays over the whole regular season. */
  totalGames: number;
  sport: "football" | "basketball";
  runs?: number;
  seed?: number;
};

/**
 * Monte Carlo season projection. Each team gets a strength from its points-per-game (shrunk toward the league mean with a
 * 3-game prior), remaining games are played against uniformly drawn opponents and resolved with a home-advantage
 * Bradley-Terry model (football adds a draw probability that peaks between evenly matched sides).
 * Transparent approximation: the baseline schedule does not contain every remaining fixture.
 */
export function simulateSeason(table: StandingDTO[], cfg: SimConfig): FinishDistribution[] {
  const n = table.length;
  if (n < 2) return [];
  const runs = cfg.runs ?? 2000;
  const rand = mulberry32(cfg.seed ?? 20260101);
  const football = cfg.sport === "football";
  const winPts = football ? 3 : 2;
  const lossPts = football ? 0 : 1;

  const meanPpg = table.reduce((s, r) => s + r.points, 0) / Math.max(1, table.reduce((s, r) => s + r.played, 0)) || (football ? 1.35 : 1.5);
  const strength = table.map((r) => (r.points + meanPpg * 3) / (r.played + 3));

  const positions = table.map(() => new Array<number>(n).fill(0));
  const pointTotals = new Array<number>(n).fill(0);

  for (let run = 0; run < runs; run++) {
    const pts = table.map((r) => r.points);
    const gd = table.map((r) => r.goalDifference + (rand() - 0.5) * 0.01);
    for (let i = 0; i < n; i++) {
      const remaining = Math.max(0, cfg.totalGames - table[i].played);
      for (let g = 0; g < remaining; g++) {
        let j = Math.floor(rand() * (n - 1));
        if (j >= i) j++;
        const home = rand() < 0.5;
        const si = strength[i] * (home ? 1.12 : 1);
        const sj = strength[j] * (home ? 1 : 1.12);
        const pWin = si / (si + sj);
        const pDraw = football ? 0.27 * (1 - Math.abs(2 * pWin - 1)) : 0;
        const x = rand();
        // Each pairing is simulated from i's perspective only, so a team's own results are not mirrored onto the opponent.
        if (x < pWin * (1 - pDraw)) pts[i] += winPts;
        else if (x < pWin * (1 - pDraw) + pDraw) pts[i] += 1;
        else pts[i] += lossPts;
      }
    }
    const order = pts.map((p, i) => ({ i, p, g: gd[i] })).sort((a, b) => b.p - a.p || b.g - a.g);
    order.forEach((o, rank) => {
      positions[o.i][rank]++;
      pointTotals[o.i] += o.p;
    });
  }

  return table.map((r, i) => {
    const dist = positions[i].map((c) => c / runs);
    return {
      teamId: r.teamId,
      positions: dist,
      expectedPosition: dist.reduce((s, p, idx) => s + p * (idx + 1), 0),
      expectedPoints: pointTotals[i] / runs
    };
  });
}

export const topN = (d: FinishDistribution, n: number) => d.positions.slice(0, n).reduce((s, p) => s + p, 0);
export const bottomN = (d: FinishDistribution, n: number) => d.positions.slice(-n).reduce((s, p) => s + p, 0);

/** Regular-season length by competition (games per team). */
export function totalGamesFor(leagueId: string, teamCount: number): number {
  if (leagueId === "nba") return 82;
  if (leagueId === "epl" || leagueId === "laliga") return (teamCount - 1) * 2;
  return (teamCount - 1) * 2;
}
