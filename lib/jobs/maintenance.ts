import type { Repo } from "@/lib/data/repo";
import { runIngestion, type IngestReport } from "@/lib/ingest/pipeline";
import type { Credentials } from "@/lib/server/credentials";
import { providerFor } from "@/lib/sports/factory";
import { hasActiveMatches, leaguesDueForSync, syncLeague, syncLive } from "@/lib/sports/sync";

export type MaintenanceReport = { news: IngestReport; sports: Record<string, unknown> };

/**
 * One maintenance cycle, shared by the Vercel Cron route, the optional GitHub Actions 5-minute trigger and the
 * on-visit refresh: news ingestion + AI enrichment, then live-data sync (free ESPN/portal chain or a paid key).
 */
export async function runMaintenance(opts: { repo: Repo; creds: Credentials; budgetMs?: number }): Promise<MaintenanceReport> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 50_000;
  const { repo, creds } = opts;
  const news = await runIngestion({ repo, creds, budgetMs: Math.round(budget * 0.7) });

  const sports: Record<string, unknown> = { provider: creds.sports.provider };
  try {
    const provider = await providerFor(repo, creds.sports);
    if (provider && Date.now() - started < budget - 8_000) {
      const leagues = await repo.listLeagues();
      const due = (await leaguesDueForSync(repo, leagues, provider)).slice(0, provider.liveDirect ? 2 : 8);
      sports.fixtures = [];
      for (const l of due) {
        if (Date.now() - started > budget - 4_000) break;
        (sports.fixtures as unknown[]).push({ league: l.id, ...(await syncLeague(repo, provider, l)) });
      }
      if (Date.now() - started < budget - 3_000 && (await hasActiveMatches(repo))) sports.live = await syncLive(repo, provider, leagues);
    }
  } catch (e) {
    sports.error = e instanceof Error ? e.message : String(e);
  }
  return { news, sports };
}
