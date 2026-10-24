import { fmtNum } from "@/lib/format";
import type { MatchStats, SportType } from "@/lib/types";

type Row = { key: keyof MatchStats; label: string; decimals?: number; percent?: boolean };

const FOOTBALL: Row[] = [
  { key: "possession", label: "החזקת כדור", percent: true },
  { key: "shots", label: "בעיטות לשער" },
  { key: "shotsOnTarget", label: "בעיטות למסגרת" },
  { key: "corners", label: "קרנות" },
  { key: "offsides", label: "נבדלים" },
  { key: "fouls", label: "עבירות" },
  { key: "passAccuracy", label: "דיוק מסירות", percent: true },
  { key: "xg", label: "xG – שערים צפויים", decimals: 2 }
];
const BASKETBALL: Row[] = [
  { key: "fgPct", label: "אחוזי קליעה מהשדה", percent: true, decimals: 1 },
  { key: "threePct", label: "אחוזי שלשות", percent: true, decimals: 1 },
  { key: "rebounds", label: "ריבאונדים" },
  { key: "assists", label: "אסיסטים" },
  { key: "turnovers", label: "איבודי כדור" },
  { key: "steals", label: "חטיפות" },
  { key: "fouls", label: "עבירות" }
];

export function StatBars({ stats, sport, homeName, awayName }: { stats: MatchStats | null; sport: SportType; homeName: string; awayName: string }) {
  const rows = (sport === "football" ? FOOTBALL : BASKETBALL).filter((r) => stats?.[r.key]);
  if (!stats || rows.length === 0) return <p className="card text-sm text-muted">הסטטיסטיקות יופיעו כאן עם תחילת המשחק.</p>;
  return (
    <div className="card space-y-4">
      <div className="flex justify-between text-sm font-bold"><span>{homeName}</span><span>{awayName}</span></div>
      {rows.map((r) => {
        const [h, a] = stats[r.key] as [number, number];
        const total = h + a || 1;
        const fmt = (n: number) => `${fmtNum(n, r.decimals ?? 0)}${r.percent ? "%" : ""}`;
        const homeLeads = h >= a;
        return (
          <div key={r.key}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className={`num font-extrabold ${homeLeads ? "text-accent" : ""}`}>{fmt(h)}</span>
              <span className="text-xs text-muted">{r.label}</span>
              <span className={`num font-extrabold ${!homeLeads ? "text-accent" : ""}`}>{fmt(a)}</span>
            </div>
            <div className="flex h-2 gap-1" role="img" aria-label={`${r.label}: ${fmt(h)} מול ${fmt(a)}`}>
              <div className="flex-1 overflow-hidden rounded-full bg-surface2"><div className={`h-full rounded-full ${homeLeads ? "bg-accent" : "bg-muted/60"}`} style={{ width: `${(h / total) * 100}%` }} /></div>
              <div className="flex-1 overflow-hidden rounded-full bg-surface2"><div className={`ms-auto h-full rounded-full ${!homeLeads ? "bg-accent" : "bg-muted/60"}`} style={{ width: `${(a / total) * 100}%` }} /></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
