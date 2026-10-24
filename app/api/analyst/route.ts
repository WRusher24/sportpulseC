import { z } from "zod";
import { analystReply } from "@/lib/ai/analyst";
import { AiError } from "@/lib/ai/client";
import { getRepo } from "@/lib/data";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";
import { credentialsForRequest } from "@/lib/server/request-credentials";
import { getFavoriteTeamId } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) })).min(1).max(40),
  teamId: z.string().max(80).nullish()
});

/** Streams the analyst's answer as plain text. Keys: browser headers -> account -> env. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user") {
    return Response.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }
  const creds = await credentialsForRequest(req);

  // System-funded AI calls are rate limited; users who bring their own key are not.
  if (creds.ai.source === "env") {
    const rl = rateLimit(`analyst:${clientIp(req)}`, 30, 3_600_000);
    if (!rl.ok) return Response.json({ error: `חרגתם ממכסת השאלות לשעה. נסו שוב בעוד ${rl.retryAfterS} שניות, או הוסיפו מפתח AI אישי בהגדרות.` }, { status: 429 });
  }

  const messages = parsed.data.messages;
  const question = messages.at(-1)!.content;
  const favorite = parsed.data.teamId ?? (await getFavoriteTeamId());
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of analystReply(creds.ai, getRepo(), messages.slice(0, -1), question, favorite)) controller.enqueue(encoder.encode(chunk));
      } catch (e) {
        const msg = e instanceof AiError ? e.message : "אירעה שגיאה בעת יצירת התשובה";
        controller.enqueue(encoder.encode(`\n\n⚠️ ${msg}`));
      } finally {
        controller.close();
      }
    }
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no", "x-ai-source": creds.ai.provider ? creds.ai.source : "none" } });
}
