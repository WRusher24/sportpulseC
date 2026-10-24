"use client";

import { useEffect, useState, useTransition } from "react";
import { clearAccountKeysAction, syncKeysToAccountAction } from "@/app/actions";
import { apiFetch } from "@/lib/client/api";
import { KEY_PATTERN, keysToHeaders, sanitizeUserKeys, type UserKeys } from "@/lib/keys";
import { useKeys } from "./KeysProvider";

type Status = { ai: { provider: string | null; model: string; source: string }; sports: { provider: string; source: string } };
const SECRET_FIELDS = ["openaiKey", "anthropicKey", "apiFootballKey", "apiBasketballKey", "sportmonksToken"] as const;
type Check = { ok: boolean; message: string } | null;

const SOURCE_HE: Record<string, string> = { user: "מפתח אישי בדפדפן", account: "מפתח מסונכרן בחשבון", env: "משתנה סביבה של המערכת", none: "לא הוגדר" };

function SecretField({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold">{label}</label>
      <div className="flex gap-2">
        <input id={id} dir="ltr" type={show ? "text" : "password"} className="input flex-1 font-mono text-start" value={value} onChange={(e) => onChange(e.target.value.trim())} placeholder={placeholder ?? "הדביקו כאן את המפתח"} autoComplete="off" spellCheck={false} />
        <button type="button" className="btn-ghost !px-3" onClick={() => setShow((s) => !s)} aria-pressed={show}>{show ? "הסתר" : "הצג"}</button>
      </div>
    </div>
  );
}

