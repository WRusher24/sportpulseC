import { cookies } from "next/headers";
import { getRepo } from "@/lib/data";
import type { UserRecord } from "@/lib/data/repo";
import type { SessionUser } from "@/lib/types";
import { signSession, verifySession, MAX_AGE_S } from "./session-token";

export const SESSION_COOKIE = "sp_session";
export const TEAM_COOKIE = "sp_team";

export async function setSessionCookie(userId: string) {
  (await cookies()).set(SESSION_COOKIE, signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getUserRecord(): Promise<UserRecord | null> {
  const id = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  return id ? getRepo().getUserById(id) : null;
}

export const toSessionUser = (u: UserRecord): SessionUser => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
  favoriteTeamId: u.favoriteTeamId,
  themePreference: u.themePreference,
  notificationPrefs: u.notificationPrefs,
  hasStoredKeys: Boolean(u.customApiKeysJson)
});

export async function getSessionUser(): Promise<SessionUser | null> {
  const u = await getUserRecord();
  return u ? toSessionUser(u) : null;
}

/** Favorite team: account value for signed-in users, otherwise the cookie set by the My Club onboarding. */
export async function getFavoriteTeamId(): Promise<string | null> {
  const user = await getUserRecord();
  if (user?.favoriteTeamId) return user.favoriteTeamId;
  return (await cookies()).get(TEAM_COOKIE)?.value ?? null;
}
