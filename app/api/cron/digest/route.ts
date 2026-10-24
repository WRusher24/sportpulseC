import { NextResponse } from "next/server";
import { generateDigestsForTeams } from "@/lib/ai/digest";
import { getRepo } from "@/lib/data";
import { israelDayKey, israelHour } from "@/lib/format";
import { authorizeCron } from "@/lib/server/cron-auth";
import { systemCredentials } from "@/lib/server/request-credentials";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Default teams that always receive a digest, in addition to every user's favourite team. */
const DEFAULT_TEAMS = ["maccabi-tel-aviv-fc", "maccabi-haifa", "hapoel-beer-sheva", "beitar-jerusalem", "hapoel-tel-aviv-fc", "maccabi-tel-aviv-bc", "hapoel-jerusalem-bc", "hapoel-tel-aviv-bc"];

/**
 * Vercel cron expressions are UTC-only, so vercel.json schedules this route at 04:00 and 05:00 UTC.
 * Exactly one of those is 07:00 in Israel (summer / winter time); the other invocation exits immediately.
 */
export async function GET(req: Request) {
  if (!authorizeCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const hour = israelHour();
  if (!force && hour !== 7) return NextResponse.json({ ok: true, skipped: true, reason: `Israel hour is ${hour}, not 7` });

  const repo = getRepo();
  const favourites = await repo.listFavoriteTeamIds();
  const teamIds = [...new Set([...favourites, ...DEFAULT_TEAMS])].slice(0, 24);
  const generated = await generateDigestsForTeams(repo, systemCredentials().ai, teamIds, israelDayKey());
  return NextResponse.json({ ok: true, generated, teams: teamIds.length }, { headers: { "cache-control": "no-store" } });
}
