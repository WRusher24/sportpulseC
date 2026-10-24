"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateDigest } from "@/lib/ai/digest";
import { getRepo } from "@/lib/data";
import { israelDayKey } from "@/lib/format";
import { sanitizeUserKeys, type UserKeys } from "@/lib/keys";
import { credentialsForAction } from "@/lib/server/request-credentials";
import { rateLimit } from "@/lib/server/ratelimit";
import { encryptJson, hashPassword, verifyPassword } from "@/lib/server/secrets";
import { clearSessionCookie, getUserRecord, setSessionCookie, TEAM_COOKIE } from "@/lib/server/session";
import type { DigestDTO, NotificationPrefs, ThemeId } from "@/lib/types";

type Result<T = Record<never, never>> = ({ ok: true } & T) | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f‎‏‪-‮]/g, " ").replace(/\s+/g, " ").trim();

async function ip(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/* ------------------------------------------------------------------ account */

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("כתובת האימייל אינה תקינה").max(200),
  displayName: z.string().transform(clean).pipe(z.string().min(2, "השם חייב להכיל לפחות 2 תווים").max(40, "השם ארוך מדי")),
  password: z.string().min(8, "הסיסמה חייבת להכיל לפחות 8 תווים").max(200),
  favoriteTeamId: z.string().max(80).nullish()
});

