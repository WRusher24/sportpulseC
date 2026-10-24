import { getDb } from "@/db/client";
import { DbRepo } from "./db";
import { MemoryRepo } from "./memory";
import type { Repo } from "./repo";

const g = globalThis as unknown as { __sp_repo?: Repo };

/** Neon/Drizzle when DATABASE_URL is set, otherwise the in-memory baseline store (zero-config local mode). */
export function getRepo(): Repo {
  if (!g.__sp_repo) {
    const db = getDb();
    g.__sp_repo = db ? new DbRepo(db) : new MemoryRepo();
  }
  return g.__sp_repo;
}
