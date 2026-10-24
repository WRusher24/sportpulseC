import type { LeagueDTO } from "@/lib/types";
import type { ProviderDetail, ProviderMatch, ProviderStanding, SportsProvider } from "./types";

/** Tries providers in order and returns the first non-empty answer, so a missing source never breaks the app. */
export class ChainProvider implements SportsProvider {
  readonly id = "auto" as const;
  readonly liveDirect: boolean;
  readonly refreshMs: number;

  constructor(private readonly chain: SportsProvider[]) {
    this.liveDirect = chain.some((p) => p.liveDirect);
    this.refreshMs = Math.min(...chain.map((p) => p.refreshMs));
  }

  supports(league: LeagueDTO) {
    return this.chain.some((p) => p.supports(league));
  }

  async liveMatches(leagues: LeagueDTO[]): Promise<ProviderMatch[]> {
    const all = await Promise.all(this.chain.map((p) => p.liveMatches(leagues.filter((l) => p.supports(l))).catch(() => [] as ProviderMatch[])));
    const seen = new Set<string>();
    return all.flat().filter((m) => {
      const key = `${m.leagueId ?? m.leagueExternalId}|${m.homeName}|${m.awayName}|${m.kickoff.slice(0, 10)}`.toLowerCase();
      return seen.has(key) ? false : (seen.add(key), true);
    });
  }

  private async first<T>(league: LeagueDTO, run: (p: SportsProvider) => Promise<T[]>): Promise<T[]> {
    for (const p of this.chain) {
      if (!p.supports(league)) continue;
      try {
        const r = await run(p);
        if (r.length > 0) return r;
      } catch (e) {
        console.warn(`[sports] ${p.id} failed for ${league.id}:`, e instanceof Error ? e.message : e);
      }
    }
    return [];
  }

  fixtures(league: LeagueDTO, from: string, to: string) {
    return this.first(league, (p) => p.fixtures(league, from, to));
  }

  standings(league: LeagueDTO) {
    return this.first(league, (p) => p.standings(league));
  }

  async detail(league: LeagueDTO, externalId: string): Promise<ProviderDetail | null> {
    for (const p of this.chain) {
      if (!p.supports(league)) continue;
      const d = await p.detail(league, externalId).catch(() => null);
      if (d) return d;
    }
    return null;
  }
}