export async function registerAction(input: unknown): Promise<Result> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "הנתונים אינם תקינים");
  if (!rateLimit(`register:${await ip()}`, 10, 3_600_000).ok) return fail("יותר מדי ניסיונות הרשמה. נסו שוב מאוחר יותר.");
  const repo = getRepo();
  if (await repo.getUserByEmail(parsed.data.email)) return fail("כתובת האימייל כבר רשומה. נסו להתחבר.");
  const fav = parsed.data.favoriteTeamId || (await cookies()).get(TEAM_COOKIE)?.value || null;
  const team = fav ? await repo.getTeam(fav) : null;
  const user = await repo.createUser({ email: parsed.data.email, displayName: parsed.data.displayName, passwordHash: await hashPassword(parsed.data.password), favoriteTeamId: team?.id ?? null });
  await setSessionCookie(user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function loginAction(input: unknown): Promise<Result> {
  const parsed = z.object({ email: z.string().trim().toLowerCase().max(200), password: z.string().max(200) }).safeParse(input);
  if (!parsed.success) return fail("הנתונים אינם תקינים");
  if (!rateLimit(`login:${await ip()}:${parsed.data.email}`, 10, 600_000).ok) return fail("יותר מדי ניסיונות התחברות. נסו שוב בעוד מספר דקות.");
  const user = await getRepo().getUserByEmail(parsed.data.email);
  // Verify against a dummy hash when the user is unknown so response timing does not reveal registered emails.
  const ok = user ? await verifyPassword(parsed.data.password, user.passwordHash) : (await verifyPassword(parsed.data.password, "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAA"), false);
  if (!user || !ok) return fail("אימייל או סיסמה שגויים");
  await setSessionCookie(user.id);
  const jar = await cookies();
  if (user.favoriteTeamId) jar.set(TEAM_COOKIE, user.favoriteTeamId, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  jar.set("sp_theme", user.themePreference, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function logoutAction(): Promise<Result> {
  await clearSessionCookie();
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ------------------------------------------------------------------ preferences */

export async function setFavoriteTeamAction(teamId: string | null): Promise<Result> {
  const repo = getRepo();
  const team = teamId ? await repo.getTeam(teamId) : null;
  if (teamId && !team) return fail("הקבוצה לא נמצאה");
  const jar = await cookies();
  if (team) jar.set(TEAM_COOKIE, team.id, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
  else jar.delete(TEAM_COOKIE);
  const user = await getUserRecord();
  if (user) await repo.updateUser(user.id, { favoriteTeamId: team?.id ?? null });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveThemeAction(theme: ThemeId): Promise<Result> {
  if (!z.enum(["dark", "light", "pitch", "night"]).safeParse(theme).success) return fail("ערכת נושא לא תקינה");
  const user = await getUserRecord();
  if (user) await getRepo().updateUser(user.id, { themePreference: theme });
  return { ok: true };
}

const prefsSchema = z.object({ goals: z.boolean(), kickoff: z.boolean(), finalWhistle: z.boolean(), breakingNews: z.boolean(), digest: z.boolean() });

export async function saveNotificationPrefsAction(prefs: NotificationPrefs): Promise<Result> {
  const parsed = prefsSchema.safeParse(prefs);
  if (!parsed.success) return fail("העדפות לא תקינות");
  const user = await getUserRecord();
  if (user) await getRepo().updateUser(user.id, { notificationPrefs: parsed.data });
  return { ok: true };
}

/* ------------------------------------------------------------------ API keys (account sync) */

/** Stores the browser's keys on the account, AES-256-GCM encrypted at rest, so they roam across devices. */
export async function syncKeysToAccountAction(keys: UserKeys): Promise<Result> {
  const user = await getUserRecord();
  if (!user) return fail("יש להתחבר כדי לסנכרן מפתחות לחשבון");
  const clean = sanitizeUserKeys(keys);
  await getRepo().updateUser(user.id, { customApiKeysJson: Object.keys(clean).length ? encryptJson(clean) : null });
  revalidatePath("/settings");
  return { ok: true };
}

export async function clearAccountKeysAction(): Promise<Result> {
  const user = await getUserRecord();
  if (!user) return fail("יש להתחבר");
  await getRepo().updateUser(user.id, { customApiKeysJson: null });
  revalidatePath("/settings");
  return { ok: true };
}

/* ------------------------------------------------------------------ fan ratings & vibe */

const ratingsSchema = z.object({
  matchId: z.string().max(160),
  ratings: z
    .array(
      z.object({
        playerName: z.string().max(120),
        rating: z.number().int().min(1, "הציון חייב להיות בין 1 ל-10").max(10, "הציון חייב להיות בין 1 ל-10"),
        note: z.string().max(280, "ההערה ארוכה מדי (עד 280 תווים)").nullish()
      })
    )
    .min(1)
    .max(40)
});

export async function saveRatingsAction(input: unknown): Promise<Result<{ saved: number }>> {
  const user = await getUserRecord();
  if (!user) return fail("יש להתחבר כדי לדרג שחקנים");
  const parsed = ratingsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "הנתונים אינם תקינים");
  const repo = getRepo();
  const found = await repo.getMatch(parsed.data.matchId);
  if (!found) return fail("המשחק לא נמצא");
  if (found.match.status !== "finished") return fail("ניתן לדרג שחקנים רק לאחר שריקת הסיום");
  const roster = new Set([...(found.match.lineUps?.home.players ?? []), ...(found.match.lineUps?.away.players ?? [])].map((p) => p.name));
  const rows = parsed.data.ratings.filter((r) => roster.has(r.playerName)).map((r) => ({ playerName: r.playerName, rating: r.rating, note: r.note ? clean(r.note) || null : null }));
  if (rows.length === 0) return fail("לא נמצאו שחקנים תקינים לדירוג");
  await repo.saveRatings(parsed.data.matchId, user.id, rows);
  revalidatePath(`/match-center/${parsed.data.matchId}`);
  return { ok: true, saved: rows.length };
}

export async function castVibeVoteAction(threadId: string, vote: "optimistic" | "worried"): Promise<Result> {
  const user = await getUserRecord();
  if (!user) return fail("יש להתחבר כדי להצביע");
  if (vote !== "optimistic" && vote !== "worried") return fail("הצבעה לא תקינה");
  if (!(await getRepo().getThread(threadId))) return fail("הידיעה לא נמצאה");
  await getRepo().castVote(threadId, user.id, vote);
  revalidatePath(`/story/${threadId}`);
  return { ok: true };
}

/* ------------------------------------------------------------------ digest */

/** Regenerates today's digest using the caller's own key (browser keys passed as an argument, then account, then env). */
export async function generateDigestAction(teamId: string, keys?: UserKeys): Promise<Result<{ digest: DigestDTO }>> {
  const user = await getUserRecord();
  const limiterKey = user ? `digest:${user.id}` : `digest:${await ip()}`;
  if (!rateLimit(limiterKey, 6, 3_600_000).ok) return fail("ניתן לרענן את הסיכום עד 6 פעמים בשעה");
  const creds = await credentialsForAction(keys);
  const digest = await generateDigest(getRepo(), creds.ai, teamId, israelDayKey());
  if (!digest) return fail("הקבוצה לא נמצאה");
  revalidatePath("/my-club");
  return { ok: true, digest };
}
