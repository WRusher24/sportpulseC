import { NextResponse } from "next/server";
import { getRepo } from "@/lib/data";
import type { ArticleCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

const CATEGORIES: ArticleCategory[] = ["football_israel", "football_world", "basketball_israel", "basketball_world", "transfers", "other"];

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const cat = p.get("category");
  const threads = await getRepo().listThreads({
    category: CATEGORIES.includes(cat as ArticleCategory) ? (cat as ArticleCategory) : undefined,
    teamId: p.get("team") || undefined,
    q: p.get("q")?.slice(0, 80) || undefined,
    limit: Math.min(30, Math.max(1, Number(p.get("limit")) || 12)),
    offset: Math.max(0, Number(p.get("offset")) || 0)
  });
  return NextResponse.json({ threads }, { headers: { "cache-control": "public, max-age=15, s-maxage=30, stale-while-revalidate=60" } });
}
