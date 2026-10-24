import type { LineUps, LineupPlayer, MatchStats, NotificationPrefs } from "@/db/schema";

export type { LineUps, LineupPlayer, MatchStats, NotificationPrefs };

export type SportType = "football" | "basketball";
export type ThemeId = "dark" | "light" | "pitch" | "night";
export type MatchStatus =
  | "scheduled"
  | "first_half"
  | "half_time"
  | "second_half"
  | "extra_time"
  | "finished"
  | "postponed";
export type EventType = "goal" | "card" | "substitution" | "var";
export type ArticleCategory =
  | "football_israel"
  | "football_world"
  | "basketball_israel"
  | "basketball_world"
  | "transfers"
  | "other";

export type LeagueDTO = {
  id: string;
  nameHe: string;
  nameEn: string;
  country: string;
  logoUrl: string | null;
  sportType: SportType;
  season: string;
  sortOrder: number;
  apiFootballId: number | null;
  apiBasketballId: number | null;
  sportmonksId: number | null;
};

export type TeamDTO = {
  id: string;
  nameHe: string;
  nameEn: string;
  logoUrl: string | null;
  leagueId: string;
  sportType: SportType;
  venue: string | null;
  city: string | null;
  aliases: string[];
  primaryColor: string | null;
};

export type MatchDTO = {
  id: string;
  leagueId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  minute: number | null;
  matchTimestamp: string;
  venue: string | null;
  round: string | null;
  stats: MatchStats | null;
  lineUps: LineUps | null;
  externalId: string | null;
  isDemo: boolean;
};

export type EventDTO = {
  id: string;
  matchId: string;
  minute: number;
  teamId: string | null;
  eventType: EventType;
  playerName: string;
  description: string | null;
};

export type StandingDTO = {
  leagueId: string;
  teamId: string;
  position: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: string;
  isDemo: boolean;
};

export type ArticleDTO = {
  id: string;
  threadId: string | null;
  originalTitle: string;
  neutralTitle: string;
  fullText: string;
  summary: string | null;
  sourceKey: string;
  sourceName: string;
  sourceUrl: string;
  imageUrl: string | null;
  author: string | null;
  publishedAt: string;
  category: ArticleCategory;
  teamId: string | null;
  clickbaitScore: number;
  isDemo: boolean;
};

export type ThreadDTO = {
  id: string;
  titleHe: string;
  vibeOptimistic: number | null;
  vibeWorried: number | null;
  teamId: string | null;
  category: ArticleCategory;
  heroImageUrl: string | null;
  lastPublishedAt: string;
  articles: ArticleDTO[];
};

export type RatingSummary = {
  playerName: string;
  average: number;
  count: number;
};

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  favoriteTeamId: string | null;
  themePreference: ThemeId;
  notificationPrefs: NotificationPrefs;
  hasStoredKeys: boolean;
};

export type DigestDTO = { teamId: string; digestDate: string; contentHe: string; generatedBy: string };

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  goals: true,
  kickoff: true,
  finalWhistle: true,
  breakingNews: true,
  digest: true
};