export function ApiKeysPanel({ signedIn, hasAccountKeys }: { signedIn: boolean; hasAccountKeys: boolean }) {
  const { keys, ready, supported, save, clear } = useKeys();
  const [form, setForm] = useState<UserKeys>({});
  const [status, setStatus] = useState<Status | null>(null);
  const [aiCheck, setAiCheck] = useState<Check>(null);
  const [sportsCheck, setSportsCheck] = useState<Check>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => { if (ready) setForm(keys); }, [ready, keys]);
  const refreshStatus = () => void apiFetch("/api/ai-status").then((r) => r.json()).then(setStatus).catch(() => undefined);
  useEffect(() => { if (ready) refreshStatus(); }, [ready, keys]);

  const set = <K extends keyof UserKeys>(k: K, v: UserKeys[K] | "") => setForm((f) => { const next = { ...f }; if (v === "" || v === undefined) delete next[k]; else next[k] = v as UserKeys[K]; return next; });
  const invalid = SECRET_FIELDS.some((f) => Boolean(form[f]) && !KEY_PATTERN.test(form[f] as string));

  const onSave = () => start(async () => {
    try {
      await save(sanitizeUserKeys(form));
      setMsg({ ok: true, text: "המפתחות נשמרו בהצפנת AES-GCM במכשיר זה בלבד." });
    } catch {
      setMsg({ ok: false, text: "הדפדפן אינו תומך באחסון מוצפן (IndexedDB / WebCrypto). לא נשמר דבר." });
    }
  });

  const test = (target: "ai" | "sports") => start(async () => {
    const set = target === "ai" ? setAiCheck : setSportsCheck;
    set(null);
    try {
      const res = await fetch("/api/keys/test", { method: "POST", headers: { "content-type": "application/json", ...keysToHeaders(sanitizeUserKeys(form)) }, body: JSON.stringify({ target }), cache: "no-store" });
      set((await res.json()) as Check);
    } catch {
      set({ ok: false, message: "הבדיקה נכשלה – בדקו חיבור לאינטרנט" });
    }
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface2/40 p-3 text-xs leading-5 text-muted">
        המפתחות נשמרים <b className="text-fg">מוצפנים בדפדפן שלכם</b> (AES-GCM, מפתח הצפנה שאינו ניתן לשליפה). בכל בקשה הם נשלחים בכותרת HTTPS לשרת שלנו ומשמשים רק לאותה בקשה – לא נשמרים ולא נרשמים ביומן. הם <b className="text-fg">מקבלים עדיפות</b> על מפתחות המערכת (משתני סביבה).
        {!supported && <span className="mt-1 block font-bold text-bad">הדפדפן הנוכחי אינו תומך באחסון מוצפן.</span>}
      </div>

      {status && (
        <ul className="grid gap-2 text-sm sm:grid-cols-2" aria-label="מצב חיבורים נוכחי">
          <li className="rounded-xl border border-line/60 p-3"><span className="block text-xs text-muted">מנוע AI</span><b>{status.ai.provider ? `${status.ai.provider === "openai" ? "OpenAI" : "Anthropic"} · ${status.ai.model}` : "לא מחובר – מצב ניתוח נתונים"}</b><span className="block text-xs text-muted">מקור: {SOURCE_HE[status.ai.source]}</span></li>
          <li className="rounded-xl border border-line/60 p-3"><span className="block text-xs text-muted">נתוני ספורט חיים</span><b>{status.sports.provider === "mock" ? "לא מחובר – טבלאות פתיחה בלבד" : status.sports.provider}</b><span className="block text-xs text-muted">מקור: {SOURCE_HE[status.sports.source]}</span></li>
        </ul>
      )}

      <fieldset className="space-y-3 rounded-xl border border-line/60 p-3">
        <legend className="px-1 text-sm font-bold">בינה מלאכותית</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ai-provider" className="mb-1 block text-sm font-semibold">ספק מועדף</label>
            <select id="ai-provider" className="input" value={form.aiProvider ?? ""} onChange={(e) => set("aiProvider", e.target.value as UserKeys["aiProvider"] | "")}>
              <option value="">אוטומטי</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic (Claude)</option>
            </select>
          </div>
          <div>
            <label htmlFor="ai-model" className="mb-1 block text-sm font-semibold">מודל (אופציונלי)</label>
            <input id="ai-model" dir="ltr" className="input text-start font-mono" value={form.aiModel ?? ""} onChange={(e) => set("aiModel", e.target.value.trim())} placeholder="gpt-4o-mini / claude-haiku-5-5" />
          </div>
        </div>
        <SecretField id="k-openai" label="OpenAI API Key" value={form.openaiKey ?? ""} onChange={(v) => set("openaiKey", v)} placeholder="sk-…" />
        <SecretField id="k-anthropic" label="Anthropic API Key" value={form.anthropicKey ?? ""} onChange={(v) => set("anthropicKey", v)} placeholder="sk-ant-…" />
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-ghost" onClick={() => test("ai")} disabled={pending}>בדיקת מפתח AI</button>
          {aiCheck && <span role="status" className={`text-sm ${aiCheck.ok ? "text-good" : "text-bad"}`}>{aiCheck.message}</span>}
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-line/60 p-3">
        <legend className="px-1 text-sm font-bold">נתוני משחקים חיים</legend>
        <div>
          <label htmlFor="sp-provider" className="mb-1 block text-sm font-semibold">ספק נתונים</label>
          <select id="sp-provider" className="input" value={form.sportsProvider ?? ""} onChange={(e) => set("sportsProvider", e.target.value as UserKeys["sportsProvider"] | "")}>
            <option value="">אוטומטי (לפי המפתחות)</option><option value="api-football">API-Football (API-Sports)</option><option value="sportmonks">Sportmonks</option><option value="mock">ללא ספק חי</option>
          </select>
        </div>
        <SecretField id="k-apif" label="API-Football Key (כדורגל)" value={form.apiFootballKey ?? ""} onChange={(v) => set("apiFootballKey", v)} />
        <SecretField id="k-apib" label="API-Basketball Key (כדורסל, אופציונלי – ברירת מחדל: אותו מפתח)" value={form.apiBasketballKey ?? ""} onChange={(v) => set("apiBasketballKey", v)} />
        <SecretField id="k-sm" label="Sportmonks Token" value={form.sportmonksToken ?? ""} onChange={(v) => set("sportmonksToken", v)} />
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-ghost" onClick={() => test("sports")} disabled={pending}>בדיקת ספק נתונים</button>
          {sportsCheck && <span role="status" className={`text-sm ${sportsCheck.ok ? "text-good" : "text-bad"}`}>{sportsCheck.message}</span>}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={onSave} disabled={pending || invalid}>שמירה מוצפנת במכשיר</button>
        <button className="btn-ghost" onClick={() => { clear(); setForm({}); setMsg({ ok: true, text: "כל המפתחות נמחקו מהמכשיר." }); }}>מחיקת כל המפתחות</button>
      </div>
      {invalid && <p role="alert" className="text-sm text-bad">אחד המפתחות אינו בפורמט תקין (8-512 תווים: אותיות, ספרות ו-_-.:).</p>}
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}

      <div className="rounded-xl border border-line/60 p-3">
        <h3 className="text-sm font-bold">סנכרון בין מכשירים</h3>
        <p className="mb-2 mt-1 text-xs leading-5 text-muted">{signedIn ? "אפשר לשמור את המפתחות גם בחשבון שלכם, מוצפנים בצד השרת (AES-256-GCM), כדי שיפעלו בכל מכשיר." : "התחברו לחשבון כדי לסנכרן מפתחות בין מכשירים."}</p>
        {signedIn && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" disabled={pending || Object.keys(keys).length === 0} onClick={() => start(async () => { const r = await syncKeysToAccountAction(keys); setMsg(r.ok ? { ok: true, text: "המפתחות סונכרנו לחשבון (מוצפנים)." } : { ok: false, text: r.error }); refreshStatus(); })}>סנכרון מפתחות שמורים לחשבון</button>
            {hasAccountKeys && <button className="btn-ghost" disabled={pending} onClick={() => start(async () => { const r = await clearAccountKeysAction(); setMsg(r.ok ? { ok: true, text: "המפתחות הוסרו מהחשבון." } : { ok: false, text: r.error }); refreshStatus(); })}>הסרת מפתחות מהחשבון</button>}
          </div>
        )}
      </div>
    </div>
  );
}
