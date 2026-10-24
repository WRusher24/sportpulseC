"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { CATEGORY_LABEL } from "@/lib/he";
import type { ArticleCategory } from "@/lib/types";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as ArticleCategory[];

export function FeedFilters({ hasFavorite }: { hasFavorite: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [, start] = useTransition();
  const cat = params.get("cat");
  const mine = params.get("mine") === "1";

  const push = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    start(() => router.push(`/?${next}`));
  };

  return (
    <div className="mb-4 space-y-3">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          push({ q: q.trim() || null });
        }}
      >
        <label className="sr-only" htmlFor="feed-search">חיפוש ידיעות או קבוצות</label>
        <input id="feed-search" type="search" className="input" placeholder="חיפוש קבוצה, שחקן או נושא (עברית / English)" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      <div className="scroll-x" role="group" aria-label="סינון לפי קטגוריה">
        {hasFavorite && (
          <button className="chip" aria-pressed={mine} onClick={() => push({ mine: mine ? null : "1" })}>
            הקבוצה שלי
          </button>
        )}
        <button className="chip" aria-pressed={!cat} onClick={() => push({ cat: null })}>
          הכול
        </button>
        {CATEGORIES.map((c) => (
          <button key={c} className="chip" aria-pressed={cat === c} onClick={() => push({ cat: cat === c ? null : c })}>
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
    </div>
  );
}
