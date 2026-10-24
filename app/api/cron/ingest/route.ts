import { NextResponse } from "next/server";
import { getRepo } from "@/lib/data";
import { runMaintenance } from "@/lib/jobs/maintenance";
import { authorizeCron } from "@/lib/server/cron-auth";
import { systemCredentials } from "@/lib/server/request-credentials";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Maintenance target: news ingestion + AI enrichment + live-data sync.
 * Triggered by Vercel Cron (daily on Hobby), by the GitHub Actions workflow every 5 minutes, and by any HTTP client holding CRON_SECRET.
 */
export async function GET(req: Request) {
  if (!authorizeCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const report = await runMaintenance({ repo: getRepo(), creds: systemCredentials(), budgetMs: 52_000 });
  return NextResponse.json({ ok: true, ...report }, { headers: { "cache-control": "no-store" } });
}
