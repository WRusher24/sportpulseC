import { NextResponse } from "next/server";
import { getRepo } from "@/lib/data";
import { getUserRecord } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** GDPR-style data export for the signed-in user (never includes password hash or key material). */
export async function GET() {
  const user = await getUserRecord();
  if (!user) return NextResponse.json({ error: "יש להתחבר כדי לייצא נתונים" }, { status: 401 });
  const ratings = await getRepo().exportUserRatings(user.id);
  const payload = {
    exportedAt: new Date().toISOString(),
    profile: { email: user.email, displayName: user.displayName, favoriteTeamId: user.favoriteTeamId, themePreference: user.themePreference, notificationPrefs: user.notificationPrefs, createdAt: user.createdAt, hasSyncedApiKeys: Boolean(user.customApiKeysJson) },
    ratings
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": 'attachment; filename="sportpulse-export.json"', "cache-control": "no-store" }
  });
}
