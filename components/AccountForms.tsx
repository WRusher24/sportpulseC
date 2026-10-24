"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { loginAction, logoutAction, registerAction } from "@/app/actions";

export function AuthForms() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (form: FormData) =>
    start(async () => {
      setError(null);
      const common = { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") };
      const r = mode === "login" ? await loginAction(common) : await registerAction({ ...common, displayName: String(form.get("displayName") ?? "") });
      if (!r.ok) return setError(r.error);
      router.push("/my-club");
      router.refresh();
    });

  return (
    <div className="card">
      <div role="tablist" className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-bg p-1">
        {(["login", "register"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); }} className={`rounded-lg py-2 text-sm font-semibold ${mode === m ? "bg-accent text-accent-fg" : "text-muted"}`}>
            {m === "login" ? "התחברות" : "הרשמה"}
          </button>
        ))}
      </div>
      <form action={submit} className="space-y-3">
        {mode === "register" && (
          <div>
            <label htmlFor="displayName" className="mb-1 block text-sm font-semibold">שם תצוגה</label>
            <input id="displayName" name="displayName" type="text" className="input" required minLength={2} maxLength={40} autoComplete="nickname" placeholder="איך יקראו לכם באפליקציה" />
          </div>
        )}
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-semibold">אימייל</label>
          <input id="email" name="email" type="email" dir="ltr" className="input text-start" required autoComplete="email" placeholder="name@example.com" />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-semibold">סיסמה {mode === "register" && <span className="font-normal text-muted">(לפחות 8 תווים)</span>}</label>
          <input id="password" name="password" type="password" dir="ltr" className="input text-start" required minLength={mode === "register" ? 8 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </div>
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <button className="btn-primary w-full" disabled={pending}>{pending ? "רגע…" : mode === "login" ? "התחברות" : "יצירת חשבון"}</button>
      </form>
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button className="btn-ghost" disabled={pending} onClick={() => start(async () => { await logoutAction(); router.push("/"); router.refresh(); })}>התנתקות</button>
  );
}
