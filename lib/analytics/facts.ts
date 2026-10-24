import type { Repo } from "@/lib/data/repo";
import { fmtDate, fmtNum, fmtTime } from "@/lib/format";
import type { EventDTO, LeagueDTO, MatchDTO, StandingDTO, TeamDTO } from "@/lib/types";
import { bottomN, simulateSeason, topN, totalGamesFor, type FinishDistribution } from "./season";

export type RecentMatchFact = {
  round: string | null;
  date: string;
  opponent: string;
  venue: "בית" | "חוץ";
  result: "W" | "D" | "L";
  score: string;
  possession: number | null;
  xgFor: number | null;
  xgAgainst: number | null;
  shotsOnTarget: [number, number] | null;
};

export type TeamFacts = {
  teamId: string;
  name: string;
  league: string;
  sport: "football" | "basketball";
  standing: { position: number; of: number; played: number; points: number; goalDifference: number; form: string } | null;
  recent: RecentMatchFact[];
  upcoming: Array<{ date: string; time: string; opponent: string; venue: "בית" | "חוץ"; league: string }>;
  lastMatch: {
    id: string;
    opponent: string;
    score: string;
    firstHalf: { goalsFor: number; goalsAgainst: number };
    secondHalf: { goalsFor: number; goalsAgainst: number };
    cards: number;
    substitutions: number;
    timeline: string[];
  } | null;
  scenarios: {
    expectedPosition: number;
    expectedPoints: number;
    title: number;
    topBracket: { n: number; probability: number };
    bottomBracket: { n: number; probability: number };
  } | null;
  leaders: Array<{ position: number; team: string; points: number }>;
  dataSource: "baseline" | "live";
};

const half = (events: EventDTO[], teamId: string, from: number, to: number, own: boolean) =>
  events.filter((e) => e.eventType === "goal" && e.minute > from && e.minute <= to && (own ? e.teamId === teamId : e.teamId !== teamId)).length;

export async function buildTeamFacts(repo: Repo, team: TeamDTO, leagues: LeagueDTO[], teams: Map<string, TeamDTO>): Promise<TeamFacts> {
  const league = leagues.find((l) => l.id === team.leagueId) as LeagueDTO;
  const table: StandingDTO[] = await repo.getStandings(team.leagueId);
  const row = table.find((r) => r.teamId === team.id) ?? null;
  const name = (id: string) => teams.get(id)?.nameHe ?? id;
  const leagueName = (id: string) => leagues.find((l) => l.id === id)?.nameHe ?? id;

  const finished = await repo.listMatches({ teamId: team.id, status: ["finished"], order: "desc", limit: 5 });
  const recent: RecentMatchFact[] = finished.map((m) => {
    const home = m.homeTeamId === team.id;
    const own = (home ? m.homeScore : m.awayScore) ?? 0;
    const opp = (home ? m.awayScore : m.homeScore) ?? 0;
    const idx = home ? 0 : 1;
    return {
      round: m.round,
      date: fmtDate(m.matchTimestamp),
      opponent: name(home ? m.awayTeamId : m.homeTeamId),
      venue: home ? "בית" : "חוץ",
      result: own > opp ? "W" : own < opp ? "L" : "D",
      score: `${fmtNum(own)}:${fmtNum(opp)}`,
      possession: m.stats?.possession?.[idx] ?? null,
      xgFor: m.stats?.xg?.[idx] ?? null,
      xgAgainst: m.stats?.xg?.[1 - idx] ?? null,
      shotsOnTarget: m.stats?.shotsOnTarget ? [m.stats.shotsOnTarget[idx], m.stats.shotsOnTarget[1 - idx]] : null
    };
  });

  const upcomingMatches = await repo.listMatches({ teamId: team.id, status: ["scheduled"], from: new Date(), order: "asc", limit: 3 });
  const upcoming = upcomingMatches.map((m) => {
    const home = m.homeTeamId === team.id;
    return { date: fmtDate(m.matchTimestamp), time: fmtTime(m.matchTimestamp), opponent: name(home ? m.awayTeamId : m.homeTeamId), venue: (home ? "בית" : "חוץ") as "בית" | "חוץ", league: leagueName(m.leagueId) };
  });

  let lastMatch: TeamFacts["lastMatch"] = null;
  if (finished[0] && league.sportType === "football") {
    const m = finished[0];
    const detail = await repo.getMatch(m.id);
    const ev = detail?.events ?? [];
    const home = m.homeTeamId === team.id;
    const own = (home ? m.homeScore : m.awayScore) ?? 0;
    const opp = (home ? m.awayScore : m.homeScore) ?? 0;
    lastMatch = {
      id: m.id,
      opponent: name(home ? m.awayTeamId : m.homeTeamId),
      score: `${fmtNum(own)}:${fmtNum(opp)}`,
      firstHalf: { goalsFor: half(ev, team.id, 0, 45, true), goalsAgainst: half(ev, team.id, 0, 45, false) },
      secondHalf: { goalsFor: half(ev, team.id, 45, 130, true), goalsAgainst: half(ev, team.id, 45, 130, false) },
      cards: ev.filter((e) => e.eventType === "card").length,
      substitutions: ev.filter((e) => e.eventType === "substitution").length,
      timeline: ev.map((e) => `דקה ${fmtNum(e.minute)}: ${e.teamId === team.id ? name(team.id) : name(e.teamId ?? "")} – ${e.description ?? e.eventType}`)
    };
  }

  let scenarios: TeamFacts["scenarios"] = null;
  let dist: FinishDistribution | undefined;
  if (row && row.played >= 3 && table.length >= 8) {
    const sims = simulateSeason(table, { totalGames: totalGamesFor(team.leagueId, table.length), sport: league.sportType });
    dist = sims.find((d) => d.teamId === team.id);
    const topSize = league.sportType === "football" ? (table.length >= 18 ? 4 : 6) : team.leagueId === "nba" ? 6 : 4;
    const bottomSize = league.sportType === "football" ? (table.length >= 18 ? 3 : 2) : 2;
    if (dist) {
      scenarios = {
        expectedPosition: Math.round(dist.expectedPosition * 10) / 10,
        expectedPoints: Math.round(dist.expectedPoints),
        title: Math.round(dist.positions[0] * 100),
        topBracket: { n: topSize, probability: Math.round(topN(dist, topSize) * 100) },
        bottomBracket: { n: bottomSize, probability: Math.round(bottomN(dist, bottomSize) * 100) }
      };
    }
  }

  return {
    teamId: team.id,
    name: team.nameHe,
    league: league.nameHe,
    sport: team.sportType,
    standing: row ? { position: row.position, of: table.length, played: row.played, points: row.points, goalDifference: row.goalDifference, form: row.form } : null,
    recent,
    upcoming,
    lastMatch,
    scenarios,
    leaders: table.slice(0, 5).map((r) => ({ position: r.position, team: name(r.teamId), points: r.points })),
    dataSource: row?.isDemo === false ? "live" : "baseline"
  };
}

export const FORM_HE: Record<string, string> = { W: "נ", D: "ת", L: "ה" };

export function matchSummaryLine(m: MatchDTO, name: (id: string) => string): string {
  return `${name(m.homeTeamId)} ${fmtNum(m.homeScore ?? 0)}:${fmtNum(m.awayScore ?? 0)} ${name(m.awayTeamId)}`;
}
