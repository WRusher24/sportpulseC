import type { LeagueDTO, TeamDTO } from "@/lib/types";
import { mapLimit } from "@/lib/util";
import { fetchText } from "@/lib/ingest/http";
import { getSources } from "@/lib/ingest/sources";
import { discoverScoreLinks, makeScrapeContext, parseResults, parseStandingsTables, type ScrapeContext, type ScrapedTable } from "./portal-parse";
import type { ProviderDetail, ProviderMatch, ProviderStanding, SportsProvider } from "./types";

type Snapshot = { at: number; tables: Map<string, ScrapedTable>; results: ProviderMatch[]; errors: string[] };
const g = globalThis as unknown as { __sp_portal?: { snap?: Snapshot; inflight?: Promise<Snapshot> } };
const store = (g.__sp_portal ??= {});
const TTL_MS = 4 * 60_000;

const RANK: Record<ProviderMatch["status"], number> = { scheduled: 0, postponed: 0, finished: 1, first_half: 2, half_time: 2, second_half: 2, extra_time: 2 };
const dayOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(iso));

/**
 * Merges what several portals say about the same fixture. Portals disagree on markup (RTL text order is ambiguous), so the
 * home/away orientation is decided by VOTE across sources; a candidate with the opposite orientation has its score flipped
 * before the most advanced status (live > final > upcoming) is chosen. Never produces two rows for one pairing on one Israel day.
 */
export function mergeCandidates(candidates: ProviderMatch[]): ProviderMatch[] {
  const groups = new Map<string, ProviderMatch[]>();
  for (const m of candidates) {
    const key = `${m.leagueId}|${[m.homeName, m.awayName].sort().join("|")}|${dayOf(m.kickoff)}`;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  const out: ProviderMatch[] = [];
  for (const group of groups.values()) {
    const votes = new Map<string, number>();
    for (const m of group) votes.set(m.homeName, (votes.get(m.homeName) ?? 0) + 1);
    const home = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0]; // ties keep first-seen order
    const aligned = group.map((m) => (m.homeName === home ? m : { ...m, homeName: m.awayName, awayName: m.homeName, homeScore: m.awayScore, awayScore: m.homeScore }));
    const best = aligned.sort((a, b) => RANK[b.status] - RANK[a.status])[0];
    out.push(best);
  }
  return out;
}

/** Crawls every configured portal once: home/section page + up to 5 discovered table/result pages each. */
export async function scrapePortals(ctx: ScrapeContext): Promise<Snapshot> {
  const tables = new Map<string, ScrapedTable>();
  const candidates: ProviderMatch[] = [];
  const errors: string[] = [];

  const sources = getSources();
  await mapLimit(sources, 5, async (source) => {
    const pages: string[] = [];
    try {
      const home = await fetchText(source.listing, { timeoutMs: 10_000 });
      pages.push(home);
      const links = discoverScoreLinks(home, source.listing, 5);
      const fetched = await mapLimit(links, 3, (u) => fetchText(u, { timeoutMs: 10_000 }));
      for (const f of fetched) if (f.ok) pages.push(f.value);
    } catch (e) {
      errors.push(`${source.key}: ${e instanceof Error ? e.message : String(e)}`);
    }
    for (const html of pages) {
      for (const t of parseStandingsTables(html, ctx)) if ((tables.get(t.leagueId)?.rows.length ?? 0) < t.rows.length) tables.set(t.leagueId, t);
      candidates.push(...parseResults(html, ctx));
    }
  });
  return { at: Date.now(), tables, results: mergeCandidates(candidates), errors };
}

/**
 * Free source #2 (automatic fallback): live scores, fixtures and tables scraped from Sport5, ONE, Sport1, Ynet Sport and
 * Walla Sport. Results are cached for 4 minutes per server instance so one crawl serves every league.
 */
export class PortalProvider implements SportsProvider {
  readonly id = "portals" as const;
  readonly liveDirect = false;
  readonly refreshMs = 15 * 60_000;
  private readonly ctx: ScrapeContext;

  constructor(teams: TeamDTO[], leagues: LeagueDTO[]) {
    this.ctx = makeScrapeContext(teams, leagues);
  }

  supports() {
    return true;
  }

  private snapshot(): Promise<Snapshot> {
    if (store.snap && Date.now() - store.snap.at < TTL_MS) return Promise.resolve(store.snap);
    store.inflight ??= scrapePortals(this.ctx)
      .then((s) => (store.snap = s))
      .finally(() => {
        store.inflight = undefined;
      });
    return store.inflight;
  }

  async liveMatches(): Promise<ProviderMatch[]> {
    return (await this.snapshot()).results.filter((m) => m.status === "first_half" || m.status === "second_half" || m.status === "half_time");
  }

  async fixtures(league: LeagueDTO, fromDay: string, toDay: string): Promise<ProviderMatch[]> {
    const from = Date.parse(`${fromDay}T00:00:00Z`) - 86_400_000;
    const to = Date.parse(`${toDay}T23:59:59Z`) + 86_400_000;
    return (await this.snapshot()).results.filter((m) => m.leagueId === league.id && Date.parse(m.kickoff) >= from && Date.parse(m.kickoff) <= to);
  }

  async standings(league: LeagueDTO): Promise<ProviderStanding[]> {
    return (await this.snapshot()).tables.get(league.id)?.rows ?? [];
  }

  async detail(): Promise<ProviderDetail | null> {
    return null;
  }
}
