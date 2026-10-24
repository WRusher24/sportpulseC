"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ThreadDTO } from "@/lib/types";
import { ThreadCard } from "./ThreadCard";

type Props = { initial: ThreadDTO[]; query: { category?: string; team?: string; q?: string }; pageSize: number; teamNames: Record<string, string> };

const cursorOf = (t: ThreadDTO) => btoa(unescape(encodeURIComponent(`${t.lastPublishedAt}|${t.id}`))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * One unified timeline across Sport5, ONE, Sport1, Ynet and Walla (duplicate stories are already merged into master threads).
 * Infinite scroll: an IntersectionObserver sentinel loads the next chunk with a keyset cursor, so nothing is skipped or
 * repeated even while new stories arrive at the top.
 */
export function FeedList({ initial, query, pageSize, teamNames }: Props) {
  const [threads, setThreads] = useState(initial);
  const [done, setDone] = useState(initial.length < pageSize);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const cursor = useRef<string | null>(initial.length >= pageSize ? cursorOf(initial[initial.length - 1]) : null);

  const loadMore = useCallback(async () => {
    if (busy.current || !cursor.current) return;
    busy.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const p = new URLSearchParams({ limit: String(pageSize), cursor: cursor.current });
      if (query.category) p.set("category", query.category);
      if (query.team) p.set("team", query.team);
      if (query.q) p.set("q", query.q);
      const res = await fetch(`/api/feed?${p}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { threads: ThreadDTO[]; nextCursor: string | null };
      setThreads((cur) => [...cur, ...data.threads.filter((t) => !cur.some((c) => c.id === t.id))]);
      cursor.current = data.nextCursor;
      if (!data.nextCursor) setDone(true);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [pageSize, query.category, query.team, query.q]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || done || failed) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void loadMore(), { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [done, failed, loadMore, threads.length]);

  if (threads.length === 0) {
    return <p className="card text-center text-sm text-muted">לא נמצאו ידיעות התואמות את הסינון. הידיעות נאספות אוטומטית מספורט 5, ONE, ספורט 1, ידיעות ספורט ווואלה! ספורט – נסו שוב בעוד כמה דקות.</p>;
  }
  return (
    <div className="space-y-4">
      {threads.map((t) => (
        <ThreadCard key={t.id} thread={t} teamName={t.teamId ? teamNames[t.teamId] : undefined} />
      ))}
      <div ref={sentinel} aria-hidden className="h-px" />
      {loading && <p role="status" className="py-3 text-center text-sm text-muted">טוענים עוד ידיעות…</p>}
      {failed && <button className="btn-ghost w-full" onClick={() => { setFailed(false); void loadMore(); }}>הטעינה נכשלה – נסו שוב</button>}
      {done && <p className="py-3 text-center text-xs text-muted">הגעתם לסוף – כל הידיעות שנאספו עד כה.</p>}
    </div>
  );
}
