import { NextResponse } from "next/server";
import { getRepo } from "@/lib/data";
import { runIngestion } from "@/lib/ingest/pipeline";
import { authorizeCron } from "@/lib/server/cron-auth";
import { systemCredentials } from "@/lib/server/request-credentials";
import { getProvider } from "@/lib/sports";
import { hasActiveMatches, leaguesDueForSync, syncLeague, syncLive } from "@/lib/sports/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron target (every 5 minutes): news ingestion + AI enrichment + live-data sync. */
export async function GET(req: Request) {
  if (!authorizeCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const repo = getRepo();
  const creds = systemCredentials();
  const started = Date.now();

  const news = await runIngestion({ repo, creds, budgetMs: 45_000 });

  const sports: Record<string, unknown> = { provider: creds.sports.provider };
  const provider = getProvider(creds.sports);
  if (provider && Date.now() - started < 50_000) {
    try {
      const leagues = await repo.listLeagues();
      const due = (await leaguesDueForSync(repo, leagues, provider)).slice(0, 2);
      sports.fixtures = await Promise.all(due.map(async (l) => ({ league: l.id, ...(await syncLeague(repo, provider, l)) })));
      if (await hasActiveMatches(repo)) sports.live = await syncLive(repo, provider, leagues);
    } catch (e) {
      sports.error = e instanceof Error ? e.message : String(e);
    }
  }
  return NextResponse.json({ ok: true, news, sports }, { headers: { "cache-control": "no-store" } });
}
