"use client";

import { useEffect, useState, useTransition } from "react";
import { saveNotificationPrefsAction } from "@/app/actions";
import { DEFAULT_NOTIFICATION_PREFS, type NotificationPrefs } from "@/lib/types";
import { GUEST_PREFS_KEY } from "./LiveNotifier";

const ROWS: Array<[keyof NotificationPrefs, string, string]> = [
  ["goals", "שערים", "התראה על כל שער של הקבוצה שלי"],
  ["kickoff", "תחילת משחק", "התראה כשהמשחק של הקבוצה שלי מתחיל"],
  ["finalWhistle", "שריקת סיום", "התראה עם התוצאה הסופית"],
  ["breakingNews", "חדשות מתפרצות", "ידיעות מרכזיות על הקבוצה שלי"],
  ["digest", "מה חדש הבוקר", "תזכורת לסיכום הבוקר ב-07:00"]
];

export function NotificationPanel({ serverPrefs, signedIn }: { serverPrefs: NotificationPrefs | null; signedIn: boolean }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(serverPrefs ?? DEFAULT_NOTIFICATION_PREFS);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [, start] = useTransition();

  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    if (!serverPrefs) {
      try { setPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...(JSON.parse(localStorage.getItem(GUEST_PREFS_KEY) ?? "{}") as Partial<NotificationPrefs>) }); } catch { /* ignore */ }
    }
  }, [serverPrefs]);

  const toggle = (k: keyof NotificationPrefs) => {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    try { localStorage.setItem(GUEST_PREFS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    if (signedIn) start(async () => { await saveNotificationPrefsAction(next); });
  };

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line/40 rounded-xl border border-line/60">
        {ROWS.map(([k, title, hint]) => (
          <li key={k} className="flex items-center justify-between gap-3 p-3">
            <div><p className="text-sm font-semibold">{title}</p><p className="text-xs text-muted">{hint}</p></div>
            <button role="switch" aria-checked={prefs[k]} aria-label={title} onClick={() => toggle(k)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${prefs[k] ? "bg-accent" : "bg-surface2"}`}>
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${prefs[k] ? "start-[1.375rem]" : "start-0.5"}`} />
            </button>
          </li>
        ))}
      </ul>
      {perm === "unsupported" ? (
        <p className="text-xs text-muted">הדפדפן אינו תומך בהתראות.</p>
      ) : perm === "granted" ? (
        <p className="text-xs text-good">התראות הדפדפן פעילות. הן נשלחות כשהאפליקציה פתוחה ובחרתם קבוצה.</p>
      ) : perm === "denied" ? (
        <p className="text-xs text-bad">ההתראות נחסמו בדפדפן. אפשרו אותן בהגדרות האתר.</p>
      ) : (
        <button className="btn-primary" onClick={async () => setPerm(await Notification.requestPermission())}>הפעלת התראות בדפדפן</button>
      )}
      {!signedIn && <p className="text-xs text-muted">ההעדפות נשמרות במכשיר זה. התחברו כדי לשמור אותן בחשבון.</p>}
    </div>
  );
}
