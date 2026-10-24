import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../db/schema";
import { seedDatabase, isDatabaseSeeded } from "../db/seed";
import { DbRepo } from "../lib/data/db";
import type { Database } from "../db/client";

/** Runs the committed SQL migration + seed + repository against a real Postgres engine (PGlite, in-process). */
async function setup() {
  const client = new PGlite();
  for (const f of readdirSync("drizzle").filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(`drizzle/${f}`, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  const db = drizzle(client, { schema }) as unknown as Database;
  return { db, repo: new DbRepo(db) };
}

test("migration applies and seed is idempotent", async () => {
  const { db, repo } = await setup();
  assert.equal(await isDatabaseSeeded(db), false);
  const first = await seedDatabase(db);
  assert.equal(first.leagues, 8);
  assert.ok(first.teams === 119);
  await seedDatabase(db);
  assert.equal(await isDatabaseSeeded(db), true);
  assert.equal((await repo.listLeagues()).length, 8);
  assert.equal((await repo.listTeams({ leagueId: "nba" })).length, 30);
  const table = await repo.getStandings("il-premier");
  assert.equal(table.length, 14);
});

test("users, ratings upsert + averages, votes, digests", async () => {
  const { db, repo } = await setup();
  await seedDatabase(db);
  const u1 = await repo.createUser({ email: "a@x.com", displayName: "א", passwordHash: "h", favoriteTeamId: "maccabi-haifa" });
  const u2 = await repo.createUser({ email: "b@x.com", displayName: "B", passwordHash: "h", favoriteTeamId: null });
  assert.equal((await repo.getUserByEmail("a@x.com"))?.id, u1.id);
  await repo.updateUser(u1.id, { themePreference: "pitch", notificationPrefs: { goals: false, kickoff: true, finalWhistle: true, breakingNews: true, digest: false }, customApiKeysJson: "v1.x.y.z" });
  const re = await repo.getUserById(u1.id);
  assert.equal(re?.themePreference, "pitch");
  assert.equal(re?.notificationPrefs.goals, false);
  assert.deepEqual(await repo.listFavoriteTeamIds(), ["maccabi-haifa"]);

  await repo.upsertMatches([{ id: "m1", leagueId: "il-premier", homeTeamId: "maccabi-haifa", awayTeamId: "beitar-jerusalem", homeScore: 2, awayScore: 1, status: "finished", minute: null, matchTimestamp: new Date().toISOString(), venue: null, round: "1", stats: { possession: [55, 45] }, lineUps: null, externalId: "9", isDemo: false }]);
  await repo.replaceEvents("m1", [{ minute: 10, teamId: "maccabi-haifa", eventType: "goal", playerName: "X", description: "שער" }]);
  assert.equal((await repo.getMatch("m1"))?.events.length, 1);
  await repo.saveRatings("m1", u1.id, [{ playerName: "X", rating: 8 }]);
  await repo.saveRatings("m1", u2.id, [{ playerName: "X", rating: 6, note: "good" }]);
  await repo.saveRatings("m1", u1.id, [{ playerName: "X", rating: 10 }]);
  const sum = await repo.ratingSummary("m1");
  assert.deepEqual(sum, [{ playerName: "X", average: 8, count: 2 }]);
  assert.equal((await repo.userRatings("m1", u2.id)).X.note, "good");
  await assert.rejects(repo.saveRatings("m1", u1.id, [{ playerName: "Y", rating: 11 }]));

  await repo.upsertMatches([{ ...(await repo.getMatch("m1"))!.match, homeScore: 3 }]);
  assert.equal((await repo.getMatch("m1"))!.match.homeScore, 3);
  assert.equal((await repo.headToHead("maccabi-haifa", "beitar-jerusalem", 5)).length, 1);

  await repo.saveDigest({ teamId: "maccabi-haifa", digestDate: "2026-10-24", contentHe: "א", generatedBy: "template" });
  await repo.saveDigest({ teamId: "maccabi-haifa", digestDate: "2026-10-24", contentHe: "ב", generatedBy: "ai" });
  assert.equal((await repo.getDigest("maccabi-haifa", "2026-10-24"))?.contentHe, "ב");
});

test("ingestion store: threads, articles, dedupe, enrichment, vibe, search", async () => {
  const { db, repo } = await setup();
  await seedDatabase(db);
  const tid = await repo.createThread({ titleHe: "מכבי חיפה ניצחה", teamId: "maccabi-haifa", category: "football_israel", signature: "חיפה ניצחה", heroImageUrl: null, publishedAt: new Date().toISOString() });
  const art = { originalTitle: "רעידת אדמה! מכבי חיפה ניצחה", neutralTitle: null, fullText: "טקסט מלא", summary: "תקציר", sourceKey: "ynet", sourceName: "ידיעות ספורט", sourceUrl: "https://www.ynet.co.il/sport/article/1", imageUrl: null, author: null, publishedAt: new Date().toISOString(), category: "football_israel" as const, teamId: "maccabi-haifa", clickbaitScore: 0, isDemo: false };
  await repo.insertArticle(tid, art);
  await repo.insertArticle(tid, art); // duplicate URL is ignored
  await repo.insertArticle(tid, { ...art, sourceKey: "walla", sourceName: "וואלה! ספורט", sourceUrl: "https://sports.walla.co.il/item/1" });
  assert.equal((await repo.existingSourceUrls([art.sourceUrl, "https://nope"])).size, 1);
  const pending = await repo.articlesNeedingAI(10);
  assert.equal(pending.length, 2);
  await repo.updateArticleAI(pending[0].id, { neutralTitle: "מכבי חיפה ניצחה", summary: "ס", clickbaitScore: 70 });
  assert.equal((await repo.articlesNeedingAI(10)).length, 1);
  const thread = (await repo.listThreads({ limit: 5 }))[0];
  assert.equal(thread.articles.length, 2);
  assert.equal((await repo.listThreads({ q: "חיפה", limit: 5 })).length, 1);
  assert.equal((await repo.listThreads({ q: "100%_", limit: 5 })).length, 0);
  assert.equal((await repo.threadsNeedingVibe(5)).length, 1);
  await repo.setThreadVibe(tid, 82, 18);
  assert.equal((await repo.getThread(tid))?.vibeOptimistic, 82);
  const u = await repo.createUser({ email: "c@x.com", displayName: "C", passwordHash: "h", favoriteTeamId: null });
  await repo.castVote(tid, u.id, "worried");
  await repo.castVote(tid, u.id, "optimistic");
  assert.deepEqual(await repo.voteCounts(tid), { optimistic: 1, worried: 0 });
  assert.equal((await repo.clusterCandidates(new Date(Date.now() - 3600_000))).length, 1);
});

test("provider sync replaces opening tables", async () => {
  const { db, repo } = await setup();
  await seedDatabase(db);
  await repo.replaceStandings("il-premier", [{ leagueId: "il-premier", teamId: "maccabi-haifa", played: 5, wins: 4, draws: 1, losses: 0, goalsFor: 9, goalsAgainst: 2, points: 13, form: "WWDWW", isDemo: false }]);
  const t = await repo.getStandings("il-premier");
  assert.equal(t.length, 1);
  assert.equal(t[0].goalDifference, 7);
  await repo.markLeagueSynced("il-premier");
  assert.ok(await repo.getLeagueSyncedAt("il-premier"));
});

test("every repository read used by the pages works on Postgres", async () => {
  const { db, repo } = await setup();
  await seedDatabase(db);
  assert.equal(await repo.lastIngestAt(), null);
  await repo.logIngestRun({ startedAt: new Date(), fetched: 1, inserted: 0, report: { ok: true } });
  assert.ok((await repo.lastIngestAt()) instanceof Date);
  const now = Date.now();
  await repo.upsertMatches([
    { id: "a", leagueId: "epl", homeTeamId: "arsenal", awayTeamId: "chelsea", homeScore: 1, awayScore: 0, status: "second_half", minute: 60, matchTimestamp: new Date(now - 3600_000).toISOString(), venue: null, round: "1", stats: null, lineUps: null, externalId: "x1", isDemo: false },
    { id: "b", leagueId: "epl", homeTeamId: "liverpool", awayTeamId: "arsenal", homeScore: null, awayScore: null, status: "scheduled", minute: null, matchTimestamp: new Date(now + 86400_000).toISOString(), venue: null, round: "2", stats: null, lineUps: null, externalId: null, isDemo: false }
  ]);
  assert.equal((await repo.listMatches({})).length, 2);
  assert.equal((await repo.listMatches({ teamId: "arsenal", status: ["scheduled"], from: new Date(now - 3 * 3600_000), order: "asc", limit: 4 })).length, 1);
  assert.equal((await repo.listMatches({ status: ["first_half", "half_time", "second_half", "extra_time"] })).length, 1);
  assert.equal((await repo.listMatches({ leagueId: "epl", from: new Date(now - 5 * 86400_000), to: new Date(now + 7 * 86400_000) })).length, 2);
  assert.equal((await repo.listMatches({ teamId: "arsenal", status: ["finished"], order: "desc", limit: 5 })).length, 0);
  assert.equal(await repo.getMatch("missing"), null);
  assert.equal((await repo.getTeam("arsenal"))?.nameHe, "ארסנל");
  assert.deepEqual(await repo.listThreads({ limit: 5, teamId: "arsenal" }), []);
  assert.equal(await repo.getThread("00000000-0000-0000-0000-000000000000"), null);
  assert.equal(await repo.getDigest("arsenal", "2026-01-01"), null);
  assert.deepEqual(await repo.voteCounts("00000000-0000-0000-0000-000000000000"), { optimistic: 0, worried: 0 });
  assert.deepEqual(await repo.ratingSummary("a"), []);
  assert.equal((await repo.getStandings("nba")).length, 30);
});
