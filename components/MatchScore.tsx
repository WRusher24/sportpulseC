import type { MatchStatus } from "@/lib/types";
import { isLiveStatus } from "@/lib/data/live-sim";
import { Score } from "./Score";

type Props = { status: MatchStatus; homeScore: number | null; awayScore: number | null; size?: "sm" | "md" | "lg" };

/** The match status decides the layout: UPCOMING shows a dash, LIVE and FINAL show the score (FINAL slightly muted when unknown). */
export function MatchScore({ status, homeScore, awayScore, size = "md" }: Props) {
  const showScore = status === "finished" || isLiveStatus(status);
  return <Score home={showScore ? homeScore : null} away={showScore ? awayScore : null} size={size} />;
}
