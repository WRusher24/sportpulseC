"use client";

import { useState } from "react";
import { fmtDateTime } from "@/lib/format";
import type { ArticleDTO } from "@/lib/types";

function Body({ text }: { text: string }) {
  // Text is stored as plain text (no HTML survives ingestion) and rendered as React text nodes - no injection surface.
  return (
    <div className="prose-he">
      {text.split(/\n{2,}/).map((block, i) =>
        block.startsWith("## ") ? (
          <h2 key={i} className="mt-6 text-xl font-extrabold">{block.slice(3)}</h2>
        ) : (
          <p key={i}>{block}</p>
        )
      )}
    </div>
  );
}

export function SourceCredit({ article }: { article: ArticleDTO }) {
  return (
    <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line/50 pt-4 text-sm">
      <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-2 rounded-full border border-line/70 bg-surface2/50 px-3 py-1.5 font-semibold hover:border-accent">
        <span className="text-muted">מקור:</span>
        <span>{article.sourceName}</span>
        <span aria-hidden>↗</span>
      </a>
      <span className="text-xs text-muted">הזכויות שמורות למקור. לכתבה המקורית לחצו על התגית.</span>
    </footer>
  );
}

export function StoryReader({ articles, initialId }: { articles: ArticleDTO[]; initialId?: string }) {
  const start = Math.max(0, articles.findIndex((a) => a.id === initialId));
  const [i, setI] = useState(start);
  const a = articles[i] ?? articles[0];
  if (!a) return null;
  const rewritten = a.neutralTitle !== a.originalTitle && a.clickbaitScore >= 40;

  return (
    <div>
      {articles.length > 1 && (
        <div role="tablist" aria-label="מקורות הדיווח" className="scroll-x mb-4">
          {articles.map((x, idx) => (
            <button key={x.id} role="tab" aria-selected={idx === i} className="chip" onClick={() => setI(idx)}>
              {x.sourceName}
            </button>
          ))}
        </div>
      )}
      <article>
        <h1 className="text-2xl font-extrabold leading-snug sm:text-3xl">{a.neutralTitle}</h1>
        {rewritten && (
          <p className="mt-2 rounded-lg bg-surface2/50 px-3 py-2 text-xs text-muted">
            הכותרת נוטרלה אוטומטית. הכותרת המקורית ב{a.sourceName}: <span className="text-fg/80">&quot;{a.originalTitle}&quot;</span>
          </p>
        )}
        <p className="mt-3 text-xs text-muted">
          {a.author ? <span>{a.author} · </span> : null}
          <span className="num">{fmtDateTime(a.publishedAt)}</span>
        </p>
        {a.imageUrl && (
          <figure className="mt-4 overflow-hidden rounded-2xl bg-surface2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.imageUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="max-h-[420px] w-full object-cover" onError={(e) => ((e.currentTarget.parentElement as HTMLElement).style.display = "none")} />
          </figure>
        )}
        {a.summary && (
          <aside className="mt-4 rounded-xl border-s-4 border-accent bg-accent/10 p-3 text-sm leading-6">
            <strong className="me-1">בקצרה:</strong>
            {a.summary}
          </aside>
        )}
        <div className="mt-5">
          <Body text={a.fullText} />
        </div>
        <SourceCredit article={a} />
      </article>
    </div>
  );
}
