import { analyzeVibes } from "@/lib/ai/vibe";
import { neutralizeBatch } from "@/lib/ai/neutralize";
import { firstSentences } from "@/lib/ai/text";
import type { Repo } from "@/lib/data/repo";
import type { Credentials } from "@/lib/server/credentials";
import { chunk, mapLimit } from "@/lib/util";
import { buildAliasIndex, detectCategory, detectTeam } from "./classify";
import { articleTokens, buildSignature, findThread } from "./cluster";
import { extractArticle, linksFromListing } from "./extract";
import { fetchFeed, type FeedItem } from "./feed";
import { fetchText } from "./http";
import { getSources, type SourceConfig } from "./sources";

export type SourceReport = { source: string; feed: string | null; discovered: number; fresh: number; inserted: number; errors: string[] };
export type IngestReport = {
  startedAt: string;
  durationMs: number;
  fetched: number;
  inserted: number;
  enriched: number;
  vibes: number;
  sources: SourceReport[];
};

export type IngestOptions = {
  repo: Repo;
  creds: Credentials;
  /** Total wall-clock budget; stages stop early to stay inside the serverless function limit. */
  budgetMs?: number;
  maxPerSource?: number;
  maxEnrich?: number;
  sources?: SourceConfig[];
};

async function discover(source: SourceConfig): Promise<{ items: FeedItem[]; feed: string | null; errors: string[] }> {
  const feed = await fetchFeed(source);
  if (feed.items.length > 0) return { items: feed.items, feed: feed.feedUrl, errors: feed.errors };
  try {
    const html = await fetchText(source.listing);
    const items: FeedItem[] = linksFromListing(html, source.listing, source.articleUrl).map((l) => ({
      sourceKey: source.key,
      title: l.title,
      url: l.url,
      publishedAt: new Date().toISOString(),
      description: "",
      imageUrl: null,
      author: null
    }));
    return { items, feed: null, errors: [...feed.errors, ...(items.length === 0 ? [`${source.listing}: no article links matched`] : [])] };
  } catch (e) {
    return { items: [], feed: null, errors: [...feed.errors, `${source.listing}: ${e instanceof Error ? e.message : String(e)}`] };
  }
}

/**
 * Full ingestion cycle (runs every 5 minutes from Vercel Cron):
 * discover (RSS, with HTML listing fallback) -> dedupe by URL -> extract & sanitize full text -> classify team/category ->
 * cluster into master threads -> AI enrichment (neutral titles, TL;DR, vibe).
 */
