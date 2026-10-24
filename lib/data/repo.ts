import type {
  ArticleCategory,
  ArticleDTO,
  DigestDTO,
  EventDTO,
  LeagueDTO,
  MatchDTO,
  MatchStatus,
  NotificationPrefs,
  RatingSummary,
  StandingDTO,
  TeamDTO,
  ThemeId,
  ThreadDTO
} from "@/lib/types";

export type UserRecord = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  favoriteTeamId: string | null;
  themePreference: ThemeId;
  customApiKeysJson: string | null;
  notificationPrefs: NotificationPrefs;
  createdAt: string;
};

export type MatchQuery = {
  leagueId?: string;
  teamId?: string;
  from?: Date;
  to?: Date;
  status?: MatchStatus[];
  limit?: number;
  order?: "asc" | "desc";
};

export type ThreadQuery = {
  teamId?: string;
  category?: ArticleCategory;
  q?: string;
  limit: number;
  offset?: number;
};

export type NewArticle = Omit<ArticleDTO, "id" | "neutralTitle" | "threadId"> & { neutralTitle?: string | null };

export type ClusterCandidate = {
  id: string;
  signature: string;
  teamId: string | null;
  category: ArticleCategory;
  lastPublishedAt: string;
  titleHe: string;
};

export type RatingInput = { playerName: string; rating: number; note?: string | null };

/**
 * Persistence boundary. Two implementations exist: Neon/Drizzle (`DbRepo`) and an in-memory store seeded with the
 * baseline dataset (`MemoryRepo`) so the app runs with zero configuration.
 */
export interface Repo {
  readonly kind: "db" | "memory";

  listLeagues(): Promise<LeagueDTO[]>;
  listTeams(filter?: { leagueId?: string }): Promise<TeamDTO[]>;
  getTeam(id: string): Promise<TeamDTO | null>;

  listThreads(q: ThreadQuery): Promise<ThreadDTO[]>;
  getThread(id: string): Promise<ThreadDTO | null>;
  getArticle(id: string): Promise<ArticleDTO | null>;

  listMatches(q: MatchQuery): Promise<MatchDTO[]>;
  getMatch(id: string): Promise<{ match: MatchDTO; events: EventDTO[] } | null>;
  getStandings(leagueId: string): Promise<StandingDTO[]>;
  headToHead(teamA: string, teamB: string, limit: number): Promise<MatchDTO[]>;

  ratingSummary(matchId: string): Promise<RatingSummary[]>;
  userRatings(matchId: string, userId: string): Promise<Record<string, { rating: number; note: string | null }>>;
  saveRatings(matchId: string, userId: string, ratings: RatingInput[]): Promise<void>;
  exportUserRatings(userId: string): Promise<Array<{ matchId: string; playerName: string; rating: number; note: string | null; createdAt: string }>>;

  createUser(input: { email: string; displayName: string; passwordHash: string; favoriteTeamId: string | null }): Promise<UserRecord>;
  getUserById(id: string): Promise<UserRecord | null>;
  getUserByEmail(email: string): Promise<UserRecord | null>;
  updateUser(
    id: string,
    patch: Partial<Pick<UserRecord, "displayName" | "favoriteTeamId" | "themePreference" | "customApiKeysJson" | "notificationPrefs">>
  ): Promise<void>;

  listFavoriteTeamIds(): Promise<string[]>;
  getDigest(teamId: string, day: string): Promise<DigestDTO | null>;
  saveDigest(d: DigestDTO): Promise<void>;

  voteCounts(threadId: string): Promise<{ optimistic: number; worried: number }>;
  castVote(threadId: string, userId: string, vote: "optimistic" | "worried"): Promise<void>;

  /* ---- ingestion & AI enrichment ---- */
  existingSourceUrls(urls: string[]): Promise<Set<string>>;
  clusterCandidates(since: Date): Promise<ClusterCandidate[]>;
  createThread(t: { titleHe: string; teamId: string | null; category: ArticleCategory; signature: string; heroImageUrl: string | null; publishedAt: string }): Promise<string>;
  insertArticle(threadId: string, a: NewArticle): Promise<string>;
  refreshThread(threadId: string, patch: { signature?: string; heroImageUrl?: string | null; titleHe?: string }): Promise<void>;
  articlesNeedingAI(limit: number): Promise<ArticleDTO[]>;
  updateArticleAI(id: string, patch: { neutralTitle: string; summary: string | null; clickbaitScore: number }): Promise<void>;
  threadsNeedingVibe(limit: number): Promise<ThreadDTO[]>;
  setThreadVibe(threadId: string, optimistic: number, worried: number): Promise<void>;
  logIngestRun(r: { startedAt: Date; fetched: number; inserted: number; report: Record<string, unknown> }): Promise<void>;

  /* ---- match data sync ---- */
  upsertMatches(ms: MatchDTO[]): Promise<void>;
  replaceEvents(matchId: string, events: Omit<EventDTO, "id" | "matchId">[]): Promise<void>;
  replaceStandings(leagueId: string, rows: Omit<StandingDTO, "position" | "goalDifference">[]): Promise<void>;
  purgeDemoData(leagueId: string): Promise<void>;
  getLeagueSyncedAt(leagueId: string): Promise<Date | null>;
  markLeagueSynced(leagueId: string): Promise<void>;
}
