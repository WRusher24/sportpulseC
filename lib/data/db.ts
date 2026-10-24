import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as s from "@/db/schema";
import type { ClusterCandidate, MatchQuery, NewArticle, RatingInput, Repo, ThreadQuery, UserRecord } from "./repo";
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

const iso = (d: Date) => d.toISOString();
const escapeLike = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);

const toLeague = (r: s.League): LeagueDTO => ({ ...r, sortOrder: r.sortOrder });
const toTeam = (r: s.Team): TeamDTO => ({
  id: r.id,
  nameHe: r.nameHe,
  nameEn: r.nameEn,
  logoUrl: r.logoUrl,
  leagueId: r.leagueId,
  sportType: r.sportType,
  venue: r.venue,
  city: r.city,
  aliases: r.aliases,
  primaryColor: r.primaryColor
});
const toMatch = (r: s.Match): MatchDTO => ({
  id: r.id,
  leagueId: r.leagueId,
  homeTeamId: r.homeTeamId,
  awayTeamId: r.awayTeamId,
  homeScore: r.homeScore,
  awayScore: r.awayScore,
  status: r.status,
  minute: r.minute,
  matchTimestamp: iso(r.matchTimestamp),
  venue: r.venue,
  round: r.round,
  stats: r.statsJson ?? null,
  lineUps: r.lineUpsJson ?? null,
  externalId: r.externalId,
  isDemo: r.isDemo
});
const toEvent = (r: s.MatchEvent): EventDTO => ({
  id: r.id,
  matchId: r.matchId,
  minute: r.minute,
  teamId: r.teamId,
  eventType: r.eventType,
  playerName: r.playerName,
  description: r.description
});
const toStanding = (r: s.Standing, position: number): StandingDTO => ({
  leagueId: r.leagueId,
  teamId: r.teamId,
  position,
  played: r.played,
  wins: r.wins,
  draws: r.draws,
  losses: r.losses,
  goalsFor: r.goalsFor,
  goalsAgainst: r.goalsAgainst,
  goalDifference: r.goalsFor - r.goalsAgainst,
  points: r.points,
  form: r.form,
  isDemo: r.isDemo
});
const toArticle = (r: s.Article): ArticleDTO => ({
  id: r.id,
  threadId: r.masterThreadId,
  originalTitle: r.originalTitle,
  neutralTitle: r.cleanedNeutralTitle ?? r.originalTitle,
  fullText: r.fullText,
  summary: r.summaryTldr,
  sourceKey: r.sourceKey,
  sourceName: r.sourceName,
  sourceUrl: r.sourceUrl,
  imageUrl: r.originalImageUrl,
  author: r.author,
  publishedAt: iso(r.publishedAt),
  category: r.category,
  teamId: r.teamId,
  clickbaitScore: r.clickbaitScore,
  isDemo: r.isDemo
});
const toThread = (r: s.Thread, articles: ArticleDTO[]): ThreadDTO => ({
  id: r.id,
  titleHe: r.primaryTitleHe,
  vibeOptimistic: r.aiVibeScore,
  vibeWorried: r.vibeWorriedScore,
  teamId: r.teamId,
  category: r.category,
  heroImageUrl: r.heroImageUrl,
  lastPublishedAt: iso(r.lastPublishedAt),
  articles
});
const toUser = (r: s.User): UserRecord => ({
  id: r.id,
  email: r.email,
  displayName: r.displayName,
  passwordHash: r.passwordHash,
  favoriteTeamId: r.favoriteTeamId,
  themePreference: r.themePreference,
  customApiKeysJson: r.customApiKeysJson,
  notificationPrefs: r.notificationPrefsJson,
  createdAt: iso(r.createdAt)
});

export class DbRepo implements Repo {
  readonly kind = "db" as const;
  constructor(private readonly db: Database) {}

  async listLeagues() {
    return (await this.db.select().from(s.leagues).orderBy(asc(s.leagues.sortOrder))).map(toLeague);
  }

