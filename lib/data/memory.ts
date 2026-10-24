import { buildBaseline, type Baseline } from "@/db/baseline";
import { uuidFrom } from "@/lib/util";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/types";
import type {
  ArticleCategory,
  ArticleDTO,
  DigestDTO,
  EventDTO,
  LeagueDTO,
  MatchDTO,
  RatingSummary,
  StandingDTO,
  TeamDTO,
  ThreadDTO
} from "@/lib/types";
import type { ClusterCandidate, MatchQuery, NewArticle, RatingInput, Repo, ThreadQuery, UserRecord } from "./repo";

type ThreadRow = Omit<ThreadDTO, "articles"> & { signature: string };

export class MemoryRepo implements Repo {
  readonly kind = "memory" as const;
  private leagues: LeagueDTO[];
  private teams: TeamDTO[];
  private matches: MatchDTO[];
  private events: EventDTO[];
  private standings: StandingDTO[];
  private threads: ThreadRow[];
  private articles: ArticleDTO[];
  private users = new Map<string, UserRecord>();
  private ratings: Array<{ matchId: string; userId: string; playerName: string; rating: number; note: string | null; createdAt: string }> = [];
  private digests = new Map<string, DigestDTO>();
  private votes = new Map<string, "optimistic" | "worried">();
  private unanalysed = new Set<string>();

  constructor(baseline: Baseline = buildBaseline()) {
    this.leagues = baseline.leagues;
    this.teams = baseline.teams;
    this.matches = baseline.matches;
    this.events = baseline.events;
    this.standings = baseline.standings;
    this.threads = baseline.threads.map((t) => ({ ...t, signature: "" }));
    this.articles = baseline.articles;
  }

  async listLeagues() {
    return [...this.leagues].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async listTeams(filter?: { leagueId?: string }) {
    return this.teams.filter((t) => !filter?.leagueId || t.leagueId === filter.leagueId);
  }

  async getTeam(id: string) {
    return this.teams.find((t) => t.id === id) ?? null;
  }

  private withArticles(t: ThreadRow): ThreadDTO {
    const { signature: _s, ...rest } = t;
    const arts = this.articles.filter((a) => a.threadId === t.id).sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
    return { ...rest, articles: arts };
  }

  async listThreads(q: ThreadQuery) {
    const needle = q.q?.trim().toLowerCase();
    let rows = this.threads.filter((t) => (!q.teamId || t.teamId === q.teamId) && (!q.category || t.category === q.category));
    if (needle) {
      rows = rows.filter(
        (t) =>
          t.titleHe.toLowerCase().includes(needle) ||
          this.articles.some((a) => a.threadId === t.id && (a.originalTitle.toLowerCase().includes(needle) || a.neutralTitle.toLowerCase().includes(needle)))
      );
    }
    rows.sort((a, b) => b.lastPublishedAt.localeCompare(a.lastPublishedAt));
    return rows.slice(q.offset ?? 0, (q.offset ?? 0) + q.limit).map((t) => this.withArticles(t));
  }

  async getThread(id: string) {
    const t = this.threads.find((x) => x.id === id);
    return t ? this.withArticles(t) : null;
  }

  async getArticle(id: string) {
    return this.articles.find((a) => a.id === id) ?? null;
  }

  async listMatches(q: MatchQuery) {
    let rows = [...this.matches];
    rows = rows.filter((m) => {
      if (q.leagueId && m.leagueId !== q.leagueId) return false;
      if (q.teamId && m.homeTeamId !== q.teamId && m.awayTeamId !== q.teamId) return false;
      const t = new Date(m.matchTimestamp).getTime();
      if (q.from && t < q.from.getTime()) return false;
      if (q.to && t > q.to.getTime()) return false;
      if (q.status && !q.status.includes(m.status)) return false;
      return true;
    });
    rows.sort((a, b) => (q.order === "desc" ? b.matchTimestamp.localeCompare(a.matchTimestamp) : a.matchTimestamp.localeCompare(b.matchTimestamp)));
    return q.limit ? rows.slice(0, q.limit) : rows;
  }

  async getMatch(id: string) {
    const m = this.matches.find((x) => x.id === id);
    if (!m) return null;
    return { match: m, events: this.events.filter((e) => e.matchId === id).sort((a, b) => a.minute - b.minute) };
  }

  async getStandings(leagueId: string) {
    return this.standings.filter((s) => s.leagueId === leagueId).sort((a, b) => a.position - b.position);
  }

  async headToHead(a: string, b: string, limit: number) {
    return this.matches
      .filter((m) => m.status === "finished" && ((m.homeTeamId === a && m.awayTeamId === b) || (m.homeTeamId === b && m.awayTeamId === a)))
      .sort((x, y) => y.matchTimestamp.localeCompare(x.matchTimestamp))
      .slice(0, limit);
  }

  async ratingSummary(matchId: string): Promise<RatingSummary[]> {
    const by = new Map<string, number[]>();
    for (const r of this.ratings.filter((x) => x.matchId === matchId)) by.set(r.playerName, [...(by.get(r.playerName) ?? []), r.rating]);
    return [...by.entries()].map(([playerName, v]) => ({ playerName, average: v.reduce((s, n) => s + n, 0) / v.length, count: v.length }));
  }

  async userRatings(matchId: string, userId: string) {
    const out: Record<string, { rating: number; note: string | null }> = {};
    for (const r of this.ratings.filter((x) => x.matchId === matchId && x.userId === userId)) out[r.playerName] = { rating: r.rating, note: r.note };
    return out;
  }

  async saveRatings(matchId: string, userId: string, ratings: RatingInput[]) {
    for (const r of ratings) {
      this.ratings = this.ratings.filter((x) => !(x.matchId === matchId && x.userId === userId && x.playerName === r.playerName));
      this.ratings.push({ matchId, userId, playerName: r.playerName, rating: r.rating, note: r.note ?? null, createdAt: new Date().toISOString() });
    }
  }

  async exportUserRatings(userId: string) {
    return this.ratings.filter((r) => r.userId === userId).map(({ userId: _u, ...rest }) => rest);
  }

  async createUser(input: { email: string; displayName: string; passwordHash: string; favoriteTeamId: string | null }) {
    const user: UserRecord = {
      id: uuidFrom(`user:${input.email}:${Date.now()}:${Math.random()}`),
      email: input.email,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      favoriteTeamId: input.favoriteTeamId,
      themePreference: "dark",
      customApiKeysJson: null,
      notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS },
      createdAt: new Date().toISOString()
    };
    this.users.set(user.id, user);
    return user;
  }

