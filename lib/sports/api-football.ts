import type { EventType, LeagueDTO, LineupPlayer, MatchStats, MatchStatus } from "@/lib/types";
import { getJson, seasonStartYear } from "./http";
import type { ProviderDetail, ProviderEvent, ProviderMatch, ProviderStanding, SportsProvider } from "./types";

/** API-Sports (api-football.com) adapter: v3 football + v1 basketball. */

const FOOTBALL = "https://v3.football.api-sports.io";
const BASKETBALL = "https://v1.basketball.api-sports.io";

const FOOTBALL_STATUS: Record<string, MatchStatus> = {
  TBD: "scheduled", NS: "scheduled", "1H": "first_half", HT: "half_time", "2H": "second_half", ET: "extra_time", BT: "extra_time", P: "extra_time",
  LIVE: "first_half", INT: "half_time", SUSP: "half_time", FT: "finished", AET: "finished", PEN: "finished", AWD: "finished", WO: "finished",
  PST: "postponed", CANC: "postponed", ABD: "postponed"
};
const BASKET_STATUS: Record<string, MatchStatus> = {
  NS: "scheduled", Q1: "first_half", Q2: "first_half", BT: "half_time", HT: "half_time", Q3: "second_half", Q4: "second_half", OT: "extra_time",
  FT: "finished", AOT: "finished", POST: "postponed", CANC: "postponed", SUSP: "postponed", AWD: "finished", ABD: "postponed"
};

type FootballFixture = {
  fixture: { id: number; date: string; venue?: { name?: string | null }; status: { short: string; elapsed: number | null } };
  league: { id: number; round?: string };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
};
type BasketGame = {
  id: number;
  date: string;
  status: { short: string; timer?: string | null };
  league: { id: number };
  teams: { home: { name: string }; away: { name: string } };
  scores: { home: { total: number | null }; away: { total: number | null } };
  week?: string | null;
  stage?: string | null;
};

const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number.parseFloat(v.replace("%", "")) || 0;
  return 0;
};

export class ApiFootballProvider implements SportsProvider {
  readonly id = "api-football" as const;
  readonly liveDirect = true;
  readonly refreshMs = 6 * 3_600_000;

  supports(league: LeagueDTO) {
    return Boolean(league.apiFootballId || league.apiBasketballId);
  }

  constructor(
    private readonly footballKey: string | null,
    private readonly basketballKey: string | null
  ) {}

  private football<T>(path: string, revalidate = 0) {
    if (!this.footballKey) return Promise.resolve({ response: [] as T[] });
    return getJson<{ response: T[] }>(`${FOOTBALL}${path}`, { "x-apisports-key": this.footballKey }, revalidate);
  }

  private basket<T>(path: string, revalidate = 0) {
    if (!this.basketballKey) return Promise.resolve({ response: [] as T[] });
    return getJson<{ response: T[] }>(`${BASKETBALL}${path}`, { "x-apisports-key": this.basketballKey }, revalidate);
  }

  private mapFootball(f: FootballFixture): ProviderMatch {
    return {
      externalId: String(f.fixture.id),
      leagueExternalId: f.league.id,
      homeName: f.teams.home.name,
      awayName: f.teams.away.name,
      homeScore: f.goals.home,
      awayScore: f.goals.away,
      status: FOOTBALL_STATUS[f.fixture.status.short] ?? "scheduled",
      minute: f.fixture.status.elapsed,
      kickoff: new Date(f.fixture.date).toISOString(),
      venue: f.fixture.venue?.name ?? null,
      round: f.league.round ?? null
    };
  }

  private mapBasket(g: BasketGame): ProviderMatch {
    return {
      externalId: String(g.id),
      leagueExternalId: g.league.id,
      homeName: g.teams.home.name,
      awayName: g.teams.away.name,
      homeScore: g.scores.home.total,
      awayScore: g.scores.away.total,
      status: BASKET_STATUS[g.status.short] ?? "scheduled",
      minute: g.status.timer ? Number.parseInt(g.status.timer, 10) || null : null,
      kickoff: new Date(g.date).toISOString(),
      venue: null,
      round: g.week ?? g.stage ?? null
    };
  }

  async liveMatches(leagues: LeagueDTO[]): Promise<ProviderMatch[]> {
    const fIds = leagues.filter((l) => l.apiFootballId).map((l) => l.apiFootballId);
    const bIds = new Set(leagues.filter((l) => l.apiBasketballId).map((l) => l.apiBasketballId));
    const [f, b] = await Promise.all([
      fIds.length ? this.football<FootballFixture>(`/fixtures?live=${fIds.join("-")}`, 15) : Promise.resolve({ response: [] as FootballFixture[] }),
      bIds.size ? this.basket<BasketGame>("/games?live=all", 15) : Promise.resolve({ response: [] as BasketGame[] })
    ]);
    return [...f.response.map((x) => this.mapFootball(x)), ...b.response.filter((g) => bIds.has(g.league.id)).map((g) => this.mapBasket(g))];
  }

  async fixtures(league: LeagueDTO, fromDay: string, toDay: string): Promise<ProviderMatch[]> {
    const year = seasonStartYear(league.season);
    if (league.apiFootballId) {
      const r = await this.football<FootballFixture>(`/fixtures?league=${league.apiFootballId}&season=${year}&from=${fromDay}&to=${toDay}`, 0);
      return r.response.map((x) => this.mapFootball(x));
    }
    if (league.apiBasketballId) {
      const days: string[] = [];
      for (let t = Date.parse(fromDay); t <= Date.parse(toDay) && days.length < 14; t += 86_400_000) days.push(new Date(t).toISOString().slice(0, 10));
      const out: ProviderMatch[] = [];
      for (const d of days) {
        const r = await this.basket<BasketGame>(`/games?league=${league.apiBasketballId}&season=${year}-${year + 1}&date=${d}`, 0);
        out.push(...r.response.map((g) => this.mapBasket(g)));
      }
      return out;
    }
    return [];
  }

