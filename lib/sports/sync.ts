import type { Repo } from "@/lib/data/repo";
import { isLiveStatus } from "@/lib/data/live-sim";
import { israelDayKey } from "@/lib/format";
import type { LeagueDTO, MatchDTO } from "@/lib/types";
import { TeamMatcher } from "./team-match";
import type { ProviderMatch, SportsProvider, TickerItem } from "./types";

const DAY = 86_400_000;

const findLeague = (leagues: LeagueDTO[], pm: ProviderMatch) =>
  pm.leagueId
    ? leagues.find((l) => l.id === pm.leagueId)
    : leagues.find((l) => pm.leagueExternalId !== null && (l.apiFootballId === pm.leagueExternalId || l.apiBasketballId === pm.leagueExternalId || l.sportmonksId === pm.leagueExternalId));

/** URL-safe match id for provider matches. */
export const externalMatchId = (leagueId: string, externalId: string) => `${leagueId}-x${externalId.replace(/[^A-Za-z0-9_-]/g, "-")}`;

function toDto(league: LeagueDTO, pm: ProviderMatch, matcher: TeamMatcher, existing?: MatchDTO): MatchDTO | null {
  const home = matcher.find(pm.homeName, league.sportType, league.id);
  const away = matcher.find(pm.awayName, league.sportType, league.id);
  if (!home || !away) return null;
  return {
    id: externalMatchId(league.id, pm.externalId),
    leagueId: league.id,
    homeTeamId: home.id,
    awayTeamId: away.id,
    homeScore: pm.homeScore,
    awayScore: pm.awayScore,
    status: pm.status,
    minute: pm.minute,
    matchTimestamp: pm.kickoff,
    venue: pm.venue ?? home.venue,
    round: pm.round,
    stats: existing?.stats ?? null,
    lineUps: existing?.lineUps ?? null,
    externalId: pm.externalId,
    isDemo: false
  };
}

/** Pulls fixtures (past 3 days, next 10) and the table for one league. The first successful sync replaces the demo baseline. */
export async function syncLeague(repo: Repo, provider: SportsProvider, league: LeagueDTO): Promise<{ matches: number; standings: number }> {
  const teams = await repo.listTeams();
  const matcher = new TeamMatcher(teams);
  const now = Date.now();
  const from = israelDayKey(new Date(now - 3 * DAY));
  const to = israelDayKey(new Date(now + 10 * DAY));
  const fixtures = await provider.fixtures(league, from, to);
  const existing = await repo.listMatches({ leagueId: league.id });
  const byExternal = new Map(existing.filter((m) => m.externalId).map((m) => [m.externalId as string, m]));
  const dtos = fixtures.flatMap((pm) => toDto(league, pm, matcher, byExternal.get(pm.externalId)) ?? []);

  let standingsCount = 0;
  const table = await provider.standings(league);
  const rows = table.flatMap((r) => {
    const t = matcher.find(r.teamName, league.sportType, league.id);
    return t ? [{ leagueId: league.id, teamId: t.id, played: r.played, wins: r.wins, draws: r.draws, losses: r.losses, goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst, points: r.points, form: r.form, isDemo: false }] : [];
  });

  if (dtos.length > 0) {
    await repo.purgeDemoData(league.id);
    await repo.upsertMatches(dtos);
  }
  if (rows.length > 0) {
    await repo.replaceStandings(league.id, rows);
    standingsCount = rows.length;
  }
  if (dtos.length > 0 || rows.length > 0) await repo.markLeagueSynced(league.id);
  return { matches: dtos.length, standings: standingsCount };
}

/** Applies provider live scores to stored matches and refreshes events/stats/lineups for a few of them per run (API quota friendly). */
export async function syncLive(repo: Repo, provider: SportsProvider, leagues: LeagueDTO[], detailBudget = 3): Promise<{ updated: number; details: number }> {
  const live = await provider.liveMatches(leagues);
  if (live.length === 0) return { updated: 0, details: 0 };
  const matcher = new TeamMatcher(await repo.listTeams());
  let updated = 0;
  let details = 0;
  const upserts: MatchDTO[] = [];
  for (const pm of live) {
    const league = findLeague(leagues, pm);
    if (!league) continue;
    const id = externalMatchId(league.id, pm.externalId);
    const current = (await repo.getMatch(id))?.match;
    const dto = toDto(league, pm, matcher, current);
    if (!dto) continue;
    upserts.push(dto);
    updated++;
    if (details < detailBudget) {
      const d = await provider.detail(league, pm.externalId).catch(() => null);
      if (d) {
        const teamId = (name: string) => matcher.find(name, league.sportType, league.id)?.id ?? null;
        await repo.replaceEvents(id, d.events.map((e) => ({ minute: e.minute, teamId: teamId(e.teamName), eventType: e.eventType, playerName: e.playerName, description: e.description })));
        dto.stats = d.stats ?? dto.stats;
        if (d.lineUps) {
          const { teamName: _h, ...home } = d.lineUps.home;
          const { teamName: _a, ...away } = d.lineUps.away;
          dto.lineUps = { home, away, mediaGrades: dto.lineUps?.mediaGrades };
        }
        details++;
      }
    }
  }
  await repo.upsertMatches(upserts);
  return { updated, details };
}

