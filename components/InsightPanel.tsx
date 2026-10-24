"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { RichText } from "./RichText";

const TITLES = { pre: "תצוגה מקדימה", live: "עדכון משחק חי", post: "סיכום ותובנות" } as const;

export function InsightPanel({ matchId }: { matchId: string }) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; mode?: keyof typeof TITLES; text?: string; usedAi?: boolean }>({ status: "idle" });

  const run = async () => {
    setState({ status: "loading" });
    try {
      const res = await apiFetch(`/api/insight?matchId=${encodeURIComponent(matchId)}`);
      const data = (await res.json()) as { mode?: keyof typeof TITLES; text?: string; usedAi?: boolean; error?: string };
      if (!res.ok || !data.text) throw new Error(data.error ?? "שגיאה");
      setState({ status: "done", mode: data.mode, text: data.text, usedAi: data.usedAi });
    } catch (e) {
      setState({ status: "error", text: e instanceof Error ? e.message : "שגיאה" });
    }
  };

  return (
    <div className="card">
      <h3 className="mb-1 font-bold">תובנת האנליסט</h3>
      <p className="mb-3 text-sm text-muted">ניתוח לפני, במהלך ואחרי המשחק, על בסיס כושר, H2H, xG וסטטיסטיקות.</p>
      {state.status === "done" && state.mode && (
        <div className="mb-3 rounded-xl bg-surface2/40 p-3" aria-live="polite">
          <p className="mb-1 text-xs font-bold text-accent">{TITLES[state.mode]} {state.usedAi ? "· AI" : "· מבוסס נתונים"}</p>
          <RichText text={state.text ?? ""} />
        </div>
      )}
      {state.status === "error" && <p role="alert" className="mb-3 text-sm text-bad">{state.text}</p>}
      <button className="btn-primary" onClick={run} disabled={state.status === "loading"}>
        {state.status === "loading" ? "מנתח…" : state.status === "done" ? "רענון התובנה" : "קבלו תובנה"}
      </button>
    </div>
  );
}
