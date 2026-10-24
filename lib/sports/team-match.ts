import { jaccard, normalize, tokenize } from "@/lib/ai/text";
import type { TeamDTO } from "@/lib/types";

/** Maps provider team names (usually English) onto our team ids. */
export class TeamMatcher {
  private exact = new Map<string, TeamDTO[]>();

  constructor(private readonly teams: TeamDTO[]) {
    for (const t of teams) {
      for (const n of new Set([t.nameEn, t.nameHe, ...t.aliases].map(normalize))) {
        if (n.length < 3) continue;
        this.exact.set(n, [...(this.exact.get(n) ?? []), t]);
      }
    }
  }

  /** Every team whose name/alias equals `name` exactly (football and basketball clubs often share a Hebrew name). */
  findAll(name: string): TeamDTO[] {
    return this.exact.get(normalize(name)) ?? [];
  }

  find(name: string, sport?: "football" | "basketball", leagueHint?: string): TeamDTO | null {
    const n = normalize(name);
    const pool = (list: TeamDTO[]) => {
      const bySport = sport ? list.filter((t) => t.sportType === sport) : list;
      return bySport.find((t) => t.leagueId === leagueHint) ?? bySport[0] ?? null;
    };
    const hit = this.exact.get(n);
    if (hit) return pool(hit);
    const tokens = tokenize(n);
    let best: { t: TeamDTO; s: number } | null = null;
    for (const t of this.teams) {
      if (sport && t.sportType !== sport) continue;
      const s = Math.max(jaccard(tokens, tokenize(t.nameEn)), ...t.aliases.map((a) => jaccard(tokens, tokenize(a))));
      if (s >= 0.6 && (!best || s > best.s)) best = { t, s };
    }
    return best?.t ?? null;
  }
}