  async getUserById(id: string) {
    return this.users.get(id) ?? null;
  }

  async getUserByEmail(email: string) {
    return [...this.users.values()].find((u) => u.email === email) ?? null;
  }

  async updateUser(id: string, patch: Parameters<Repo["updateUser"]>[1]) {
    const u = this.users.get(id);
    if (u) this.users.set(id, { ...u, ...patch });
  }

  async listFavoriteTeamIds() {
    return [...new Set([...this.users.values()].map((u) => u.favoriteTeamId).filter((x): x is string => Boolean(x)))];
  }

  async getDigest(teamId: string, day: string) {
    return this.digests.get(`${teamId}:${day}`) ?? null;
  }

  async saveDigest(d: DigestDTO) {
    this.digests.set(`${d.teamId}:${d.digestDate}`, d);
  }

  async voteCounts(threadId: string) {
    let optimistic = 0;
    let worried = 0;
    for (const [k, v] of this.votes) if (k.startsWith(`${threadId}:`)) v === "optimistic" ? optimistic++ : worried++;
    return { optimistic, worried };
  }

  async castVote(threadId: string, userId: string, vote: "optimistic" | "worried") {
    this.votes.set(`${threadId}:${userId}`, vote);
  }

  async existingSourceUrls(urls: string[]) {
    const have = new Set(this.articles.map((a) => a.sourceUrl));
    return new Set(urls.filter((u) => have.has(u)));
  }

  async clusterCandidates(since: Date): Promise<ClusterCandidate[]> {
    return this.threads
      .filter((t) => new Date(t.lastPublishedAt) >= since)
      .map((t) => ({ id: t.id, signature: t.signature, teamId: t.teamId, category: t.category, lastPublishedAt: t.lastPublishedAt, titleHe: t.titleHe }));
  }

