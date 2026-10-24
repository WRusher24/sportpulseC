import { AnalystChat } from "@/components/AnalystChat";
import { MatchInsightPicker, type MatchOption } from "@/components/MatchInsightPicker";
import { getRepo } from "@/lib/data";
import { fmtNum, fmtShortDate } from "@/lib/format";
import { getFavoriteTeamId } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "האנליסט" };

export default async function AnalystPage() {
  const repo = getRepo();
  const favorite = await getFavoriteTeamId();
  const [teams, upcoming, recent] = await Promise.all([
    repo.listTeams(),
    repo.listMatches({ status: ["scheduled", "first_half", "half_time", "second_half"], from: new Date(Date.now() - 3 * 3_600_000), order: "asc", limit: 40 }),
    repo.listMatches({ status: ["finished"], order: "desc", limit: 40 })
  ]);
  const name = new Map(teams.map((t) => [t.id, t.nameHe]));
  const pick = (ids: Set<string | null>, ms: typeof upcoming) => ms.filter((m) => !favorite || ids.has(m.homeTeamId) || ids.has(m.awayTeamId));
  const fav = new Set<string | null>([favorite]);
  const label = (m: (typeof upcoming)[number]) => `${name.get(m.homeTeamId)} – ${name.get(m.awayTeamId)}${m.homeScore !== null ? ` (${fmtNum(m.homeScore)}:${fmtNum(m.awayScore ?? 0)})` : ""} · ${fmtShortDate(m.matchTimestamp).slice(0, 5)}`;
  const options: MatchOption[] = [
    ...(favorite ? pick(fav, upcoming).slice(0, 6).map((m) => ({ id: m.id, label: label(m), group: "המשחקים הקרובים של הקבוצה שלי" })) : []),
    ...upcoming.slice(0, 10).map((m) => ({ id: m.id, label: label(m), group: "משחקים קרובים וחיים" })),
    ...recent.slice(0, 10).map((m) => ({ id: m.id, label: label(m), group: "משחקים שהסתיימו" }))
  ].filter((o, i, a) => a.findIndex((x) => x.id === o.id && x.group === o.group) === i);

  return (
    <>
      <h1 className="mb-1 text-2xl font-extrabold">האנליסט</h1>
      <p className="mb-4 text-sm text-muted">עוזר טקטי וסטטיסטי מבוסס בינה מלאכותית: xG, הרכבים, כושר ותרחישי סיום עונה.</p>
      <AnalystChat favoriteTeamId={favorite} favoriteTeamName={favorite ? (name.get(favorite) ?? null) : null} />
      <MatchInsightPicker options={options} />
    </>
  );
}
