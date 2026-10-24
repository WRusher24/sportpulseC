import Link from "next/link";
import { DigestCard } from "@/components/DigestCard";
import { MatchRow } from "@/components/MatchRow";
import { StandingsTable } from "@/components/StandingsTable";
import { TeamPicker } from "@/components/TeamPicker";
import { ThreadCard } from "@/components/ThreadCard";
import { generateDigest } from "@/lib/ai/digest";
import { readableOn } from "@/lib/color";
import { getRepo } from "@/lib/data";
import { israelDayKey } from "@/lib/format";
import { systemCredentials } from "@/lib/server/request-credentials";
import { getFavoriteTeamId } from "@/lib/server/session";
import type { DigestDTO } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "הקבוצה שלי" };

export default async function MyClubPage({ searchParams }: { searchParams: Promise<{ change?: string }> }) {
  const { change } = await searchParams;
  const repo = getRepo();
  const [teams, leagues, favoriteId] = await Promise.all([repo.listTeams(), repo.listLeagues(), getFavoriteTeamId()]);
  const team = favoriteId ? teams.find((t) => t.id === favoriteId) : undefined;

  if (!team || change) {
    return (
      <>
        <h1 className="mb-1 text-2xl font-extrabold">{team ? "החלפת קבוצה" : "בחרו את הקבוצה שלכם"}</h1>
        <p className="mb-4 text-sm text-muted">הקבוצה שתבחרו תסנן את החדשות, תפעיל התראות משחק ותקבע את סיכום הבוקר האישי שלכם.</p>
        <TeamPicker teams={teams} leagues={leagues} current={team?.id} />
        {team && <Link href="/my-club" className="mt-4 inline-block text-sm text-muted underline">ביטול</Link>}
      </>
    );
  }

  const today = israelDayKey();
  let digest: DigestDTO | null = await repo.getDigest(team.id, today);
  if (!digest) digest = await generateDigest(repo, systemCredentials().ai, team.id, today).catch(() => null);

  const [threads, upcoming, results, table] = await Promise.all([
    repo.listThreads({ teamId: team.id, limit: 5 }),
    repo.listMatches({ teamId: team.id, status: ["scheduled", "first_half", "half_time", "second_half", "extra_time"], from: new Date(Date.now() - 3 * 3_600_000), order: "asc", limit: 4 }),
    repo.listMatches({ teamId: team.id, status: ["finished"], order: "desc", limit: 5 }),
    repo.getStandings(team.leagueId)
  ]);
  const league = leagues.find((l) => l.id === team.leagueId);
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const names = Object.fromEntries(teams.map((t) => [t.id, t.nameHe]));
  const row = table.find((r) => r.teamId === team.id);
  const nearby = row ? table.filter((r) => Math.abs(r.position - row.position) <= 2) : [];

  return (
    <>
      <section className="mb-4 flex items-center gap-3 rounded-2xl p-4" style={{ background: `linear-gradient(135deg, ${team.primaryColor ?? "#334155"}, ${team.primaryColor ?? "#334155"}cc)`, color: readableOn(team.primaryColor ?? "#334155") }}>
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-black/20 text-2xl font-extrabold" aria-hidden>{team.nameHe.slice(0, 1)}</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold">{team.nameHe}</h1>
          <p className="truncate text-sm">{league?.nameHe}{team.venue ? ` · ${team.venue}` : ""}</p>
        </div>
        <Link href="/my-club?change=1" className="btn !min-h-[36px] bg-black/25 text-xs hover:bg-black/40">החלפה</Link>
      </section>

      <div className="space-y-5">
        <DigestCard teamId={team.id} teamName={team.nameHe} initial={digest?.contentHe ?? null} generatedBy={digest?.generatedBy ?? null} />

        <section aria-labelledby="fx">
          <h2 id="fx" className="mb-2 font-extrabold">המשחקים הבאים</h2>
          <div className="overflow-hidden rounded-2xl border border-line/60 bg-surface">
            {upcoming.length ? upcoming.map((m) => <MatchRow key={m.id} match={m} teams={teamMap} />) : <p className="p-3 text-sm text-muted">אין משחקים קרובים במאגר.</p>}
          </div>
        </section>

        <section aria-labelledby="rs">
          <h2 id="rs" className="mb-2 font-extrabold">תוצאות אחרונות</h2>
          <div className="overflow-hidden rounded-2xl border border-line/60 bg-surface">
            {results.length ? results.map((m) => <MatchRow key={m.id} match={m} teams={teamMap} />) : <p className="p-3 text-sm text-muted">אין תוצאות במאגר.</p>}
          </div>
        </section>

        {nearby.length > 0 && league && (
          <section aria-labelledby="tb">
            <div className="mb-2 flex items-center justify-between">
              <h2 id="tb" className="font-extrabold">מיקום בטבלה</h2>
              <Link href={`/match-center?tab=tables&league=${league.id}`} className="text-sm text-accent">לטבלה המלאה ←</Link>
            </div>
            <StandingsTable rows={nearby} teams={teamMap} sport={league.sportType} highlight={team.id} />
          </section>
        )}

        <section aria-labelledby="nw">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="nw" className="font-extrabold">חדשות {team.nameHe}</h2>
            <Link href="/?mine=1" className="text-sm text-accent">עוד חדשות ←</Link>
          </div>
          <div className="space-y-4">
            {threads.length ? threads.map((t) => <ThreadCard key={t.id} thread={t} teamName={names[t.teamId ?? ""]} />) : <p className="card text-sm text-muted">אין עדיין ידיעות על הקבוצה. הן יופיעו אחרי הסבב הבא של איסוף החדשות.</p>}
          </div>
        </section>
      </div>
    </>
  );
}
