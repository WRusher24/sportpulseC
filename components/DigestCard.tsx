"use client";

import { useState, useTransition } from "react";
import { generateDigestAction } from "@/app/actions";
import { currentKeys } from "@/lib/client/api";
import { RichText } from "./RichText";

export function DigestCard({ teamId, teamName, initial, generatedBy }: { teamId: string; teamName: string; initial: string | null; generatedBy: string | null }) {
  const [content, setContent] = useState(initial);
  const [by, setBy] = useState(generatedBy);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const refresh = () =>
    start(async () => {
      setError(null);
      const r = await generateDigestAction(teamId, await currentKeys());
      if (r.ok) {
        setContent(r.digest.contentHe);
        setBy(r.digest.generatedBy);
      } else setError(r.error);
    });

  return (
    <section className="card border-hot/50" aria-labelledby="digest-h">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="digest-h" className="text-lg font-extrabold text-hot">מה חדש הבוקר</h2>
        <span className="text-[11px] text-muted">{by === "ai" ? "נכתב ב-AI" : "סיכום אוטומטי"} · מתעדכן כל יום ב-07:00</span>
      </div>
      <p className="mb-2 text-xs text-muted">סיכום של 60 שניות עבור {teamName}</p>
      {content ? <RichText text={content} /> : <p className="text-sm text-muted">הסיכום של היום טרם נוצר.</p>}
      {error && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}
      <button className="btn-ghost mt-3" onClick={refresh} disabled={pending}>{pending ? "מרעננים…" : "רענון עם המפתח שלי"}</button>
    </section>
  );
}
