import { NextResponse } from "next/server";
import { z } from "zod";
import { AiError, complete } from "@/lib/ai/client";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";
import { credentialsForRequest } from "@/lib/server/request-credentials";
import { EspnProvider } from "@/lib/sports/espn";
import { getJson } from "@/lib/sports/http";
import type { LeagueDTO } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Verifies the key the browser just supplied (via headers) with the cheapest possible provider call. */
export async function POST(req: Request) {
  const parsed = z.object({ target: z.enum(["ai", "sports"]) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "בקשה לא תקינה" }, { status: 400 });
  const rl = rateLimit(`keytest:${clientIp(req)}`, 20, 600_000);
  if (!rl.ok) return NextResponse.json({ ok: false, message: "יותר מדי בדיקות, נסו שוב מאוחר יותר" }, { status: 429 });

  const creds = await credentialsForRequest(req);
  try {
    if (parsed.data.target === "ai") {
      if (!creds.ai.provider) return NextResponse.json({ ok: false, message: "לא הוגדר מפתח AI" });
      await complete(creds.ai, { system: "Reply with the single word OK.", messages: [{ role: "user", content: "ping" }], maxTokens: 16 });
      return NextResponse.json({ ok: true, message: `החיבור תקין (${creds.ai.provider}, מודל ${creds.ai.model}, מקור: ${sourceHe(creds.ai.source)})` });
    }
    const s = creds.sports;
    if (s.provider === "api-football" && s.apiFootballKey) {
      await getJson<unknown>("https://v3.football.api-sports.io/status", { "x-apisports-key": s.apiFootballKey }, 0);
      return NextResponse.json({ ok: true, message: `המפתח של API-Football תקין (מקור: ${sourceHe(s.source)})` });
    }
    if (s.provider === "sportmonks" && s.sportmonksToken) {
      await getJson<unknown>(`https://api.sportmonks.com/v3/core/my/usage?api_token=${encodeURIComponent(s.sportmonksToken)}`, {}, 0);
      return NextResponse.json({ ok: true, message: `הטוקן של Sportmonks תקין (מקור: ${sourceHe(s.source)})` });
    }
    if (s.provider === "mock") return NextResponse.json({ ok: false, message: "נתונים חיים כבויים – בחרו מקור חינמי או ספק בתשלום" });
    const table = await new EspnProvider().standings({ id: "epl", sportType: "football" } as LeagueDTO);
    return NextResponse.json(table.length ? { ok: true, message: `המקור החינמי פעיל (ESPN החזיר ${table.length} קבוצות). סריקת הפורטלים הישראליים רצה ברקע ובודקת את עצמה בכל סבב.` } : { ok: false, message: "ESPN לא החזיר נתונים כרגע; המערכת תנסה את סריקת הפורטלים הישראליים" });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof AiError || e instanceof Error ? e.message : "הבדיקה נכשלה" });
  }
}

const sourceHe = (s: string) => (s === "user" ? "מפתח אישי בדפדפן" : s === "account" ? "מפתח מסונכרן בחשבון" : s === "env" ? "משתנה סביבה של המערכת" : "אין");
