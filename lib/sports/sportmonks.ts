import type { EventType, LeagueDTO, MatchStatus } from "@/lib/types";
import { getJson } from "./http";
import type { ProviderDetail, ProviderEvent, ProviderMatch, ProviderStanding, SportsProvider } from "./types";

/**
 * Sportmonks football v3 adapter. Covers live scores, fixtures and match events; standings/lineups depend on the
 * subscription tier and season ids, so this adapter returns none and the league keeps its last known table.
 */
const BASE = "https://api.sportmonks.com/v3/football";

const STATE: Record<string, MatchStatus> = {
  NS: "scheduled", TBA: "scheduled", INPLAY_1ST_HALF: "first_half", "1ST_HALF": "first_half", HT: "half_time", INPLAY_2ND_HALF: "second_half", "2ND_HALF": "second_half",
  INPLAY_ET: "extra_time", ET: "extra_time", BREAK: "half_time", FT: "finished", AET: "finished", FT_PEN: "finished", POSTP: "postponed", CANCL: "postponed", ABAN: "postponed"
};

const EVENT_TYPE: Record<number, { type: EventType; label: string }> = {
  14: { type: "goal", label: "שער" },
  15: { type: "goal", label: "שער עצמי" },
  16: { type: "goal", label: "פנדל" },
  18: { type: "substitution", label: "חילוף" },
  19: { type: "card", label: "כרטיס צהוב" },
  20: { type: "card", label: "כרטיס אדום" },
  21: { type: "card", label: "כרטיס צהוב שני" },
  10: { type: "var", label: "בדיקת VAR" }
};

type Participant = { id: number; name: string; meta?: { location?: string } };
type Fixture = {
  id: number;
  league_id: number;
  name?: string;
  starting_at: string;
  round?: { name?: string } | null;
  venue?: { name?: string } | null;
  state?: { short_name?: string; state?: string } | null;
  participants?: Participant[];
  scores?: Array<{ description: string; score: { goals: number; participant: string } }>;
  periods?: Array<{ ticking: boolean; minutes: number | null }>;
  events?: Array<{ minute: number; extra_minute?: number | null; type_id: number; player_name?: string | null; participant_id: number; addition?: string | null; related_player_name?: string | null }>;
};

const utc = (s: string) => new Date(s.replace(" ", "T") + (s.endsWith("Z") ? "" : "Z")).toISOString();

export class SportmonksProvider implements SportsProvider {
  readonly id = "sportmonks" as const;
  readonly liveDirect = true;
  readonly refreshMs = 6 * 3_600_000;

  supports(league: LeagueDTO) {
    return Boolean(league.sportmonksId);
  }

  constructor(private readonly token: string) {}

  private get<T>(path: string, params: Record<string, string>, revalidate: number) {
    const qs = new URLSearchParams({ ...params, api_token: this.token });
    return getJson<{ data?: T[] }>(`${BASE}${path}?${qs}`, {}, revalidate);
  }

  private map(f: Fixture): ProviderMatch | null {
    const home = f.participants?.find((p) => p.meta?.location === "home");
    const away = f.participants?.find((p) => p.meta?.location === "away");
    if (!home || !away) return null;
    const goals = (side: "home" | "away") => f.scores?.filter((s) => s.description === "CURRENT" && s.score.participant === side).reduce((n, s) => s.score.goals, 0) ?? null;
    const status = STATE[f.state?.short_name ?? ""] ?? STATE[f.state?.state ?? ""] ?? "scheduled";
    const ticking = f.periods?.find((p) => p.ticking);
    return {
      externalId: String(f.id),
      leagueExternalId: f.league_id,
      homeName: home.name,
      awayName: away.name,
      homeScore: status === "scheduled" ? null : goals("home"),
      awayScore: status === "scheduled" ? null : goals("away"),
      status,
      minute: ticking?.minutes ?? null,
      kickoff: utc(f.starting_at),
      venue: f.venue?.name ?? null,
      round: f.round?.name ?? null
    };
  }

  async liveMatches(leagues: LeagueDTO[]): Promise<ProviderMatch[]> {
    const ids = new Set(leagues.map((l) => l.sportmonksId).filter(Boolean));
    const r = await this.get<Fixture>("/livescores/inplay", { include: "participants;scores;state;periods" }, 15);
    return (r.data ?? []).filter((f) => ids.size === 0 || ids.has(f.league_id)).flatMap((f) => this.map(f) ?? []);
  }

  async fixtures(league: LeagueDTO, fromDay: string, toDay: string): Promise<ProviderMatch[]> {
    if (!league.sportmonksId) return [];
    const r = await this.get<Fixture>(`/fixtures/between/${fromDay}/${toDay}`, { include: "participants;scores;state;venue;round", filters: `fixtureLeagues:${league.sportmonksId}` }, 300);
    return (r.data ?? []).flatMap((f) => this.map(f) ?? []);
  }

  async standings(): Promise<ProviderStanding[]> {
    return [];
  }

  async detail(_league: LeagueDTO, externalId: string): Promise<ProviderDetail | null> {
    const r = await this.get<Fixture>(`/fixtures/${externalId}`, { include: "events;participants" }, 30).catch(() => null);
    const f = r?.data as unknown as Fixture | undefined;
    if (!f?.events) return null;
    const nameOf = (id: number) => f.participants?.find((p) => p.id === id)?.name ?? "";
    const events: ProviderEvent[] = f.events.flatMap((e): ProviderEvent[] => {
      const t = EVENT_TYPE[e.type_id];
      if (!t) return [];
      return [{ minute: e.minute + (e.extra_minute ?? 0), teamName: nameOf(e.participant_id), eventType: t.type, playerName: e.player_name ?? "—", description: e.addition ? `${t.label} (${e.addition})` : t.label }];
    });
    return { events, stats: null, lineUps: null };
  }
}
