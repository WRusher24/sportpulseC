import type { LeagueDTO, MatchStatus } from "@/lib/types";
import { getJson } from "./http";
import type { ProviderDetail, ProviderMatch, ProviderStanding, SportsProvider } from "./types";

/**
 * Free source #1: ESPN's public (unofficial, key-less) JSON endpoints. No registration or subscription.
 * Covers the leagues ESPN publishes; leagues without a slug (Israeli competitions, EuroLeague) fall through to the portal scraper.
 */
const SITE = "https://site.api.espn.com/apis/site/v2/sports";
const STANDINGS = "https://site.api.espn.com/apis/v2/sports";

export const ESPN_PATHS: Record<string, string> = {
  epl: "soccer/eng.1",
  laliga: "soccer/esp.1",
  ucl: "soccer/uefa.champions",
  nba: "basketball/nba"
};

type EspnEvent = {
  id: string;
  date: string;
  competitions?: Array<{
    venue?: { fullName?: string };
    competitors?: Array<{ homeAway: "home" | "away"; score?: string; team?: { displayName?: string } }>;
    status?: { displayClock?: string; period?: number; type?: { name?: string; state?: string } };
  }>;
  season?: { slug?: string };
  week?: { number?: number };
};

const yyyymmdd = (day: string) => day.replace(/-/g, "");

export function mapEspnStatus(name: string | undefined, state: string | undefined, period: number | undefined, basketball: boolean): MatchStatus {
  const n = (name ?? "").toUpperCase();
  if (n.includes("POSTPONED") || n.includes("CANCEL") || n.includes("SUSPENDED") || n.includes("ABANDON")) return "postponed";
  if (state === "post" || n.includes("FINAL") || n.includes("FULL_TIME")) return "finished";
  if (state === "pre" || n.includes("SCHEDULED")) return "scheduled";
  if (n.includes("HALFTIME") || n.includes("HALF_TIME")) return "half_time";
  if (n.includes("EXTRA") || n.includes("OVERTIME") || n.includes("SHOOTOUT")) return "extra_time";
  if (basketball) return (period ?? 1) <= 2 ? "first_half" : (period ?? 1) <= 4 ? "second_half" : "extra_time";
  return (period ?? 1) <= 1 ? "first_half" : (period ?? 2) === 2 ? "second_half" : "extra_time";
}

export function mapEspnEvent(e: EspnEvent, leagueId: string, basketball: boolean): ProviderMatch | null {
  const comp = e.competitions?.[0];
  const home = comp?.competitors?.find((c) => c.homeAway === "home");
  const away = comp?.competitors?.find((c) => c.homeAway === "away");
  if (!comp || !home?.team?.displayName || !away?.team?.displayName) return null;
  const status = mapEspnStatus(comp.status?.type?.name, comp.status?.type?.state, comp.status?.period, basketball);
  const score = (s?: string) => (status === "scheduled" || s === undefined || s === "" ? null : Number.parseInt(s, 10));
  const minute = Number.parseInt(comp.status?.displayClock ?? "", 10);
  return {
    externalId: `espn-${e.id}`,
    leagueExternalId: null,
    leagueId,
    homeName: home.team.displayName,
    awayName: away.team.displayName,
    homeScore: score(home.score),
    awayScore: score(away.score),
    status,
    minute: !basketball && Number.isFinite(minute) && (status === "first_half" || status === "second_half" || status === "extra_time") ? minute : null,
    kickoff: new Date(e.date).toISOString(),
    venue: comp.venue?.fullName ?? null,
    round: e.week?.number ? `מחזור ${e.week.number}` : null
  };
}

type Stat = { name?: string; value?: number };
type Entry = { team?: { displayName?: string }; stats?: Stat[] };

export function mapEspnStandings(root: { children?: Array<{ standings?: { entries?: Entry[] } }>; standings?: { entries?: Entry[] } }, basketball: boolean): ProviderStanding[] {
  const entries = root.standings?.entries ?? root.children?.flatMap((c) => c.standings?.entries ?? []) ?? [];
  return entries.flatMap((en): ProviderStanding[] => {
    const name = en.team?.displayName;
    if (!name) return [];
    const stat = (...keys: string[]) => en.stats?.find((s) => s.name && keys.includes(s.name))?.value;
    const wins = stat("wins") ?? 0;
    const losses = stat("losses") ?? 0;
    const draws = stat("ties", "draws") ?? 0;
    return [
      {
        teamName: name,
        played: stat("gamesPlayed") ?? wins + draws + losses,
        wins,
        draws,
        losses,
        goalsFor: stat("pointsFor") ?? 0,
        goalsAgainst: stat("pointsAgainst") ?? 0,
        points: basketball ? wins : (stat("points") ?? wins * 3 + draws),
        form: ""
      }
    ];
  });
}

export class EspnProvider implements SportsProvider {
  readonly id = "espn" as const;
  readonly liveDirect = false;
  readonly refreshMs = 20 * 60_000;

  supports(league: LeagueDTO) {
    return league.id in ESPN_PATHS;
  }

  private async scoreboard(league: LeagueDTO, from: string, to: string): Promise<ProviderMatch[]> {
    const path = ESPN_PATHS[league.id];
    if (!path) return [];
    const basketball = league.sportType === "basketball";
    const data = await getJson<{ events?: EspnEvent[] }>(`${SITE}/${path}/scoreboard?dates=${yyyymmdd(from)}-${yyyymmdd(to)}&limit=300`, {}, 60);
    return (data.events ?? []).flatMap((e) => mapEspnEvent(e, league.id, basketball) ?? []);
  }

  async liveMatches(leagues: LeagueDTO[]): Promise<ProviderMatch[]> {
    const today = new Date().toISOString().slice(0, 10);
    const out = await Promise.all(leagues.filter((l) => this.supports(l)).map((l) => this.scoreboard(l, today, today).catch(() => [])));
    return out.flat().filter((m) => m.status !== "scheduled" && m.status !== "finished" && m.status !== "postponed");
  }

  fixtures(league: LeagueDTO, fromDay: string, toDay: string) {
    return this.scoreboard(league, fromDay, toDay);
  }

  async standings(league: LeagueDTO): Promise<ProviderStanding[]> {
    const path = ESPN_PATHS[league.id];
    if (!path) return [];
    return mapEspnStandings(await getJson(`${STANDINGS}/${path}/standings`, {}, 300), league.sportType === "basketball");
  }

  async detail(): Promise<ProviderDetail | null> {
    return null;
  }
}
