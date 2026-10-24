import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;

export function createDb(url: string) {
  return drizzle(neon(url), { schema });
}

let cached: Database | null = null;

/** Returns the shared Drizzle client, or null when DATABASE_URL is not configured. */
export function getDb(): Database | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  cached ??= createDb(url);
  return cached;
}
