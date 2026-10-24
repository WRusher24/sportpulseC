import { getRepo } from "@/lib/data";
import { systemCredentials } from "@/lib/server/request-credentials";
import { runMaintenance } from "./maintenance";

const STALE_MS = 5 * 60_000;
const g = globalThis as unknown as { __sp_lazy?: { checkedAt: number; running: boolean } };
const state = (g.__sp_lazy ??= { checkedAt: 0, running: false });

/**
 * "Refresh on visit": when the newest ingestion run is older than 5 minutes, a visitor's request schedules a background
 * cycle (via `after()`). Together with the daily Vercel Cron (Hobby plan limit) and the optional GitHub Actions trigger,
 * this keeps news and scores at most ~5 minutes old whenever anyone is using the app, with zero extra services.
 */
export async function refreshIfStale(): Promise<void> {
  if (process.env.DISABLE_LAZY_REFRESH || state.running || Date.now() - state.checkedAt < 60_000) return;
  state.checkedAt = Date.now();
  try {
    const repo = getRepo();
    const last = await repo.lastIngestAt();
    if (last && Date.now() - last.getTime() < STALE_MS) return;
    state.running = true;
    await runMaintenance({ repo, creds: systemCredentials(), budgetMs: 45_000 });
  } catch (e) {
    console.warn("[refresh] background cycle failed:", e instanceof Error ? e.message : e);
  } finally {
    state.running = false;
  }
}
