"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client/api";
import { RichText } from "./RichText";

type Msg = { role: "user" | "assistant"; content: string };
type Status = { ai: { provider: string | null; model: string; source: string }; sports: { provider: string; source: string } };

const SUGGESTIONS = [
  "למה מכבי חיפה איבדה את השליטה במחצית השנייה?",
  "מה תרחישי העלייה של מכבי תל אביב?",
  "איך הפועל באר שבע נראית העונה?",
  "How is Arsenal doing this season?",
  "מה הסיכוי של מכבי תל אביב בכדורסל לסיים ראשונה?"
];
const STORE = "sp_analyst_chat_v1";

const SOURCE_HE: Record<string, string> = { user: "מפתח אישי בדפדפן", account: "מפתח מסונכרן בחשבון", env: "מפתח מערכת" };

export function AnalystChat({ favoriteTeamId, favoriteTeamName }: { favoriteTeamId: string | null; favoriteTeamName: string | null }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORE);
      if (saved) setMessages(JSON.parse(saved) as Msg[]);
    } catch {
      /* ignore */
    }
    void apiFetch("/api/ai-status").then((r) => r.json()).then(setStatus).catch(() => undefined);
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-30)));
    } catch {
      /* ignore */
    }
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const history: Msg[] = [...messages, { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    abort.current = new AbortController();
    try {
      const res = await apiFetch("/api/analyst", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: history.slice(-12), teamId: favoriteTeamId }), signal: abort.current.signal });
      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "שגיאה בקבלת התשובה");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: acc }]);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMessages([...history, { role: "assistant", content: `⚠️ ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  };

  const aiLabel = status?.ai.provider ? `AI פעיל · ${status.ai.provider === "openai" ? "OpenAI" : "Anthropic"} · ${SOURCE_HE[status.ai.source] ?? ""}` : "מצב ניתוח נתונים (ללא מפתח AI)";

  return (
    <section aria-label="צ'אט עם האנליסט" className="flex flex-col">
      <div className="mb-3 flex items-center justify-between gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-1 font-semibold ${status?.ai.provider ? "bg-accent/15 text-accent" : "bg-surface2 text-muted"}`}>{status ? aiLabel : "בודק…"}</span>
        {messages.length > 0 && <button className="text-muted underline" onClick={() => setMessages([])}>שיחה חדשה</button>}
      </div>

      <div className="min-h-[40vh] space-y-3" aria-live="polite">
        {messages.length === 0 && (
          <div className="card">
            <p className="font-bold">שלום, אני האנליסט.</p>
            <p className="mt-1 text-sm text-muted">שאלו על טקטיקה, xG, כושר, או תרחישי סיום העונה – בעברית או באנגלית.{favoriteTeamName ? ` כשלא מציינים קבוצה אענה על ${favoriteTeamName}.` : ""}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip !h-auto !min-h-[36px] whitespace-normal py-1.5 text-start" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[92%] rounded-2xl px-4 py-3 ${m.role === "user" ? "rounded-ss-sm bg-accent text-accent-fg" : "rounded-se-sm border border-line/60 bg-surface"}`}>
              {m.role === "user" ? <p className="whitespace-pre-wrap text-sm leading-6">{m.content}</p> : m.content ? <RichText text={m.content} /> : <span className="text-sm text-muted">מנתח…</span>}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <form
        className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-20 -mx-4 mt-4 flex gap-2 border-t border-line/50 bg-bg/95 px-4 py-3 backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <label className="sr-only" htmlFor="analyst-q">שאלה לאנליסט</label>
        <input id="analyst-q" className="input flex-1" value={input} onChange={(e) => setInput(e.target.value)} placeholder="שאלו את האנליסט… / Ask the analyst…" maxLength={1200} autoComplete="off" />
        {busy ? (
          <button type="button" className="btn-ghost" onClick={() => abort.current?.abort()}>עצור</button>
        ) : (
          <button type="submit" className="btn-primary" disabled={!input.trim()}>שלח</button>
        )}
      </form>
    </section>
  );
}
