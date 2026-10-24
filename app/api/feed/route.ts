import { NextResponse } from "next/server";
import { getRepo } from "@/lib/data";
import type { ArticleCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

const CATEGORIES: ArticleCategory[] = ["football_israel", "football_world", "basketball_israel", "basketball_world", "transfers", "other"];

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const cat = p.get("category");
  let before: { at: string; id: string } | undefined;
  const cursor = p.get("cursor");
  if (cursor) {
    try {
      const [at, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
      if (at && id && !Number.isNaN(Date.parse(at))) before = { at: new Date(at).toISOString(), id };
    } catch {
      /* malformed cursor: start from the top */
    }
  }
  const limit = Math.min(30, Math.max(1, Number(p.get("limit")) || 18));
  const threads = await getRepo().listThreads({
    before,
    category: CATEGORIES.includes(cat as ArticleCategory) ? (cat as ArticleCategory) : undefined,
    teamId: p.get("team") || undefined,
    q: p.get("q")?.slice(0, 80) || undefined,
    limit
  });
  const last = threads.at(-1);
  const nextCursor = threads.length === limit && last ? Buffer.from(`${last.lastPublishedAt}|${last.id}`).toString("base64url") : null;
  return NextResponse.json({ threads, nextCursor }, { headers: { "cache-control": "public, max-age=15, s-maxage=30, stale-while-revalidate=60" } });
}
