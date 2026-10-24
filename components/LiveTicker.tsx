"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import type { TickerItem } from "@/lib/sports/types";
import { MatchScore } from "./MatchScore";
import { StatusBadge } from "./StatusBadge";

/** Real-time score ticker. Polls /api/live every 20 seconds (only while the tab is visible). */
export function LiveTicker({ initial }: { initial: TickerItem[] }) {
  const [items, setItems] = useState<TickerItem[]>(initial);
  const [source, setSource] = useState<"provider" | "baseline">("baseline");

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await apiFetch("/api/live");
        if (!res.ok) return;
        const data = (await res.json()) as { items: TickerItem[]; source: "provider" | "baseline" };
        if (!stopped) {
          setItems(data.items);
          setSource(data.source);
        }
      } catch {
        /* offline: keep showing the last known scores */
      }
    };
    const id = setInterval(tick, 20_000);
    document.addEventListener("visibilitychange", tick);
    void tick();
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  return (
    <section aria-label="תוצאות חיות" aria-live="polite" className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <span className="h-2 w-2 animate-pulseDot rounded-full bg-live" aria-hidden />
          משחקים חיים
        </h2>
        {source === "baseline" && <span className="text-[11px] text-muted">אין ספק נתונים מחובר · הוסיפו מפתח בהגדרות</span>}
      </div>
      {items.length === 0 ? (
        <p className="card text-sm text-muted">אין כרגע משחקים חיים. המשחקים הקרובים והתוצאות מופיעים במסך &quot;משחקים וטבלאות&quot; לאחר חיבור ספק נתונים.</p>
      ) : (
        <div className="scroll-x snap-x">
          {items.map((m) => {
            const body = (
              <div className="min-w-[210px] snap-start rounded-2xl border border-live/40 bg-surface p-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-muted">
                  <span className="truncate">{m.leagueNameHe}</span>
                  <StatusBadge status={m.status} minute={m.minute} kickoff={m.kickoff} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{m.homeNameHe}</span>
                  <MatchScore status={m.status} homeScore={m.homeScore} awayScore={m.awayScore} size="md" />
                  <span className="min-w-0 flex-1 truncate text-end text-sm font-semibold">{m.awayNameHe}</span>
                </div>
              </div>
            );
            const key = m.matchId ?? `${m.externalId}-${m.homeNameHe}`;
            return m.matchId ? (
              <Link key={key} href={`/match-center/${m.matchId}`} className="block">
                {body}
              </Link>
            ) : (
              <div key={key}>{body}</div>
            );
          })}
        </div>
      )}
    </section>
  );
}
