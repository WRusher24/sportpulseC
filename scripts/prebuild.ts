import { createDb } from "../db/client";
import { isDatabaseSeeded, seedDatabase } from "../db/seed";
import { DbRepo } from "../lib/data/db";
import { runIngestion } from "../lib/ingest/pipeline";
import { systemCredentials } from "../lib/server/request-credentials";
import { runMigrations } from "./migrate";

/**
 * Runs on every Vercel build (`vercel-build`): applies pending migrations, then seeds an empty database once.
 * Without DATABASE_URL this is a no-op so the project still builds and runs on the in-memory baseline.
 */
async function main() {
  const migrated = await runMigrations();
  if (!migrated) return;
  if (process.env.SKIP_DB_SEED) {
    console.log("[prebuild] SKIP_DB_SEED set - not seeding");
    return;
  }
  const db = createDb(process.env.DATABASE_URL as string);
  if (await isDatabaseSeeded(db)) {
    console.log("[prebuild] database already seeded");
    return;
  }
  console.log("[prebuild] seeding empty database...");
  console.log("[prebuild] seeded", await seedDatabase(db));
  if (process.env.SKIP_INGEST_ON_BUILD) return;
  // Best-effort first news pull so the feed is not empty on day one. Failures never fail the build.
  try {
    const report = await runIngestion({ repo: new DbRepo(db), creds: systemCredentials(), budgetMs: 40_000 });
    console.log(`[prebuild] initial ingestion: ${report.inserted} articles from ${report.sources.length} sources`);
  } catch (e) {
    console.warn("[prebuild] initial ingestion skipped:", e instanceof Error ? e.message : e);
  }
}

main().catch((e) => {
  console.error("[prebuild] failed:", e);
  process.exit(1);
});
