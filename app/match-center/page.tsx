import Link from "next/link";
import { LiveTicker } from "@/components/LiveTicker";
import { MatchRow } from "@/components/MatchRow";
import { StandingsTable } from "@/components/StandingsTable";
import { getRepo } from "@/lib/data";
import { fmtDate, fmtShortDate, israelDayKey } from "@/lib/format";
import { getFavoriteTeamId } from "@/lib/server/session";
import { systemCredentials } from "@/lib/server/request-credentials";
import { getProvider } from "@/lib/sports";
import { liveTicker } from "@/lib/sports/sync";
import type { LeagueDTO, MatchDTO, TeamDTO } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "משחקים וטבלאות" };

const DAY = 86_400_000;

export default async function MatchCenterPage({ searchParams }: { searchParams: Promise<{ tab?: string; league?: string; day?: string }> }) {
  const sp = await searchParams;
  const repo = getRepo();
  const tab = sp.tab === "tables" ? "tables" : "fixtures";
  const [leagues, teamList, favorite] = await Promise.all([repo.listLeagues(), repo.listTeams(), getFavoriteTeamId()]);
  const teams = new Map(teamList.map((t) => [t.id, t]));
  const ticker = await liveTicker(repo, getProvider(systemCredentials().sports));
  const leagueId = leagues.some((l) => l.id === sp.league) ? sp.league : undefined;

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ tab, ...(leagueId ? { league: leagueId } : {}), ...(sp.day ? { day: sp.day } : {}) });
    for (const [k, v] of Object.entries(patch)) (v ? p.set(k, v) : p.delete(k));
    return `/match-center?${p}`;
  };

  return (
    <>
      <LiveTicker initial={ticker.items} />
      <h1 className="mb-3 text-2xl font-extrabold">משחקים וטבלאות</h1>

      <div role="tablist" aria-label="תצוגה" className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-surface p-1">
        {[["fixtures", "משחקים"], ["tables", "טבלאות"]].map(([id, label]) => (
          <Link key={id} role="tab" aria-selected={tab === id} href={href({ tab: id })} className={`rounded-lg py-2 text-center text-sm font-semibold transition ${tab === id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"}`}>
            {label}
          </Link>
        ))}
      </div>

      {tab === "fixtures" ? (
        <Fixtures leagues={leagues} teams={teams} leagueId={leagueId} day={sp.day} href={href} repoLoad={(from, to, lid) => repo.listMatches({ from, to, leagueId: lid })} />
      ) : (
        <Tables leagues={leagues} teams={teams} leagueId={leagueId} href={href} getRows={(id) => repo.getStandings(id)} favoriteTeam={favorite ? teams.get(favorite) : undefined} />
      )}
    </>
  );
}

function LeagueChips({ leagues, current, href, all = true }: { leagues: { id: string; nameHe: string }[]; current?: string; href: (p: Record<string, string | undefined>) => string; all?: boolean }) {
  return (
    <div className="scroll-x mb-4" role="group" aria-label="בחירת ליגה">
      {all && <Link href={href({ league: undefined })} className="chip" aria-pressed={!current}>כל הליגות</Link>}
      {leagues.map((l) => (
        <Link key={l.id} href={href({ league: l.id })} className="chip" aria-pressed={current === l.id}>{l.nameHe}</Link>
      ))}
    </div>
  );
}

async function Fixtures({ leagues, teams, leagueId, day, href, repoLoad }: { leagues: LeagueDTO[]; teams: Map<string, TeamDTO>; leagueId?: string; day?: string; href: (p: Record<string, string | undefined>) => string; repoLoad: (from: Date, to: Date, leagueId?: string) => Promise<MatchDTO[]> }) {
  const today = israelDayKey();
  const days = Array.from({ length: 9 }, (_, i) => new Date(Date.now() + (i - 3) * DAY));
  const keys = days.map((d) => israelDayKey(d));
  const selected = day && keys.includes(day) ? day : today;
  const matches = (await repoLoad(new Date(Date.now() - 5 * DAY), new Date(Date.now() + 7 * DAY), leagueId)).filter((m) => israelDayKey(m.matchTimestamp) === selected);
  const byLeague = new Map<string, MatchDTO[]>();
  for (const m of matches) byLeague.set(m.leagueId, [...(byLeague.get(m.leagueId) ?? []), m]);

  return (
    <>
      <div className="scroll-x mb-3" role="group" aria-label="בחירת יום">
        {days.map((d, i) => (
          <Link key={keys[i]} href={href({ day: keys[i] === today ? undefined : keys[i] })} className="chip flex-col !py-1.5 text-center leading-tight" aria-pressed={selected === keys[i]}>
            <span className="text-[11px]">{keys[i] === today ? "היום" : fmtDate(d).split(" ")[0]}</span>
            <span className="num text-xs font-bold">{fmtShortDate(d).slice(0, 5)}</span>
          </Link>
        ))}
      </div>
      <LeagueChips leagues={leagues} current={leagueId} href={href} />
      {byLeague.size === 0 ? (
        <p className="card text-center text-sm text-muted">אין משחקים ביום זה בליגות שנבחרו. לוח המשחקים והתוצאות מגיעים מספק נתוני הספורט – הוסיפו מפתח בהגדרות (או בשרת) והנתונים יסונכרנו אוטומטית.</p>
      ) : (
        <div className="space-y-4">
          {leagues.filter((l) => byLeague.has(l.id)).map((l) => (
            <section key={l.id} className="overflow-hidden rounded-2xl border border-line/60 bg-surface" aria-label={l.nameHe}>
              <h2 className="bg-surface2/60 px-3 py-2 text-sm font-bold">{l.nameHe}</h2>
              {(byLeague.get(l.id) as MatchDTO[]).map((m) => <MatchRow key={m.id} match={m} teams={teams} />)}
            </section>
          ))}
        </div>
      )}
    </>
  );
}

async function Tables({ leagues, teams, leagueId, href, getRows, favoriteTeam }: { leagues: LeagueDTO[]; teams: Map<string, TeamDTO>; leagueId?: string; href: (p: Record<string, string | undefined>) => string; getRows: ReturnType<typeof getRepo>["getStandings"]; favoriteTeam?: TeamDTO }) {
  const withTables: LeagueDTO[] = [];
  for (const l of leagues) if ((await getRows(l.id)).length > 0) withTables.push(l);
  const current = withTables.find((l) => l.id === leagueId) ?? withTables.find((l) => l.id === favoriteTeam?.leagueId) ?? withTables[0];
  if (!current) return <p className="card text-sm text-muted">אין טבלאות זמינות.</p>;
  const rows = await getRows(current.id);
  const zones = current.sportType === "football" ? { top: current.id === "il-premier" ? 6 : current.id === "il-leumit" ? 2 : 4, bottom: current.id === "il-premier" ? 2 : 3 } : undefined;
  return (
    <>
      <LeagueChips leagues={withTables} current={current.id} href={href} all={false} />
      <h2 className="mb-2 font-bold">{current.nameHe} · עונת {current.season}</h2>
      <StandingsTable rows={rows} teams={teams} sport={current.sportType} highlight={favoriteTeam?.id} zones={zones} />
    </>
  );
}
