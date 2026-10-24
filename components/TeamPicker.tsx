"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { setFavoriteTeamAction } from "@/app/actions";
import { normalize } from "@/lib/ai/text";
import { readableOn } from "@/lib/color";
import type { LeagueDTO, TeamDTO } from "@/lib/types";

/** Team onboarding: search in Hebrew or English across names and aliases. */
export function TeamPicker({ teams, leagues, current }: { teams: TeamDTO[]; leagues: LeagueDTO[]; current?: string | null }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [league, setLeague] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const index = useMemo(() => teams.map((t) => ({ t, hay: normalize([t.nameHe, t.nameEn, ...t.aliases].join(" ")) })), [teams]);
  const results = useMemo(() => {
    const needle = normalize(q.trim());
    return index.filter(({ t, hay }) => (!league || t.leagueId === league) && (!needle || hay.includes(needle))).map(({ t }) => t).slice(0, 60);
  }, [index, q, league]);
  const leagueName = (id: string) => leagues.find((l) => l.id === id)?.nameHe ?? "";

  const choose = (id: string) =>
    start(async () => {
      const r = await setFavoriteTeamAction(id);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });

  return (
    <div>
      <label htmlFor="team-search" className="sr-only">חיפוש קבוצה</label>
      <input id="team-search" type="search" className="input" placeholder="חפשו קבוצה: מכבי חיפה, Real Madrid, בית״ר…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="scroll-x my-3" role="group" aria-label="סינון לפי ליגה">
        <button className="chip" aria-pressed={!league} onClick={() => setLeague(null)}>הכול</button>
        {leagues.map((l) => <button key={l.id} className="chip" aria-pressed={league === l.id} onClick={() => setLeague(league === l.id ? null : l.id)}>{l.nameHe}</button>)}
      </div>
      {error && <p role="alert" className="mb-2 text-sm text-bad">{error}</p>}
      <ul className="grid gap-2 sm:grid-cols-2">
        {results.map((t) => (
          <li key={t.id}>
            <button className={`flex min-h-[56px] w-full items-center gap-3 rounded-xl border p-2.5 text-start transition ${current === t.id ? "border-accent bg-accent/10" : "border-line/60 bg-surface hover:border-accent"}`} disabled={pending} onClick={() => choose(t.id)}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-base font-extrabold" style={{ background: t.primaryColor ?? "rgb(var(--c-surface2))", color: readableOn(t.primaryColor) }} aria-hidden>{t.nameHe.slice(0, 1)}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{t.nameHe}</span>
                <span className="block truncate text-xs text-muted">{t.nameEn} · {leagueName(t.leagueId)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {results.length === 0 && <p className="card text-sm text-muted">לא נמצאה קבוצה. נסו איות אחר.</p>}
    </div>
  );
}
