import { tokenize } from "@/lib/ai/text";
import type { ClusterCandidate } from "@/lib/data/repo";
import type { ArticleCategory } from "@/lib/types";

const WINDOW_MS = 36 * 3_600_000;
const MAX_SIGNATURE_TOKENS = 60;

export type ClusterProbe = { title: string; leadText: string; teamId: string | null; category: ArticleCategory; publishedAt: string };

export const articleTokens = (title: string, lead: string): { title: string[]; all: string[] } => {
  const t = tokenize(title);
  return { title: [...new Set(t)], all: [...new Set([...t, ...tokenize(lead.slice(0, 300))])] };
};

export const buildSignature = (existing: string, extra: string[]): string => {
  const set = new Set(existing.split(" ").filter(Boolean));
  for (const t of extra) if (set.size < MAX_SIGNATURE_TOKENS) set.add(t);
  return [...set].join(" ");
};

/**
 * Story clustering: an article joins an existing master thread when it covers the same event, judged by
 * (a) the same team (or unknown team), (b) publication within a 36h window and (c) strong lexical overlap between the
 * headline and the thread signature (Jaccard >= 0.34, or overlap coefficient >= 0.6 with >= 3 shared stems).
 */
export function findThread(candidates: ClusterCandidate[], probe: ClusterProbe): { id: string; score: number } | null {
  const tokens = articleTokens(probe.title, probe.leadText);
  const titleSet = new Set(tokens.title);
  if (titleSet.size < 2) return null;
  const published = new Date(probe.publishedAt).getTime();

  let best: { id: string; score: number } | null = null;
  for (const c of candidates) {
    if (Math.abs(published - new Date(c.lastPublishedAt).getTime()) > WINDOW_MS) continue;
    if (c.teamId && probe.teamId && c.teamId !== probe.teamId) continue;
    const sig = new Set(c.signature.split(" ").filter(Boolean));
    if (sig.size === 0) continue;
    let shared = 0;
    for (const t of titleSet) if (sig.has(t)) shared++;
    const union = titleSet.size + sig.size - shared;
    const jaccard = shared / union;
    const overlap = shared / Math.min(titleSet.size, sig.size);
    const ok = jaccard >= 0.34 || (overlap >= 0.6 && shared >= 3);
    if (!ok) continue;
    const score = Math.max(jaccard, overlap * 0.8) + (c.teamId && c.teamId === probe.teamId ? 0.1 : 0);
    if (!best || score > best.score) best = { id: c.id, score };
  }
  return best;
}
