import { Suspense } from "react";
import { FeedFilters } from "@/components/FeedFilters";
import { FeedList } from "@/components/FeedList";
import { LiveTicker } from "@/components/LiveTicker";
import { getRepo } from "@/lib/data";
import { CATEGORY_LABEL } from "@/lib/he";
import { getFavoriteTeamId } from "@/lib/server/session";
import { systemCredentials } from "@/lib/server/request-credentials";
import { getProvider } from "@/lib/sports";
import { liveTicker } from "@/lib/sports/sync";
import type { ArticleCategory } from "@/lib/types";

export const dynamic = "force-dynamic";
const PAGE = 10;

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ cat?: string; q?: string; mine?: string }> }) {
  const sp = await searchParams;
  const repo = getRepo();
  const favorite = await getFavoriteTeamId();
  const category = sp.cat && sp.cat in CATEGORY_LABEL ? (sp.cat as ArticleCategory) : undefined;
  const team = sp.mine === "1" && favorite ? favorite : undefined;
  const q = sp.q?.slice(0, 80);

  const [threads, teams, ticker] = await Promise.all([
    repo.listThreads({ category, teamId: team, q, limit: PAGE }),
    repo.listTeams(),
    liveTicker(repo, getProvider(systemCredentials().sports))
  ]);
  const teamNames = Object.fromEntries(teams.map((t) => [t.id, t.nameHe]));
  const key = `${category ?? ""}|${team ?? ""}|${q ?? ""}`;

  return (
    <>
      <LiveTicker initial={ticker.items} />
      <h1 className="mb-3 text-2xl font-extrabold">חדשות הספורט</h1>
      <Suspense>
        <FeedFilters hasFavorite={Boolean(favorite)} />
      </Suspense>
      <FeedList key={key} initial={threads} query={{ category, team, q }} pageSize={PAGE} teamNames={teamNames} />
    </>
  );
}
