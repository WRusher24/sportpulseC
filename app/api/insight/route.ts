import { NextResponse } from "next/server";
import { matchInsight } from "@/lib/ai/analyst";
import { getRepo } from "@/lib/data";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";
import { credentialsForRequest } from "@/lib/server/request-credentials";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const matchId = new URL(req.url).searchParams.get("matchId");
  if (!matchId || matchId.length > 160) return NextResponse.json({ error: "חסר מזהה משחק" }, { status: 400 });
  const creds = await credentialsForRequest(req);
  if (creds.ai.source === "env") {
    const rl = rateLimit(`insight:${clientIp(req)}`, 30, 3_600_000);
    if (!rl.ok) return NextResponse.json({ error: "חרגתם ממכסת התובנות לשעה" }, { status: 429 });
  }
  try {
    const result = await matchInsight(getRepo(), creds.ai, matchId);
    if (!result) return NextResponse.json({ error: "המשחק לא נמצא" }, { status: 404 });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[insight]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "לא הצלחנו להפיק תובנה כרגע. נסו שוב בעוד רגע." }, { status: 500 });
  }
}
