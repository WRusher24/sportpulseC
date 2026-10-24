"use client";

import { GUEST_PREFS_KEY } from "./LiveNotifier";

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ExportPanel({ signedIn }: { signedIn: boolean }) {
  const exportLocal = () => {
    const cookie = (n: string) => document.cookie.split("; ").find((c) => c.startsWith(`${n}=`))?.split("=")[1] ?? null;
    let notif: unknown = null;
    try { notif = JSON.parse(localStorage.getItem(GUEST_PREFS_KEY) ?? "null"); } catch { /* ignore */ }
    // API keys are deliberately excluded from every export.
    download("sportpulse-local-settings.json", { exportedAt: new Date().toISOString(), theme: cookie("sp_theme") ?? "dark", favoriteTeamId: cookie("sp_team"), notificationPrefs: notif });
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">ייצוא ההגדרות וההעדפות שלכם כקובץ JSON. מפתחות API לעולם אינם נכללים בייצוא.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost" onClick={exportLocal}>ייצוא הגדרות מקומיות</button>
        {signedIn ? <a className="btn-primary" href="/api/export" download>ייצוא נתוני החשבון והדירוגים</a> : <span className="self-center text-xs text-muted">התחברו כדי לייצא גם את הדירוגים שלכם.</span>}
      </div>
    </div>
  );
}