/** Fills events / stats / lineups for matches that finished in the last 3 days and have none yet (a few per run, quota friendly). */
export async function syncFinishedDetails(repo: Repo, provider: SportsProvider, leagues: LeagueDTO[], budget = 4): Promise<number> {
  const recent = await repo.listMatches({ status: ["finished"], from: new Date(Date.now() - 3 * 86_400_000), order: "desc" });
  const matcher = new TeamMatcher(await repo.listTeams());
  let done = 0;
  for (const m of recent) {
    if (done >= budget) break;
    const league = leagues.find((l) => l.id === m.leagueId);
    if (!league || !m.externalId || m.lineUps || m.stats || !provider.supports(league)) continue;
    const d = await provider.detail(league, m.externalId).catch(() => null);
    if (!d) continue;
    const teamId = (name: string) => matcher.find(name, league.sportType, league.id)?.id ?? null;
    await repo.replaceEvents(m.id, d.events.map((e) => ({ minute: e.minute, teamId: teamId(e.teamName), eventType: e.eventType, playerName: e.playerName, description: e.description })));
    const lineUps = d.lineUps ? (({ teamName: _h, ...home }, { teamName: _a, ...away }) => ({ home, away }))(d.lineUps.home, d.lineUps.away) : m.lineUps;
    await repo.upsertMatches([{ ...m, stats: d.stats ?? m.stats, lineUps }]);
    done++;
  }
  return done;
}

export async function leaguesDueForSync(repo: Repo, leagues: LeagueDTO[], provider: SportsProvider): Promise<LeagueDTO[]> {
  const due: LeagueDTO[] = [];
  for (const l of leagues.filter((x) => provider.supports(x))) {
    const at = await repo.getLeagueSyncedAt(l.id);
    if (!at || Date.now() - at.getTime() > provider.refreshMs) due.push(l);
  }
  return due;
}

/** True when a stored match is live or about to start - the only time polling the provider is worthwhile. */
export async function hasActiveMatches(repo: Repo): Promise<boolean> {
  const now = Date.now();
  const around = await repo.listMatches({ from: new Date(now - 3 * 3_600_000), to: new Date(now + 10 * 60_000) });
  return around.some((m) => isLiveStatus(m.status) || m.status === "scheduled");
}

/** Normalised live ticker feed. */
export async function liveTicker(repo: Repo, provider: SportsProvider | null): Promise<{ items: TickerItem[]; source: "provider" | "baseline" }> {
  const leagues = await repo.listLeagues();
  const leagueName = new Map(leagues.map((l) => [l.id, l.nameHe]));
  const teams = await repo.listTeams();
  const teamBy = new Map(teams.map((t) => [t.id, t]));

  const fromRepo = async (): Promise<TickerItem[]> =>
    (await repo.listMatches({ status: ["first_half", "half_time", "second_half", "extra_time"] })).map((m) => ({
      matchId: m.id,
      externalId: m.externalId,
      leagueId: m.leagueId,
      leagueNameHe: leagueName.get(m.leagueId) ?? "",
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeNameHe: teamBy.get(m.homeTeamId)?.nameHe ?? m.homeTeamId,
      awayNameHe: teamBy.get(m.awayTeamId)?.nameHe ?? m.awayTeamId,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      status: m.status,
      minute: m.minute,
      kickoff: m.matchTimestamp
    }));

  // Free providers (ESPN / portal scraping) are synced into the store by the background job; only paid keys are queried live.
  if (!provider || !provider.liveDirect) return { items: await fromRepo(), source: provider ? "provider" : "baseline" };
  try {
    const matcher = new TeamMatcher(teams);
    const live = await provider.liveMatches(leagues);
    const items: TickerItem[] = live.map((pm) => {
      const league = findLeague(leagues, pm);
      const home = matcher.find(pm.homeName, league?.sportType, league?.id);
      const away = matcher.find(pm.awayName, league?.sportType, league?.id);
      return {
        matchId: league ? externalMatchId(league.id, pm.externalId) : null,
        externalId: pm.externalId,
        leagueId: league?.id ?? null,
        leagueNameHe: league?.nameHe ?? "",
        homeTeamId: home?.id ?? null,
        awayTeamId: away?.id ?? null,
        homeNameHe: home?.nameHe ?? pm.homeName,
        awayNameHe: away?.nameHe ?? pm.awayName,
        homeScore: pm.homeScore,
        awayScore: pm.awayScore,
        status: pm.status,
        minute: pm.minute,
        kickoff: pm.kickoff
      };
    });
    return { items, source: "provider" };
  } catch (error) {
    console.warn("[sports] live provider failed, falling back to baseline:", error instanceof Error ? error.message : error);
    return { items: await fromRepo(), source: "baseline" };
  }
}
