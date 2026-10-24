"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { saveRatingsAction } from "@/app/actions";
import { fmtNum } from "@/lib/format";
import type { LineUps, LineupPlayer, RatingSummary } from "@/lib/types";

type Mine = Record<string, { rating: number; note: string | null }>;
type Props = {
  matchId: string;
  finished: boolean;
  signedIn: boolean;
  lineUps: LineUps | null;
  homeName: string;
  awayName: string;
  summary: RatingSummary[];
  mine: Mine;
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Post-match fan ratings (1-10) with live community averages shown beside the media grades. */
export function RatingsPanel({ matchId, finished, signedIn, lineUps, homeName, awayName, summary, mine }: Props) {
  const [ratings, setRatings] = useState<Mine>(mine);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const fan = useMemo(() => new Map(summary.map((s) => [s.playerName, s])), [summary]);

  if (!lineUps) return <p className="card text-sm text-muted">אין עדיין הרכבים לדירוג.</p>;

  const set = (name: string, patch: Partial<{ rating: number; note: string | null }>) => {
    setRatings((r) => ({ ...r, [name]: { rating: r[name]?.rating ?? 0, note: r[name]?.note ?? null, ...patch } }));
    setDirty((d) => new Set(d).add(name));
  };

  const save = () =>
    start(async () => {
      const payload = [...dirty].filter((n) => (ratings[n]?.rating ?? 0) >= 1).map((n) => ({ playerName: n, rating: ratings[n].rating, note: ratings[n].note || null }));
      if (payload.length === 0) return setMsg({ ok: false, text: "בחרו ציון לפחות לשחקן אחד" });
      const r = await saveRatingsAction({ matchId, ratings: payload });
      if (r.ok) {
        setDirty(new Set());
        setMsg({ ok: true, text: `נשמרו ${fmtNum(r.saved)} דירוגים. תודה!` });
      } else setMsg({ ok: false, text: r.error });
    });

  const team = (side: "home" | "away", title: string, players: LineupPlayer[]) => {
    const media = lineUps.mediaGrades ?? {};
    const fanAvg = avg(players.flatMap((p) => (fan.get(p.name) ? [fan.get(p.name)!.average] : [])));
    const mediaAvg = avg(players.flatMap((p) => (media[`${side}:${p.name}`] !== undefined ? [media[`${side}:${p.name}`]] : [])));
    return (
      <section className="card !p-3" aria-label={`דירוג ${title}`}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-bold">{title}</h3>
          <div className="flex gap-3 text-xs">
            <span>אוהדים <b className="num text-accent">{fanAvg === null ? "–" : fmtNum(fanAvg, 1)}</b></span>
            <span>תקשורת <b className="num">{mediaAvg === null ? "–" : fmtNum(mediaAvg, 1)}</b></span>
          </div>
        </div>
        <ul>
          {players.map((p) => {
            const f = fan.get(p.name);
            const g = media[`${side}:${p.name}`];
            const my = ratings[p.name];
            const isOpen = open === p.name;
            return (
              <li key={p.name} className="border-t border-line/40 first:border-t-0">
                <button className="flex min-h-[48px] w-full items-center gap-2 text-start" onClick={() => setOpen(isOpen ? null : p.name)} aria-expanded={isOpen} disabled={!finished || !signedIn}>
                  <span className="num grid h-6 w-7 shrink-0 place-items-center rounded bg-surface2 text-xs font-bold">{p.number !== null ? fmtNum(p.number) : "–"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}{!p.starter && <span className="ms-1 text-[11px] text-muted">(ספסל)</span>}</span>
                    <span className="mt-1 flex items-center gap-1" aria-hidden>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface2"><span className="block h-full bg-accent" style={{ width: `${((f?.average ?? 0) / 10) * 100}%` }} /></span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface2"><span className="block h-full bg-muted" style={{ width: `${((g ?? 0) / 10) * 100}%` }} /></span>
                    </span>
                  </span>
                  <span className="w-14 text-center text-xs"><span className="block text-[10px] text-muted">אוהדים{f ? ` (${fmtNum(f.count)})` : ""}</span><b className="num text-accent">{f ? fmtNum(f.average, 1) : "–"}</b></span>
                  <span className="w-12 text-center text-xs"><span className="block text-[10px] text-muted">תקשורת</span><b className="num">{g !== undefined ? fmtNum(g, 1) : "–"}</b></span>
                  <span className={`grid h-9 w-9 place-items-center rounded-full border text-sm font-extrabold ${my?.rating ? "border-accent bg-accent text-accent-fg" : "border-line/70 text-muted"}`}><span className="num">{my?.rating ? fmtNum(my.rating) : "+"}</span></span>
                </button>
                {isOpen && (
                  <div className="pb-3">
                    <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10" role="radiogroup" aria-label={`הציון שלכם ל${p.name}`}>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <button key={n} role="radio" aria-checked={my?.rating === n} onClick={() => set(p.name, { rating: n })} className={`num min-h-[40px] rounded-lg border text-sm font-bold ${my?.rating === n ? "border-accent bg-accent text-accent-fg" : "border-line/70 bg-bg hover:border-accent"}`}>{fmtNum(n)}</button>
                      ))}
                    </div>
                    <label className="mt-2 block text-xs text-muted" htmlFor={`note-${p.name}`}>הערה קצרה (עברית או English, אופציונלי)</label>
                    <textarea id={`note-${p.name}`} className="input mt-1 !min-h-[64px] py-2" maxLength={280} value={my?.note ?? ""} onChange={(e) => set(p.name, { note: e.target.value })} placeholder="למשל: שחקן המשחק / Great first half" />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    );
  };

  return (
    <div className="space-y-3">
      {!finished && <p className="card text-sm">הדירוג נפתח מיד לאחר שריקת הסיום. עד אז אפשר לראות את ההרכבים.</p>}
      {finished && !signedIn && (
        <p className="card text-sm">כדי לדרג שחקנים <Link href="/account" className="font-bold text-accent">התחברו או הירשמו</Link>. הממוצעים של האוהדים גלויים לכולם.</p>
      )}
      {team("home", homeName, lineUps.home.players)}
      {team("away", awayName, lineUps.away.players)}
      {finished && signedIn && (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-20 flex items-center gap-3 rounded-2xl border border-line/60 bg-surface/95 p-3 backdrop-blur">
          <button className="btn-primary" onClick={save} disabled={pending || dirty.size === 0}>{pending ? "שומרים…" : `שמירת דירוגים${dirty.size ? ` (${fmtNum(dirty.size)})` : ""}`}</button>
          {msg && <span role="status" className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</span>}
        </div>
      )}
    </div>
  );
}
