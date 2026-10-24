import Link from "next/link";
import type { MatchDTO, TeamDTO } from "@/lib/types";
import { Score } from "./Score";
import { StatusBadge } from "./StatusBadge";

export function MatchRow({ match, teams }: { match: MatchDTO; teams: Map<string, TeamDTO> }) {
  const home = teams.get(match.homeTeamId);
  const away = teams.get(match.awayTeamId);
  return (
    <Link href={`/match-center/${match.id}`} className="flex min-h-[56px] items-center gap-2 border-t border-line/40 px-3 py-2 first:border-t-0 hover:bg-surface2/40">
      <div className="w-14 shrink-0 text-center"><StatusBadge status={match.status} minute={match.minute} kickoff={match.matchTimestamp} /></div>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{home?.nameHe ?? match.homeTeamId}</span>
      <Score home={match.homeScore} away={match.awayScore} size="sm" />
      <span className="min-w-0 flex-1 truncate text-end text-sm font-semibold">{away?.nameHe ?? match.awayTeamId}</span>
    </Link>
  );
}
