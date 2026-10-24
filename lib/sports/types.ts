import type { EventType, LeagueDTO, LineUps, MatchStats, MatchStatus } from "@/lib/types";

export type ProviderMatch = {
  externalId: string;
  leagueExternalId: number | null;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  minute: number | null;
  kickoff: string;
  venue: string | null;
  round: string | null;
};

export type ProviderStanding = {
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  form: string;
};

export type ProviderEvent = { minute: number; teamName: string; eventType: EventType; playerName: string; description: string | null };

export type ProviderDetail = { events: ProviderEvent[]; stats: MatchStats | null; lineUps: (Omit<LineUps, "home" | "away"> & { home: LineUps["home"] & { teamName: string }; away: LineUps["away"] & { teamName: string } }) | null };

/** Strongly typed contract implemented by every live-data adapter. */
export interface SportsProvider {
  readonly id: "api-football" | "sportmonks";
  liveMatches(leagues: LeagueDTO[]): Promise<ProviderMatch[]>;
  fixtures(league: LeagueDTO, fromDay: string, toDay: string): Promise<ProviderMatch[]>;
  standings(league: LeagueDTO): Promise<ProviderStanding[]>;
  detail(league: LeagueDTO, externalId: string): Promise<ProviderDetail | null>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Display item for the live ticker and notifications (works for provider and baseline data alike). */
export type TickerItem = {
  matchId: string | null;
  externalId: string | null;
  leagueId: string | null;
  leagueNameHe: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeNameHe: string;
  awayNameHe: string;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  minute: number | null;
  kickoff: string;
};