  async standings(league: LeagueDTO): Promise<ProviderStanding[]> {
    const year = seasonStartYear(league.season);
    if (league.apiFootballId) {
      type Row = { team: { name: string }; points: number; form?: string | null; all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } } };
      const r = await this.football<{ league: { standings: Row[][] } }>(`/standings?league=${league.apiFootballId}&season=${year}`, 0);
      const rows = r.response[0]?.league.standings.flat() ?? [];
      return rows.map((x) => ({
        teamName: x.team.name,
        played: x.all.played,
        wins: x.all.win,
        draws: x.all.draw,
        losses: x.all.lose,
        goalsFor: x.all.goals.for,
        goalsAgainst: x.all.goals.against,
        points: x.points,
        form: (x.form ?? "").slice(-5)
      }));
    }
    if (league.apiBasketballId) {
      type Row = { team: { name: string }; games: { played: number; win: { total: number }; lose: { total: number } }; points: { for: number; against: number } };
      const r = await this.basket<Row[]>(`/standings?league=${league.apiBasketballId}&season=${year}-${year + 1}`, 0);
      const rows = (r.response[0] ?? []) as Row[];
      return rows.map((x) => ({
        teamName: x.team.name,
        played: x.games.played,
        wins: x.games.win.total,
        draws: 0,
        losses: x.games.lose.total,
        goalsFor: x.points.for,
        goalsAgainst: x.points.against,
        points: league.id === "nba" ? x.games.win.total : x.games.win.total * 2 + x.games.lose.total,
        form: ""
      }));
    }
    return [];
  }

  async detail(league: LeagueDTO, externalId: string): Promise<ProviderDetail | null> {
    if (!league.apiFootballId) return null;
    type Ev = { time: { elapsed: number; extra?: number | null }; team: { name: string }; player: { name: string | null }; assist: { name: string | null }; type: string; detail: string };
    type St = { team: { name: string }; statistics: Array<{ type: string; value: string | number | null }> };
    type Lu = { team: { name: string }; coach?: { name?: string | null }; formation?: string | null; startXI: Array<{ player: { name: string; number: number | null; pos: string | null } }>; substitutes: Array<{ player: { name: string; number: number | null; pos: string | null } }> };
    const [ev, st, lu] = await Promise.all([
      this.football<Ev>(`/fixtures/events?fixture=${externalId}`, 0),
      this.football<St>(`/fixtures/statistics?fixture=${externalId}`, 0),
      this.football<Lu>(`/fixtures/lineups?fixture=${externalId}`, 0)
    ]);

    const events: ProviderEvent[] = ev.response.flatMap((e): ProviderEvent[] => {
      const t = e.type.toLowerCase();
      let eventType: EventType | null = null;
      let description: string | null = e.detail;
      if (t === "goal") {
        eventType = "goal";
        description = e.detail === "Own Goal" ? "שער עצמי" : e.detail === "Penalty" ? "פנדל" : e.assist.name ? `בישול: ${e.assist.name}` : "שער";
      } else if (t === "card") {
        eventType = "card";
        description = e.detail.includes("Red") ? "כרטיס אדום" : "כרטיס צהוב";
      } else if (t === "subst") {
        eventType = "substitution";
        description = e.assist.name ? `חילוף: ${e.player.name ?? "—"} ↔ ${e.assist.name}` : "חילוף";
      } else if (t === "var") {
        eventType = "var";
        description = `בדיקת VAR – ${e.detail}`;
      }
      return eventType ? [{ minute: e.time.elapsed + (e.time.extra ?? 0), teamName: e.team.name, eventType, playerName: e.player.name ?? "—", description }] : [];
    });

    let stats: MatchStats | null = null;
    if (st.response.length >= 2) {
      const pick = (team: St, ...names: string[]) => num(team.statistics.find((s) => names.includes(s.type))?.value);
      const [h, a] = st.response;
      stats = {
        possession: [pick(h, "Ball Possession"), pick(a, "Ball Possession")],
        shots: [pick(h, "Total Shots"), pick(a, "Total Shots")],
        shotsOnTarget: [pick(h, "Shots on Goal"), pick(a, "Shots on Goal")],
        corners: [pick(h, "Corner Kicks"), pick(a, "Corner Kicks")],
        offsides: [pick(h, "Offsides"), pick(a, "Offsides")],
        fouls: [pick(h, "Fouls"), pick(a, "Fouls")],
        passAccuracy: [pick(h, "Passes %"), pick(a, "Passes %")],
        xg: [pick(h, "expected_goals"), pick(a, "expected_goals")]
      };
    }

    let lineUps: ProviderDetail["lineUps"] = null;
    if (lu.response.length >= 2) {
      const side = (l: Lu) => ({
        teamName: l.team.name,
        formation: l.formation ?? null,
        coach: l.coach?.name ?? null,
        players: [
          ...l.startXI.map((p): LineupPlayer => ({ name: p.player.name, number: p.player.number, position: p.player.pos, starter: true })),
          ...l.substitutes.map((p): LineupPlayer => ({ name: p.player.name, number: p.player.number, position: p.player.pos, starter: false }))
        ]
      });
      lineUps = { home: side(lu.response[0]), away: side(lu.response[1]) };
    }
    return { events, stats, lineUps };
  }
}
