"use client";

import { useState, useTransition } from "react";
import { castVibeVoteAction } from "@/app/actions";

export function VibeVote({ threadId, signedIn }: { threadId: string; signedIn: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!signedIn) return <p className="text-xs text-muted">התחברו כדי להצביע ולהשפיע על מד האווירה.</p>;
  const vote = (v: "optimistic" | "worried") =>
    start(async () => {
      const r = await castVibeVoteAction(threadId, v);
      setMsg(r.ok ? "תודה! ההצבעה נקלטה." : r.error);
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm">איך אתם מרגישים?</span>
      <button className="btn-ghost !min-h-[40px]" disabled={pending} onClick={() => vote("optimistic")}>אופטימי</button>
      <button className="btn-ghost !min-h-[40px]" disabled={pending} onClick={() => vote("worried")}>מודאג</button>
      {msg && <span role="status" className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
