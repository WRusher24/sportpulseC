import { count } from "drizzle-orm";
import type { Database } from "./client";
import * as s from "./schema";
import { buildBaseline } from "./baseline";
import { chunk } from "@/lib/util";

export type SeedResult = { leagues: number; teams: number; matches: number; events: number; standings: number; threads: number; articles: number };

/** Idempotent: every insert is `ON CONFLICT DO NOTHING`, so it is safe to run on every deploy. */
export async function seedDatabase(db: Database, now = new Date()): Promise<SeedResult> {
  const b = buildBaseline(now);

  await db.insert(s.leagues).values(b.leagues).onConflictDoNothing();
  for (const part of chunk(b.teams, 100)) {
    await db.insert(s.teams).values(part).onConflictDoNothing();
  }
  for (const part of chunk(b.matches, 100)) {
    await db
      .insert(s.matches)
      .values(
        part.map((m) => ({
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
        }))
      )
      .onConflictDoNothing();
  }
  for (const part of chunk(b.events, 400)) {
    await db
      .insert(s.matchEvents)
      .values(part.map((e) => ({ id: e.id, matchId: e.matchId, minute: e.minute, teamId: e.teamId, eventType: e.eventType, playerName: e.playerName, description: e.description })))
      .onConflictDoNothing();
  }
  for (const part of chunk(b.standings, 100)) {
    await db
      .insert(s.standings)
      .values(
        part.map((r) => ({
          leagueId: r.leagueId,
          teamId: r.teamId,
          played: r.played,
          wins: r.wins,
          draws: r.draws,
          losses: r.losses,
          goalsFor: r.goalsFor,
          goalsAgainst: r.goalsAgainst,
          points: r.points,
          form: r.form,
          isDemo: true
        }))
      )
      .onConflictDoNothing();
  }
  for (const t of b.threads) {
    await db
      .insert(s.masterStoryThreads)
      .values({
        id: t.id,
        primaryTitleHe: t.titleHe,
        aiVibeScore: t.vibeOptimistic,
        vibeWorriedScore: t.vibeWorried,
        teamId: t.teamId,
        category: t.category,
        heroImageUrl: t.heroImageUrl,
        lastPublishedAt: new Date(t.lastPublishedAt),
        articleCount: b.articles.filter((a) => a.threadId === t.id).length,
        signature: ""
      })
      .onConflictDoNothing();
  }
  for (const part of chunk(b.articles, 50)) {
    await db
      .insert(s.articles)
      .values(
        part.map((a) => ({
          id: a.id,
          masterThreadId: a.threadId,
          originalTitle: a.originalTitle,
          cleanedNeutralTitle: a.neutralTitle,
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
          isDemo: true
        }))
      )
      .onConflictDoNothing();
  }

  return {
    leagues: b.leagues.length,
    teams: b.teams.length,
    matches: b.matches.length,
    events: b.events.length,
    standings: b.standings.length,
    threads: b.threads.length,
    articles: b.articles.length
  };
}

export async function isDatabaseSeeded(db: Database): Promise<boolean> {
  const [row] = await db.select({ n: count() }).from(s.leagues);
  return Number(row?.n ?? 0) > 0;
}