  async listTeams(filter?: { leagueId?: string }) {
    const rows = filter?.leagueId
      ? await this.db.select().from(s.teams).where(eq(s.teams.leagueId, filter.leagueId)).orderBy(asc(s.teams.nameHe))
      : await this.db.select().from(s.teams).orderBy(asc(s.teams.nameHe));
    return rows.map(toTeam);
  }

  async getTeam(id: string) {
    const [r] = await this.db.select().from(s.teams).where(eq(s.teams.id, id)).limit(1);
    return r ? toTeam(r) : null;
  }

  private async attachArticles(rows: s.Thread[]): Promise<ThreadDTO[]> {
    if (rows.length === 0) return [];
    const arts = await this.db
      .select()
      .from(s.articles)
      .where(inArray(s.articles.masterThreadId, rows.map((r) => r.id)))
      .orderBy(asc(s.articles.publishedAt));
    const by = new Map<string, ArticleDTO[]>();
    for (const a of arts) {
      const list = by.get(a.masterThreadId as string) ?? [];
      list.push(toArticle(a));
      by.set(a.masterThreadId as string, list);
    }
    return rows.map((r) => toThread(r, by.get(r.id) ?? []));
  }

  async listThreads(q: ThreadQuery) {
    const conds = [];
    if (q.teamId) conds.push(eq(s.masterStoryThreads.teamId, q.teamId));
    if (q.category) conds.push(eq(s.masterStoryThreads.category, q.category));
    const needle = q.q?.trim();
    if (needle) {
      const like = `%${escapeLike(needle)}%`;
      conds.push(
        or(
          ilike(s.masterStoryThreads.primaryTitleHe, like),
          sql`${s.masterStoryThreads.id} in (select ${s.articles.masterThreadId} from ${s.articles} where ${s.articles.originalTitle} ilike ${like} or ${s.articles.cleanedNeutralTitle} ilike ${like})`
        )
      );
    }
    const rows = await this.db
      .select()
      .from(s.masterStoryThreads)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(s.masterStoryThreads.lastPublishedAt))
      .limit(q.limit)
      .offset(q.offset ?? 0);
    return this.attachArticles(rows);
  }

  async getThread(id: string) {
    const [r] = await this.db.select().from(s.masterStoryThreads).where(eq(s.masterStoryThreads.id, id)).limit(1);
    return r ? (await this.attachArticles([r]))[0] : null;
  }

  async getArticle(id: string) {
    const [r] = await this.db.select().from(s.articles).where(eq(s.articles.id, id)).limit(1);
    return r ? toArticle(r) : null;
  }

  async listMatches(q: MatchQuery) {
    const conds = [];
    if (q.leagueId) conds.push(eq(s.matches.leagueId, q.leagueId));
    if (q.teamId) conds.push(or(eq(s.matches.homeTeamId, q.teamId), eq(s.matches.awayTeamId, q.teamId)));
    if (q.from) conds.push(gte(s.matches.matchTimestamp, q.from));
    if (q.to) conds.push(lte(s.matches.matchTimestamp, q.to));
    const rows = await this.db
      .select()
      .from(s.matches)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(q.order === "desc" ? desc(s.matches.matchTimestamp) : asc(s.matches.matchTimestamp));

    let out = rows.map(toMatch);
    if (q.status) out = out.filter((m) => q.status!.includes(m.status));
    return q.limit ? out.slice(0, q.limit) : out;
  }

  async getMatch(id: string) {
    const [r] = await this.db.select().from(s.matches).where(eq(s.matches.id, id)).limit(1);
    if (!r) return null;
    const evs = (await this.db.select().from(s.matchEvents).where(eq(s.matchEvents.matchId, id)).orderBy(asc(s.matchEvents.minute))).map(toEvent);
    return { match: toMatch(r), events: evs };
  }

  async getStandings(leagueId: string) {
    const rows = await this.db.select().from(s.standings).where(eq(s.standings.leagueId, leagueId));
    return rows
      .sort((a, b) => b.points - a.points || b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor)
      .map((r, i) => toStanding(r, i + 1));
  }

  async headToHead(a: string, b: string, limit: number) {
    const rows = await this.db
      .select()
      .from(s.matches)
      .where(
        and(
          eq(s.matches.status, "finished"),
          or(
            and(eq(s.matches.homeTeamId, a), eq(s.matches.awayTeamId, b)),
            and(eq(s.matches.homeTeamId, b), eq(s.matches.awayTeamId, a))
          )
        )
      )
      .orderBy(desc(s.matches.matchTimestamp))
      .limit(limit);
    return rows.map(toMatch);
  }

  async ratingSummary(matchId: string): Promise<RatingSummary[]> {
    const rows = await this.db
      .select({ playerName: s.fanRatings.playerName, average: sql<number>`avg(${s.fanRatings.rating})::float`, count: sql<number>`count(*)::int` })
      .from(s.fanRatings)
      .where(eq(s.fanRatings.matchId, matchId))
      .groupBy(s.fanRatings.playerName);
    return rows.map((r) => ({ playerName: r.playerName, average: Number(r.average), count: Number(r.count) }));
  }

  async userRatings(matchId: string, userId: string) {
    const rows = await this.db.select().from(s.fanRatings).where(and(eq(s.fanRatings.matchId, matchId), eq(s.fanRatings.userId, userId)));
    return Object.fromEntries(rows.map((r) => [r.playerName, { rating: r.rating, note: r.note }]));
  }

  async saveRatings(matchId: string, userId: string, ratings: RatingInput[]) {
    if (ratings.length === 0) return;
    await this.db
      .insert(s.fanRatings)
      .values(ratings.map((r) => ({ matchId, userId, playerName: r.playerName, rating: r.rating, note: r.note ?? null })))
      .onConflictDoUpdate({
        target: [s.fanRatings.matchId, s.fanRatings.userId, s.fanRatings.playerName],
        set: { rating: sql`excluded.rating`, note: sql`excluded.note`, createdAt: sql`now()` }
      });
  }

  async exportUserRatings(userId: string) {
    const rows = await this.db.select().from(s.fanRatings).where(eq(s.fanRatings.userId, userId)).orderBy(desc(s.fanRatings.createdAt));
    return rows.map((r) => ({ matchId: r.matchId, playerName: r.playerName, rating: r.rating, note: r.note, createdAt: iso(r.createdAt) }));
  }

  async createUser(input: { email: string; displayName: string; passwordHash: string; favoriteTeamId: string | null }) {
    const [r] = await this.db.insert(s.users).values(input).returning();
    return toUser(r);
  }

  async getUserById(id: string) {
    const [r] = await this.db.select().from(s.users).where(eq(s.users.id, id)).limit(1);
    return r ? toUser(r) : null;
  }

  async getUserByEmail(email: string) {
    const [r] = await this.db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
    return r ? toUser(r) : null;
  }

  async updateUser(id: string, patch: Parameters<Repo["updateUser"]>[1]) {
    const { notificationPrefs, ...rest } = patch;
    const set: Partial<typeof s.users.$inferInsert> = { ...rest };
    if (notificationPrefs) set.notificationPrefsJson = notificationPrefs;
    if (Object.keys(set).length === 0) return;
    await this.db.update(s.users).set(set).where(eq(s.users.id, id));
  }

  async listFavoriteTeamIds() {
    const rows = await this.db.selectDistinct({ id: s.users.favoriteTeamId }).from(s.users);
    return rows.map((r) => r.id).filter((x): x is string => Boolean(x));
  }

  async getDigest(teamId: string, day: string): Promise<DigestDTO | null> {
    const [r] = await this.db.select().from(s.digests).where(and(eq(s.digests.teamId, teamId), eq(s.digests.digestDate, day))).limit(1);
    return r ? { teamId: r.teamId, digestDate: r.digestDate, contentHe: r.contentHe, generatedBy: r.generatedBy } : null;
  }

  async saveDigest(d: DigestDTO) {
    await this.db
      .insert(s.digests)
      .values({ teamId: d.teamId, digestDate: d.digestDate, contentHe: d.contentHe, generatedBy: d.generatedBy })
      .onConflictDoUpdate({ target: [s.digests.teamId, s.digests.digestDate], set: { contentHe: d.contentHe, generatedBy: d.generatedBy, createdAt: sql`now()` } });
  }

  async voteCounts(threadId: string) {
    const rows = await this.db
      .select({ vote: s.vibeVotes.vote, n: sql<number>`count(*)::int` })
      .from(s.vibeVotes)
      .where(eq(s.vibeVotes.threadId, threadId))
      .groupBy(s.vibeVotes.vote);
    return { optimistic: Number(rows.find((r) => r.vote === "optimistic")?.n ?? 0), worried: Number(rows.find((r) => r.vote === "worried")?.n ?? 0) };
  }

  async castVote(threadId: string, userId: string, vote: "optimistic" | "worried") {
    await this.db
      .insert(s.vibeVotes)
      .values({ threadId, userId, vote })
      .onConflictDoUpdate({ target: [s.vibeVotes.threadId, s.vibeVotes.userId], set: { vote } });
  }

  async existingSourceUrls(urls: string[]) {
    if (urls.length === 0) return new Set<string>();
    const rows = await this.db.select({ u: s.articles.sourceUrl }).from(s.articles).where(inArray(s.articles.sourceUrl, urls));
    return new Set(rows.map((r) => r.u));
  }

  async clusterCandidates(since: Date): Promise<ClusterCandidate[]> {
    const rows = await this.db.select().from(s.masterStoryThreads).where(gte(s.masterStoryThreads.lastPublishedAt, since));
    return rows.map((r) => ({ id: r.id, signature: r.signature, teamId: r.teamId, category: r.category, lastPublishedAt: iso(r.lastPublishedAt), titleHe: r.primaryTitleHe }));
  }

  async createThread(t: { titleHe: string; teamId: string | null; category: ArticleCategory; signature: string; heroImageUrl: string | null; publishedAt: string }) {
    const [r] = await this.db
      .insert(s.masterStoryThreads)
      .values({ primaryTitleHe: t.titleHe, teamId: t.teamId, category: t.category, signature: t.signature, heroImageUrl: t.heroImageUrl, lastPublishedAt: new Date(t.publishedAt) })
      .returning({ id: s.masterStoryThreads.id });
    return r.id;
  }

  async insertArticle(threadId: string, a: NewArticle) {
    const [r] = await this.db
      .insert(s.articles)
      .values({
        masterThreadId: threadId,
        originalTitle: a.originalTitle,
        cleanedNeutralTitle: a.neutralTitle ?? null,
        fullText: a.fullText,
        summaryTldr: a.summary,
        sourceKey: a.sourceKey,
        sourceName: a.sourceName,
        sourceUrl: a.sourceUrl,
        originalImageUrl: a.imageUrl,
        author: a.author,
        publishedAt: new Date(a.publishedAt),
        category: a.category,
        teamId: a.teamId,
        clickbaitScore: a.clickbaitScore,
        isDemo: a.isDemo
      })
      .onConflictDoNothing({ target: s.articles.sourceUrl })
      .returning({ id: s.articles.id });
    await this.db
      .update(s.masterStoryThreads)
      .set({
        articleCount: sql`(select count(*)::int from ${s.articles} where ${s.articles.masterThreadId} = ${threadId})`,
        lastPublishedAt: sql`greatest(${s.masterStoryThreads.lastPublishedAt}, ${new Date(a.publishedAt)})`
      })
      .where(eq(s.masterStoryThreads.id, threadId));
    return r?.id ?? "";
  }

  async refreshThread(threadId: string, patch: { signature?: string; heroImageUrl?: string | null; titleHe?: string }) {
    const set: Partial<typeof s.masterStoryThreads.$inferInsert> = {};
    if (patch.signature !== undefined) set.signature = patch.signature;
    if (patch.titleHe) set.primaryTitleHe = patch.titleHe;
    if (patch.heroImageUrl) {
      await this.db
        .update(s.masterStoryThreads)
        .set({ heroImageUrl: patch.heroImageUrl })
        .where(and(eq(s.masterStoryThreads.id, threadId), isNull(s.masterStoryThreads.heroImageUrl)));
    }
    if (Object.keys(set).length) await this.db.update(s.masterStoryThreads).set(set).where(eq(s.masterStoryThreads.id, threadId));
  }

  async articlesNeedingAI(limit: number) {
    const rows = await this.db.select().from(s.articles).where(isNull(s.articles.cleanedNeutralTitle)).orderBy(desc(s.articles.publishedAt)).limit(limit);
    return rows.map(toArticle);
  }

  async updateArticleAI(id: string, patch: { neutralTitle: string; summary: string | null; clickbaitScore: number }) {
    await this.db
      .update(s.articles)
      .set({ cleanedNeutralTitle: patch.neutralTitle, summaryTldr: patch.summary ?? undefined, clickbaitScore: patch.clickbaitScore })
      .where(eq(s.articles.id, id));
  }

  async threadsNeedingVibe(limit: number) {
    const rows = await this.db.select().from(s.masterStoryThreads).where(isNull(s.masterStoryThreads.aiVibeScore)).orderBy(desc(s.masterStoryThreads.lastPublishedAt)).limit(limit);
    return this.attachArticles(rows);
  }

  async setThreadVibe(threadId: string, optimistic: number, worried: number) {
    await this.db.update(s.masterStoryThreads).set({ aiVibeScore: optimistic, vibeWorriedScore: worried }).where(eq(s.masterStoryThreads.id, threadId));
  }

  async logIngestRun(r: { startedAt: Date; fetched: number; inserted: number; report: Record<string, unknown> }) {
    await this.db.insert(s.ingestRuns).values({ startedAt: r.startedAt, finishedAt: new Date(), fetched: r.fetched, inserted: r.inserted, report: r.report });
  }

  async upsertMatches(ms: MatchDTO[]) {
    for (const m of ms) {
      const values = {
        id: m.id,
        leagueId: m.leagueId,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: m.status,
        minute: m.minute,
        matchTimestamp: new Date(m.matchTimestamp),
        venue: m.venue,
        round: m.round,
        statsJson: m.stats,
        lineUpsJson: m.lineUps,
        externalId: m.externalId,
        isDemo: m.isDemo
      };
      await this.db.insert(s.matches).values(values).onConflictDoUpdate({ target: s.matches.id, set: values });
    }
  }

  async replaceEvents(matchId: string, events: Omit<EventDTO, "id" | "matchId">[]) {
    await this.db.delete(s.matchEvents).where(eq(s.matchEvents.matchId, matchId));
    if (events.length) {
      await this.db.insert(s.matchEvents).values(events.map((e) => ({ matchId, minute: e.minute, teamId: e.teamId, eventType: e.eventType, playerName: e.playerName, description: e.description })));
    }
  }

  async replaceStandings(leagueId: string, rows: Omit<StandingDTO, "position" | "goalDifference">[]) {
    await this.db.delete(s.standings).where(eq(s.standings.leagueId, leagueId));
    if (rows.length) {
      await this.db.insert(s.standings).values(
        rows.map((r) => ({
          leagueId,
          teamId: r.teamId,
          played: r.played,
          wins: r.wins,
          draws: r.draws,
          losses: r.losses,
          goalsFor: r.goalsFor,
          goalsAgainst: r.goalsAgainst,
          points: r.points,
          form: r.form,
          isDemo: r.isDemo
        }))
      );
    }
  }

  async getLeagueSyncedAt(leagueId: string) {
    const [r] = await this.db.select({ t: s.leagues.lastSyncedAt }).from(s.leagues).where(eq(s.leagues.id, leagueId)).limit(1);
    return r?.t ?? null;
  }

  async markLeagueSynced(leagueId: string) {
    await this.db.update(s.leagues).set({ lastSyncedAt: new Date() }).where(eq(s.leagues.id, leagueId));
  }

  async purgeDemoData(leagueId: string) {
    await this.db.delete(s.matches).where(and(eq(s.matches.leagueId, leagueId), eq(s.matches.isDemo, true)));
    await this.db.delete(s.standings).where(and(eq(s.standings.leagueId, leagueId), eq(s.standings.isDemo, true)));
  }
}
