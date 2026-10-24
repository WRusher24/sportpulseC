"use client";

import Link from "next/link";
import { useState } from "react";
import { fmtNum, fmtRelative } from "@/lib/format";
import { CATEGORY_LABEL } from "@/lib/he";
import type { ThreadDTO } from "@/lib/types";
import { VibeBar } from "./VibeBar";

/** Master Story Thread card: one primary card, one tab per reporting outlet. */
export function ThreadCard({ thread, teamName }: { thread: ThreadDTO; teamName?: string }) {
  const [active, setActive] = useState(0);
  const articles = thread.articles;
  const current = articles[active] ?? articles[0];
  if (!current) return null;
  const rewritten = articles.some((a) => a.clickbaitScore >= 40);
  const hero = thread.heroImageUrl ?? current.imageUrl;

  return (
    <article className="card animate-fadeUp overflow-hidden !p-0">
      {hero && (
        <Link href={`/story/${thread.id}`} className="block aspect-[16/8] w-full overflow-hidden bg-surface2" tabIndex={-1} aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={(e) => ((e.currentTarget.parentElement as HTMLElement).style.display = "none")} />
        </Link>
      )}
      <div className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="rounded-full bg-accent/15 px-2 py-0.5 font-semibold text-accent">{CATEGORY_LABEL[thread.category]}</span>
          {teamName && <span>{teamName}</span>}
          <span suppressHydrationWarning>{fmtRelative(thread.lastPublishedAt)}</span>
          {articles.length > 1 && <span className="ms-auto font-semibold text-hot">שרשור מרכזי · <span className="num">{fmtNum(articles.length)}</span> מקורות</span>}
        </div>

        <Link href={`/story/${thread.id}`} className="block">
          <h3 className="text-lg font-extrabold leading-snug">{thread.titleHe}</h3>
        </Link>
        {rewritten && <p className="mt-1 text-[11px] text-muted">הכותרת נוטרלה אוטומטית מסגנון סנסציוני</p>}

        {articles.length > 1 && (
          <div role="tablist" aria-label="מקורות הדיווח" className="scroll-x mt-3">
            {articles.map((a, i) => (
              <button key={a.id} role="tab" aria-selected={i === active} className="chip" onClick={() => setActive(i)}>
                {a.sourceName}
              </button>
            ))}
          </div>
        )}

        <div role="tabpanel" className="mt-3 rounded-xl bg-surface2/40 p-3">
          {current.neutralTitle !== thread.titleHe && <p className="text-sm font-semibold">{current.neutralTitle}</p>}
          {current.summary && <p className="mt-1 text-sm leading-6 text-fg/90">{current.summary}</p>}
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-muted">מקור: {current.sourceName}</span>
            <Link href={`/story/${thread.id}?a=${current.id}`} className="font-semibold text-accent">
              לקריאה מלאה ←
            </Link>
          </div>
        </div>

        {thread.vibeOptimistic !== null && thread.vibeWorried !== null && (
          <div className="mt-3">
            <VibeBar optimistic={thread.vibeOptimistic} worried={thread.vibeWorried} />
          </div>
        )}
      </div>
    </article>
  );
}
