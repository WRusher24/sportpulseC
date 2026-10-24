import type { MatchDTO } from "@/lib/types";
import { isLiveStatus } from "./live-sim";

const MAX_LIVE_MS = 3.5 * 3_600_000;

/**
 * Last line of defence against stale or inconsistent provider/scraper rows. The match STATUS is authoritative for what is shown:
 *  - UPCOMING (scheduled/postponed): never carries a score or minute;
 *  - LIVE: carries a minute, but a "live" row whose kick-off is > 3.5 h old is really finished, and one starting in the future is upcoming;
 *  - FINAL: never carries a live minute.
 */
export function normalizeMatchState(m: MatchDTO, now = new Date()): MatchDTO {
  const kickoff = new Date(m.matchTimestamp).getTime();
  let status = m.status;
  if (isLiveStatus(status)) {
    if (now.getTime() - kickoff > MAX_LIVE_MS) status = "finished";
    else if (kickoff - now.getTime() > 10 * 60_000) status = "scheduled";
  }
  if (status === "scheduled" || status === "postponed") return { ...m, status, homeScore: null, awayScore: null, minute: null };
  if (status === "finished") return { ...m, status, minute: null };
  return { ...m, status };
}
