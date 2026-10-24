"use client";

import { useState, useTransition } from "react";
import type { ThreadDTO } from "@/lib/types";
import { ThreadCard } from "./ThreadCard";

type Props = { initial: ThreadDTO[]; query: { category?: string; team?: string; q?: string }; pageSize: number; teamNames: Record<string, string> };

export function FeedList({ initial, query, pageSize, teamNames }: Props) {
  const [threads, setThreads] = useState(initial);
  const [done, setDone] = useState(initial.length < pageSize);
  const [pending, start] = useTransition();

  const more = () =>
    start(async () => {
      const p = new URLSearchParams({ limit: String(pageSize), offset: String(threads.length) });
      if (query.category) p.set("category", query.category);
      if (query.team) p.set("team", query.team);
      if (query.q) p.set("q", query.q);
      const res = await fetch(`/api/feed?${p}`);
      if (!res.ok) return;
      const data = (await res.json()) as { threads: ThreadDTO[] };
      setThreads((cur) => [...cur, ...data.threads.filter((t) => !cur.some((c) => c.id === t.id))]);
      if (data.threads.length < pageSize) setDone(true);
    });

  if (threads.length === 0) {
    return <p className="card text-center text-sm text-muted">לא נמצאו ידיעות התואמות את הסינון. נסו קטגוריה אחרת או חיפוש אחר.</p>;
  }
  return (
    <div className="space-y-4">
      {threads.map((t) => (
        <ThreadCard key={t.id} thread={t} teamName={t.teamId ? teamNames[t.teamId] : undefined} />
      ))}
      {!done && (
        <button className="btn-ghost w-full" onClick={more} disabled={pending}>
          {pending ? "טוענים…" : "טען עוד ידיעות"}
        </button>
      )}
    </div>
  );
}
