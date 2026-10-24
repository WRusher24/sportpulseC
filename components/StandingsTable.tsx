import Link from "next/link";
import { fmtNum } from "@/lib/format";
import type { SportType, StandingDTO, TeamDTO } from "@/lib/types";

const FORM_STYLE: Record<string, string> = { W: "bg-good text-bg", D: "bg-muted/70 text-bg", L: "bg-bad text-bg" };
const FORM_LABEL: Record<string, string> = { W: "נצחון", D: "תיקו", L: "הפסד" };

export function FormPills({ form }: { form: string }) {
  if (!form) return <span className="text-muted">–</span>;
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`מאזן אחרון: ${form.split("").map((c) => FORM_LABEL[c]).join(", ")}`}>
      {form.split("").map((c, i) => (
        <span key={i} className={`grid h-5 w-5 place-items-center rounded text-[10px] font-bold ${FORM_STYLE[c] ?? "bg-surface2"}`} aria-hidden>
          {c === "W" ? "נ" : c === "D" ? "ת" : "ה"}
        </span>
      ))}
    </span>
  );
}

export function StandingsTable({ rows, teams, sport, highlight, zones }: { rows: StandingDTO[]; teams: Map<string, TeamDTO>; sport: SportType; highlight?: string | null; zones?: { top: number; bottom: number } }) {
  const football = sport === "football";
  return (
    <div className="overflow-x-auto rounded-2xl border border-line/60 bg-surface">
      <table className="w-full min-w-[340px] text-sm">
        <caption className="sr-only">טבלת הליגה</caption>
        <thead className="bg-surface2/60 text-xs text-muted">
          <tr>
            <th scope="col" className="w-9 py-2 ps-3 text-start font-medium">#</th>
            <th scope="col" className="py-2 text-start font-medium">קבוצה</th>
            <th scope="col" className="px-1 text-center font-medium" title="משחקים">מש׳</th>
            <th scope="col" className="px-1 text-center font-medium" title="נצחונות">נצ׳</th>
            {football && <th scope="col" className="px-1 text-center font-medium" title="תיקו">ת׳</th>}
            <th scope="col" className="px-1 text-center font-medium" title="הפסדים">הפ׳</th>
            <th scope="col" className="px-1 text-center font-medium" title={football ? "הפרש שערים" : "הפרש סלים"}>הפרש</th>
            <th scope="col" className="px-1 text-center font-bold text-fg" title="נקודות">נק׳</th>
            <th scope="col" className="hidden pe-3 text-center font-medium sm:table-cell">מאזן</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const t = teams.get(r.teamId);
            const zone = zones && r.position <= zones.top ? "border-s-good" : zones && r.position > rows.length - zones.bottom ? "border-s-bad" : "border-s-transparent";
            return (
              <tr key={r.teamId} className={`border-t border-line/40 border-s-4 ${zone} ${highlight === r.teamId ? "bg-accent/15 font-semibold" : ""}`}>
                <td className="py-2.5 ps-3 text-start"><span className="num">{fmtNum(r.position)}</span></td>
                <td className="py-2.5 text-start">{t?.nameHe ?? r.teamId}</td>
                <td className="px-1 text-center"><span className="num">{fmtNum(r.played)}</span></td>
                <td className="px-1 text-center"><span className="num">{fmtNum(r.wins)}</span></td>
                {football && <td className="px-1 text-center"><span className="num">{fmtNum(r.draws)}</span></td>}
                <td className="px-1 text-center"><span className="num">{fmtNum(r.losses)}</span></td>
                <td className="px-1 text-center"><span className="num">{r.goalDifference > 0 ? `+${fmtNum(r.goalDifference)}` : fmtNum(r.goalDifference)}</span></td>
                <td className="px-1 pe-3 text-center font-extrabold sm:pe-1"><span className="num">{fmtNum(r.points)}</span></td>
                <td className="hidden pe-3 text-center sm:table-cell"><FormPills form={r.form} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.some((r) => r.isDemo) && <p className="border-t border-line/40 px-3 py-2 text-[11px] text-muted">טבלת פתיחה (0 משחקים) – הנתונים העדכניים מגיעים מספק נתוני הספורט. הוסיפו מפתח בהגדרות או הגדירו אותו בשרת.</p>}
      <p className="px-3 pb-2 text-[11px] text-muted">
        {football ? "ניצחון = 3 נקודות, תיקו = 1." : "ניצחון = 2 נקודות, הפסד = 1 (ב-NBA הדירוג לפי מספר נצחונות)."}{" "}
        <Link href="/analyst" className="text-accent">שאלו את האנליסט על תרחישי סיום העונה ←</Link>
      </p>
    </div>
  );
}
