import { migrate } from "drizzle-orm/neon-http/migrator";
import { createDb } from "../db/client";

/** Applies the SQL migrations in ./drizzle. Returns false when DATABASE_URL is missing (zero-config in-memory mode). */
export async function runMigrations(): Promise<boolean> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[migrate] DATABASE_URL is not set - skipping migrations (app will run on the in-memory baseline).");
    return false;
  }
  const db = createDb(url);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[migrate] migrations applied");
  return true;
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  runMigrations().catch((e) => {
    console.error("[migrate] failed:", e);
    process.exit(1);
  });
}
