import Link from "next/link";
import type { ReactNode } from "react";
import { ApiKeysPanel } from "@/components/ApiKeysPanel";
import { ExportPanel } from "@/components/ExportPanel";
import { NotificationPanel } from "@/components/NotificationPanel";
import { ThemePicker } from "@/components/ThemePicker";
import { getRepo } from "@/lib/data";
import { getSessionUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "הגדרות" };

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="card">
      <h2 id={id} className="mb-3 text-lg font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  const user = await getSessionUser();
  const team = user?.favoriteTeamId ? await getRepo().getTeam(user.favoriteTeamId) : null;
  return (
    <>
      <h1 className="mb-4 text-2xl font-extrabold">הגדרות</h1>
      <div className="space-y-5">
        <Section id="acc" title="חשבון">
          {user ? (
            <p className="text-sm">מחוברים כ<b> {user.displayName}</b> ({user.email}){team ? ` · קבוצה: ${team.nameHe}` : ""} · <Link href="/account" className="text-accent">ניהול חשבון</Link></p>
          ) : (
            <p className="text-sm">לא מחוברים. <Link href="/account" className="font-bold text-accent">התחברות או הרשמה</Link> מאפשרות דירוג שחקנים, הצבעות אווירה וסנכרון הגדרות בין מכשירים.</p>
          )}
        </Section>
        <Section id="theme" title="ערכת נושא"><ThemePicker /></Section>
        <Section id="keys" title="מפתחות API"><ApiKeysPanel signedIn={Boolean(user)} hasAccountKeys={Boolean(user?.hasStoredKeys)} /></Section>
        <Section id="notif" title="התראות"><NotificationPanel serverPrefs={user?.notificationPrefs ?? null} signedIn={Boolean(user)} /></Section>
        <Section id="export" title="ייצוא נתונים"><ExportPanel signedIn={Boolean(user)} /></Section>
        <p className="text-center text-xs text-muted">ספורט פאלס · SportPulse Israel · כל הכותרות מקושרות למקור המקורי</p>
      </div>
    </>
  );
}
