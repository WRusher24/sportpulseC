import Link from "next/link";
import { AuthForms, LogoutButton } from "@/components/AccountForms";
import { getRepo } from "@/lib/data";
import { getSessionUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "חשבון" };

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <>
        <h1 className="mb-1 text-2xl font-extrabold">התחברות והרשמה</h1>
        <p className="mb-4 text-sm text-muted">חשבון מאפשר לדרג שחקנים אחרי המשחק, להצביע במד האווירה ולשמור קבוצה, התראות ומפתחות בין מכשירים.</p>
        <AuthForms />
      </>
    );
  }
  const team = user.favoriteTeamId ? await getRepo().getTeam(user.favoriteTeamId) : null;
  return (
    <>
      <h1 className="mb-4 text-2xl font-extrabold">שלום, {user.displayName}</h1>
      <div className="card space-y-2 text-sm">
        <p><span className="text-muted">אימייל:</span> <span dir="ltr">{user.email}</span></p>
        <p><span className="text-muted">הקבוצה שלי:</span> {team ? team.nameHe : "לא נבחרה"} · <Link href="/my-club?change=1" className="text-accent">{team ? "החלפה" : "בחירה"}</Link></p>
        <p><span className="text-muted">מפתחות API בחשבון:</span> {user.hasStoredKeys ? "מסונכרנים (מוצפנים)" : "אין"} · <Link href="/settings#keys" className="text-accent">ניהול</Link></p>
        <div className="pt-2"><LogoutButton /></div>
      </div>
    </>
  );
}