export async function runIngestion(opts: IngestOptions): Promise<IngestReport> {
  const started = Date.now();
  const deadline = started + (opts.budgetMs ?? 50_000);
  const { repo } = opts;
  const sources = opts.sources ?? getSources();
  const perSource = opts.maxPerSource ?? 10;

  const teams = await repo.listTeams();
  const aliasIndex = buildAliasIndex(teams);
  const reports: SourceReport[] = [];
  let fetched = 0;
  let inserted = 0;

  const discovered = await mapLimit(sources, 5, (s) => discover(s));
  const work: Array<{ source: SourceConfig; item: FeedItem }> = [];
  for (let i = 0; i < sources.length; i++) {
    const r = discovered[i];
    const source = sources[i];
    if (!r.ok) {
      reports.push({ source: source.key, feed: null, discovered: 0, fresh: 0, inserted: 0, errors: [String(r.error)] });
      continue;
    }
    const items = r.value.items.slice(0, 40);
    const known = await repo.existingSourceUrls(items.map((x) => x.url));
    const fresh = items
      .filter((x) => !known.has(x.url))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, perSource);
    fetched += items.length;
    reports.push({ source: source.key, feed: r.value.feed, discovered: items.length, fresh: fresh.length, inserted: 0, errors: r.value.errors });
    for (const item of fresh) work.push({ source, item });
  }

  // Stage 2: full text extraction (bounded concurrency, per-article failure isolation).
  const extracted = await mapLimit(work, 5, async ({ source, item }) => {
    if (Date.now() > deadline - 12_000) throw new Error("time budget exhausted");
    const html = await fetchText(item.url);
    return extractArticle(html, item.url, source);
  });

  // Stage 3: classify, cluster and persist sequentially (clustering depends on previously inserted threads).
  const candidates = await repo.clusterCandidates(new Date(Date.now() - 48 * 3_600_000));
  for (let i = 0; i < work.length; i++) {
    if (Date.now() > deadline - 6_000) break;
    const { source, item } = work[i];
    const report = reports.find((r) => r.source === source.key) as SourceReport;
    const ex = extracted[i];
    const page = ex.ok ? ex.value : null;
    if (!ex.ok) report.errors.push(`${item.url}: ${ex.error instanceof Error ? ex.error.message : String(ex.error)}`);

    const fullText = page?.text && page.text.length > 120 ? page.text : item.description;
    if (!fullText || fullText.length < 40) continue;
    const title = item.title;
    const publishedAt = item.publishedAt || page?.publishedAt || new Date().toISOString();
    const team = detectTeam(aliasIndex, title, fullText);
    const category = detectCategory(team, title, fullText);
    const imageUrl = page?.imageUrl ?? item.imageUrl;
    const tokens = articleTokens(title, fullText);

    const match = findThread(candidates, { title, leadText: fullText, teamId: team?.id ?? null, category, publishedAt });
    let threadId: string;
    if (match) {
      threadId = match.id;
      const cand = candidates.find((c) => c.id === threadId) as (typeof candidates)[number];
      cand.signature = buildSignature(cand.signature, tokens.all);
      if (publishedAt > cand.lastPublishedAt) cand.lastPublishedAt = publishedAt;
      await repo.refreshThread(threadId, { signature: cand.signature, heroImageUrl: imageUrl });
    } else {
      const signature = buildSignature("", tokens.all);
      threadId = await repo.createThread({ titleHe: title, teamId: team?.id ?? null, category, signature, heroImageUrl: imageUrl, publishedAt });
      candidates.push({ id: threadId, signature, teamId: team?.id ?? null, category, lastPublishedAt: publishedAt, titleHe: title });
    }

    await repo.insertArticle(threadId, {
      originalTitle: title,
      neutralTitle: null,
      fullText,
      summary: firstSentences(fullText, 220),
      sourceKey: source.key,
      sourceName: source.nameHe,
      sourceUrl: page?.canonicalUrl && new URL(page.canonicalUrl).host === new URL(item.url).host ? page.canonicalUrl : item.url,
      imageUrl,
      author: page?.author ?? item.author,
      publishedAt,
      category,
      teamId: team?.id ?? null,
      clickbaitScore: 0,
      isDemo: false
    });
    report.inserted++;
    inserted++;
  }

  const enriched = await enrich(opts, deadline);
  const vibes = await vibe(opts, deadline);

  const startedAt = new Date(started);
  const report: IngestReport = { startedAt: startedAt.toISOString(), durationMs: Date.now() - started, fetched, inserted, enriched, vibes, sources: reports };
  await repo.logIngestRun({ startedAt, fetched, inserted, report: report as unknown as Record<string, unknown> });
  return report;
}

/** Anti-clickbait + TL;DR for articles that have not been processed yet. */
export async function enrich(opts: Pick<IngestOptions, "repo" | "creds" | "maxEnrich">, deadline = Date.now() + 40_000): Promise<number> {
  const pending = await opts.repo.articlesNeedingAI(opts.maxEnrich ?? 18);
  let done = 0;
  for (const batch of chunk(pending, 6)) {
    if (Date.now() > deadline - 4_000) break;
    const results = await neutralizeBatch(opts.creds.ai, batch.map((a) => ({ id: a.id, title: a.originalTitle, text: a.fullText })));
    for (const a of batch) {
      const r = results.get(a.id);
      if (!r) continue;
      await opts.repo.updateArticleAI(a.id, { neutralTitle: r.neutralTitle, summary: r.summary || a.summary, clickbaitScore: r.clickbaitScore });
      done++;
      if (a.threadId) {
        const thread = await opts.repo.getThread(a.threadId);
        const earliest = thread?.articles.slice().sort((x, y) => x.publishedAt.localeCompare(y.publishedAt))[0];
        if (earliest?.id === a.id) await opts.repo.refreshThread(a.threadId, { titleHe: r.neutralTitle });
      }
    }
  }
  return done;
}

export async function vibe(opts: Pick<IngestOptions, "repo" | "creds">, deadline = Date.now() + 40_000): Promise<number> {
  if (Date.now() > deadline - 4_000) return 0;
  const threads = await opts.repo.threadsNeedingVibe(10);
  const scores = await analyzeVibes(opts.creds.ai, threads);
  for (const [id, optimistic] of scores) await opts.repo.setThreadVibe(id, optimistic, 100 - optimistic);
  return scores.size;
}