  async createThread(t: { titleHe: string; teamId: string | null; category: ArticleCategory; signature: string; heroImageUrl: string | null; publishedAt: string }) {
    const id = uuidFrom(`thread:${t.titleHe}:${Date.now()}:${Math.random()}`);
    this.threads.push({ id, titleHe: t.titleHe, vibeOptimistic: null, vibeWorried: null, teamId: t.teamId, category: t.category, heroImageUrl: t.heroImageUrl, lastPublishedAt: t.publishedAt, signature: t.signature });
    return id;
  }

  async insertArticle(threadId: string, a: NewArticle) {
    const id = uuidFrom(`article:${a.sourceUrl}`);
    this.articles.push({ ...a, id, threadId, neutralTitle: a.neutralTitle ?? a.originalTitle });
    if (!a.neutralTitle) this.unanalysed.add(id);
    const t = this.threads.find((x) => x.id === threadId);
    if (t && a.publishedAt > t.lastPublishedAt) t.lastPublishedAt = a.publishedAt;
    return id;
  }

  async refreshThread(threadId: string, patch: { signature?: string; heroImageUrl?: string | null; titleHe?: string }) {
    const t = this.threads.find((x) => x.id === threadId);
    if (!t) return;
    if (patch.signature !== undefined) t.signature = patch.signature;
    if (patch.heroImageUrl !== undefined && patch.heroImageUrl) t.heroImageUrl = t.heroImageUrl ?? patch.heroImageUrl;
    if (patch.titleHe) t.titleHe = patch.titleHe;
  }

  async articlesNeedingAI(limit: number) {
    return this.articles.filter((a) => this.unanalysed.has(a.id)).slice(0, limit);
  }

  async updateArticleAI(id: string, patch: { neutralTitle: string; summary: string | null; clickbaitScore: number }) {
    const a = this.articles.find((x) => x.id === id);
    if (a) Object.assign(a, { neutralTitle: patch.neutralTitle, summary: patch.summary ?? a.summary, clickbaitScore: patch.clickbaitScore });
    this.unanalysed.delete(id);
  }

  async threadsNeedingVibe(limit: number) {
    return this.threads
      .filter((t) => t.vibeOptimistic === null)
      .slice(0, limit)
      .map((t) => this.withArticles(t));
  }

  async setThreadVibe(threadId: string, optimistic: number, worried: number) {
    const t = this.threads.find((x) => x.id === threadId);
    if (t) Object.assign(t, { vibeOptimistic: optimistic, vibeWorried: worried });
  }

  async logIngestRun() {
    /* in-memory mode keeps no run history */
  }

  async upsertMatches(ms: MatchDTO[]) {
    for (const m of ms) {
      const i = this.matches.findIndex((x) => x.id === m.id);
      if (i >= 0) this.matches[i] = m;
      else this.matches.push(m);
    }
  }

  async replaceEvents(matchId: string, events: Omit<EventDTO, "id" | "matchId">[]) {
    this.events = this.events.filter((e) => e.matchId !== matchId);
    events.forEach((e, i) => this.events.push({ ...e, id: uuidFrom(`${matchId}:sync:${i}`), matchId }));
  }

  async replaceStandings(leagueId: string, rows: Omit<StandingDTO, "position" | "goalDifference">[]) {
    this.standings = this.standings.filter((s) => s.leagueId !== leagueId);
    rows
      .sort((a, b) => b.points - a.points || b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst))
      .forEach((r, i) => this.standings.push({ ...r, position: i + 1, goalDifference: r.goalsFor - r.goalsAgainst }));
  }

  private synced = new Map<string, Date>();

  async getLeagueSyncedAt(leagueId: string) {
    return this.synced.get(leagueId) ?? null;
  }

  async markLeagueSynced(leagueId: string) {
    this.synced.set(leagueId, new Date());
  }

  async purgeDemoData(leagueId: string) {
    const ids = new Set(this.matches.filter((m) => m.leagueId === leagueId && m.isDemo).map((m) => m.id));
    this.matches = this.matches.filter((m) => !ids.has(m.id));
    this.events = this.events.filter((e) => !ids.has(e.matchId));
    this.standings = this.standings.filter((s) => !(s.leagueId === leagueId && s.isDemo));
  }
}
