import type { EventType, LeagueDTO, LineupPlayer, MatchStats, MatchStatus } from "@/lib/types";
import { getJson } from "./http";
import type { ProviderDetail, ProviderEvent, ProviderMatch, ProviderStanding, SportsProvider } from "./types";

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

type Summary = {
  keyEvents?: Array<{ type?: { text?: string; type?: string }; clock?: { displayValue?: string }; team?: { displayName?: string }; participants?: Array<{ athlete?: { displayName?: string } }>; text?: string; shortText?: string }>;
  boxscore?: { teams?: Array<{ homeAway?: "home" | "away"; team?: { displayName?: string }; statistics?: Array<{ name?: string; displayValue?: string }> }> };
  rosters?: Array<{ homeAway?: "home" | "away"; team?: { displayName?: string }; formation?: string; roster?: Array<{ starter?: boolean; jersey?: string; athlete?: { displayName?: string }; position?: { abbreviation?: string } }> }>;
};

/** "45'+2'" -> 47, "67'" -> 67 */
const parseClock = (v?: string): number | null => {
  const m = /(\d+)'?(?:\s*\+\s*(\d+))?/.exec(v ?? "");
  return m ? Number(m[1]) + Number(m[2] ?? 0) : null;
};

export function mapEspnSummary(sum: Summary): ProviderDetail | null {
  const events: ProviderEvent[] = (sum.keyEvents ?? []).flatMap((e): ProviderEvent[] => {
    const text = `${e.type?.text ?? ""} ${e.type?.type ?? ""}`.toLowerCase();
    const minute = parseClock(e.clock?.displayValue);
    if (minute === null || !e.team?.displayName) return [];
    const names = (e.participants ?? []).map((p) => p.athlete?.displayName).filter((n): n is string => Boolean(n));
    let eventType: EventType | null = null;
    let description: string | null = null;
    if (text.includes("own goal")) [eventType, description] = ["goal", "שער עצמי"];
    else if (text.includes("penalty") && text.includes("scored")) [eventType, description] = ["goal", "פנדל"];
    else if (text.includes("goal") && !text.includes("disallow")) [eventType, description] = ["goal", names[1] ? `בישול: ${names[1]}` : "שער"];
    else if (text.includes("red card")) [eventType, description] = ["card", "כרטיס אדום"];
    else if (text.includes("yellow card")) [eventType, description] = ["card", "כרטיס צהוב"];
    else if (text.includes("substitution")) [eventType, description] = ["substitution", names[1] ? `חילוף: ${names[0]} ↔ ${names[1]}` : "חילוף"];
    else if (text.includes("var")) [eventType, description] = ["var", `בדיקת VAR${e.shortText ? ` – ${e.shortText}` : ""}`];
    return eventType ? [{ minute, teamName: e.team.displayName, eventType, playerName: names[0] ?? "—", description }] : [];
  });

  let stats: MatchStats | null = null;
  const teams = sum.boxscore?.teams ?? [];
  const home = teams.find((t) => t.homeAway === "home");
  const away = teams.find((t) => t.homeAway === "away");
  if (home && away) {
    const val = (t: typeof home, ...names: string[]) => {
      const raw = t.statistics?.find((s) => s.name && names.includes(s.name))?.displayValue;
      return raw === undefined ? undefined : Number.parseFloat(raw);
    };
    const pair = (...names: string[]): [number, number] | undefined => {
      const a = val(home, ...names);
      const b = val(away, ...names);
      return a === undefined || b === undefined || Number.isNaN(a) || Number.isNaN(b) ? undefined : [a, b];
    };
    const pass = pair("passPct");
    const built: MatchStats = {
      possession: pair("possessionPct"),
      shots: pair("totalShots"),
      shotsOnTarget: pair("shotsOnTarget"),
      corners: pair("wonCorners"),
      offsides: pair("offsides"),
      fouls: pair("foulsCommitted"),
      // ESPN reports pass accuracy as a 0-1 fraction
      passAccuracy: pass ? (pass.map((v) => (v <= 1 ? Math.round(v * 100) : Math.round(v))) as [number, number]) : undefined
    };
    for (const [k, v] of Object.entries(built)) if (v) (stats ??= {})[k as keyof MatchStats] = v;
  }

  let lineUps: ProviderDetail["lineUps"] = null;
  const rh = sum.rosters?.find((r) => r.homeAway === "home");
  const ra = sum.rosters?.find((r) => r.homeAway === "away");
  if (rh?.roster?.length && ra?.roster?.length && rh.team?.displayName && ra.team?.displayName) {
    const side = (r: NonNullable<typeof rh>) => ({
      teamName: r.team?.displayName as string,
      formation: r.formation ?? null,
      coach: null,
      players: (r.roster ?? []).flatMap((p): LineupPlayer[] => (p.athlete?.displayName ? [{ name: p.athlete.displayName, number: p.jersey ? Number(p.jersey) || null : null, position: p.position?.abbreviation ?? null, starter: Boolean(p.starter) }] : []))
    });
    lineUps = { home: side(rh), away: side(ra) };
  }
  return events.length || stats || lineUps ? { events, stats, lineUps } : null;
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
    const data = await getJson<{ events?: EspnEvent[] }>(`${SITE}/${path}/scoreboard?dates=${yyyymmdd(from)}-${yyyymmdd(to)}&limit=300`, {}, 0);
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
    return mapEspnStandings(await getJson(`${STANDINGS}/${path}/standings`, {}, 0), league.sportType === "basketball");
  }

  async detail(league: LeagueDTO, externalId: string): Promise<ProviderDetail | null> {
    const path = ESPN_PATHS[league.id];
    if (!path || league.sportType !== "football" || !externalId.startsWith("espn-")) return null;
    return mapEspnSummary(await getJson<Summary>(`${SITE}/${path}/summary?event=${encodeURIComponent(externalId.slice(5))}`, {}, 0));
  }
}
