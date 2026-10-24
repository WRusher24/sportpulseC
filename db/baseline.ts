import { LEAGUE_SEEDS, TEAM_SEEDS, type TeamSeed } from "./seed-teams";
import type { ArticleDTO, EventDTO, LeagueDTO, MatchDTO, StandingDTO, TeamDTO, ThreadDTO } from "@/lib/types";

/**
 * Real-world baseline: competitions, clubs, grounds and provider ids only.
 *
 * Nothing in here is invented: there are no fabricated fixtures, results, player names or articles. Standings start as an
 * opening table (every club on 0 games) and are replaced by the live data provider; fixtures, results and match events
 * arrive from the provider sync and articles from the RSS ingestion pipeline (both run on the 5-minute cron).
 */
export type Baseline = {
  leagues: LeagueDTO[];
  teams: TeamDTO[];
  matches: MatchDTO[];
  events: EventDTO[];
  standings: StandingDTO[];
  threads: Array<Omit<ThreadDTO, "articles">>;
  articles: ArticleDTO[];
};

export function toTeamDTO(t: TeamSeed): TeamDTO {
  return {
    id: t.id,
    nameHe: t.nameHe,
    nameEn: t.nameEn,
    logoUrl: null,
    leagueId: t.leagueId,
    sportType: t.sportType,
    venue: t.venue,
    city: t.city,
    aliases: t.aliases,
    primaryColor: t.color
  };
}

/** Leagues whose clubs form a single table (UEFA / EuroLeague guests have no complete table in the baseline). */
const TABLE_LEAGUES = new Set(["il-premier", "il-leumit", "il-winner", "epl", "laliga", "nba"]);

export function buildBaseline(_now: Date = new Date()): Baseline {
  const teams = TEAM_SEEDS.map(toTeamDTO);
  const standings: StandingDTO[] = [];
  for (const leagueId of TABLE_LEAGUES) {
    TEAM_SEEDS.filter((t) => t.leagueId === leagueId)
      .sort((a, b) => a.nameEn.localeCompare(b.nameEn))
      .forEach((t, i) =>
        standings.push({ leagueId, teamId: t.id, position: i + 1, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, form: "", isDemo: true })
      );
  }
  return { leagues: LEAGUE_SEEDS.map((l) => ({ ...l })), teams, matches: [], events: [], standings, threads: [], articles: [] };
}
