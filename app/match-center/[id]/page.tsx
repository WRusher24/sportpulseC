import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { EventsTimeline } from "@/components/EventsTimeline";
import { FormGuide, formOf } from "@/components/FormGuide";
import { InsightPanel } from "@/components/InsightPanel";
import { Lineups } from "@/components/Lineups";
import { MatchTabs } from "@/components/MatchTabs";
import { RatingsPanel } from "@/components/RatingsPanel";
import { MatchScore } from "@/components/MatchScore";
import { StatBars } from "@/components/StatBars";
import { StatusBadge } from "@/components/StatusBadge";
import { readableOn } from "@/lib/color";
import { isLiveStatus } from "@/lib/data/live-sim";
import { getRepo } from "@/lib/data";
import { fmtDate, fmtTime } from "@/lib/format";
import { getUserRecord } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const repo = getRepo();
  const found = await repo.getMatch((await params).id);
  if (!found) return { title: "משחק" };
  const [h, a] = await Promise.all([repo.getTeam(found.match.homeTeamId), repo.getTeam(found.match.awayTeamId)]);
  return { title: `${h?.nameHe ?? ""} נגד ${a?.nameHe ?? ""}` };
}

export default async function MatchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const repo = getRepo();
  const found = await repo.getMatch(id);
  if (!found) notFound();
  const { match, events } = found;
  const [home, away, leagues, h2h, homeRecent, awayRecent, summary, user] = await Promise.all([
    repo.getTeam(match.homeTeamId),
    repo.getTeam(match.awayTeamId),
    repo.listLeagues(),
    repo.headToHead(match.homeTeamId, match.awayTeamId, 5),
    repo.listMatches({ teamId: match.homeTeamId, status: ["finished"], order: "desc", limit: 6 }),
    repo.listMatches({ teamId: match.awayTeamId, status: ["finished"], order: "desc", limit: 6 }),
    repo.ratingSummary(id),
    getUserRecord()
  ]);
  if (!home || !away) notFound();
  const league = leagues.find((l) => l.id === match.leagueId);
  const sport = league?.sportType ?? "football";
  const mine = user ? await repo.userRatings(id, user.id) : {};
  const live = isLiveStatus(match.status);
  const finished = match.status === "finished";
  const teams = new Map([[home.id, home], [away.id, away]]);
  const fanAverages = new Map(summary.map((s) => [s.playerName, s.average]));
  // Exclude the match itself from the form guide so a live game does not count as a result.
  const homeForm = formOf(home.id, homeRecent.filter((m) => m.id !== match.id));
  const awayForm = formOf(away.id, awayRecent.filter((m) => m.id !== match.id));

  return (
    <>
      <AutoRefresh enabled={live} seconds={30} />
      <Link href="/match-center" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">→ משחקים וטבלאות</Link>

      <section className="card mb-4 text-center" aria-label="תוצאה">
        <p className="text-xs text-muted">{league?.nameHe}{match.round ? ` · ${match.round}` : ""}</p>
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full text-lg font-extrabold" style={{ background: home.primaryColor ?? "rgb(var(--c-surface2))", color: readableOn(home.primaryColor) }} aria-hidden>{home.nameHe.slice(0, 1)}</div>
            <p className="mt-2 text-sm font-bold leading-tight">{home.nameHe}</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <MatchScore status={match.status} homeScore={match.homeScore} awayScore={match.awayScore} size="lg" />
            <StatusBadge status={match.status} minute={match.minute} kickoff={match.matchTimestamp} />
          </div>
          <div>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full text-lg font-extrabold" style={{ background: away.primaryColor ?? "rgb(var(--c-surface2))", color: readableOn(away.primaryColor) }} aria-hidden>{away.nameHe.slice(0, 1)}</div>
            <p className="mt-2 text-sm font-bold leading-tight">{away.nameHe}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          <span>{fmtDate(match.matchTimestamp)}</span> · <span className="num">{fmtTime(match.matchTimestamp)}</span>
          {match.venue ? ` · ${match.venue}` : ""}
        </p>
      </section>

      <MatchTabs
        initial={tab}
        tabs={[
          { id: "events", label: "אירועים", content: <EventsTimeline events={events} homeTeamId={home.id} /> },
          { id: "stats", label: "סטטיסטיקה", content: <StatBars stats={match.stats} sport={sport} homeName={home.nameHe} awayName={away.nameHe} /> },
          { id: "lineups", label: "הרכבים", content: <Lineups lineUps={match.lineUps} homeName={home.nameHe} awayName={away.nameHe} fanAverages={fanAverages} /> },
          { id: "h2h", label: "H2H וכושר", content: <FormGuide home={home} away={away} homeForm={homeForm} awayForm={awayForm} h2h={h2h.filter((m) => m.id !== match.id)} teams={teams} /> },
          { id: "ratings", label: "ציון האוהדים", content: <RatingsPanel matchId={match.id} finished={finished} signedIn={Boolean(user)} lineUps={match.lineUps} homeName={home.nameHe} awayName={away.nameHe} summary={summary} mine={mine} /> },
          { id: "insight", label: "האנליסט", content: <InsightPanel matchId={match.id} /> }
        ]}
      />
    </>
  );
}
