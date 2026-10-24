import { z } from "zod";
import { complete, hasAi, parseJsonReply, type AiConfig } from "./client";
import type { ThreadDTO } from "@/lib/types";
import { normalize } from "./text";

const POSITIVE = ["ניצחון", "ניצח", "גברה", "זכתה", "זכה", "העפילה", "חתם", "חיזוק", "חוזר", "הצטרף", "אליפות", "שיא", "קפיצה", "כבש", "הבקיע", "מצוין", "הצלחה", "חוזה", "הארכת חוזה", "חגיגה", "עלייה"];
const NEGATIVE = ["הפסד", "הפסידה", "הפסיד", "פציעה", "נפצע", "התרסקה", "פיטורים", "פוטר", "משבר", "חשש", "עזב", "הודחה", "ירידה", "מפח", "כישלון", "השעיה", "עונש", "קנס", "דאגה", "ספק", "תיקו מאכזב", "מורחק"];

/** Lexicon sentiment used when no AI key is available. Returns the optimistic percentage (15-90). */
export function heuristicVibe(thread: Pick<ThreadDTO, "titleHe" | "articles">): number {
  const text = normalize([thread.titleHe, ...thread.articles.map((a) => `${a.neutralTitle} ${a.summary ?? ""}`)].join(" "));
  const count = (words: string[]) => words.reduce((n, w) => n + (text.includes(normalize(w)) ? 1 : 0), 0);
  const pos = count(POSITIVE);
  const neg = count(NEGATIVE);
  return Math.max(15, Math.min(90, Math.round(50 + (pos - neg) * 12)));
}

const schema = z.object({ items: z.array(z.object({ id: z.string(), optimistic: z.number().min(0).max(100) })) });

const SYSTEM = `אתה מנתח רגשות של אוהדי ספורט ישראליים. עבור כל שרשור ידיעות (כותרות ותקצירים מכמה אתרים) הערך איזה אחוז מהאוהדים של הקבוצה/הנושא המרכזי יגיבו באופטימיות לעומת בדאגה, על בסיס הטון והתוכן של הדיווחים. מספר שלם 0-100 = אחוז אופטימיים (השאר מודאגים).
החזר JSON בלבד: {"items":[{"id":"...","optimistic":72}]}`;

export async function analyzeVibes(ai: AiConfig, threads: ThreadDTO[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (threads.length === 0) return out;
  if (hasAi(ai)) {
    try {
      const payload = threads.map((t) => ({ id: t.id, title: t.titleHe, reports: t.articles.slice(0, 5).map((a) => ({ source: a.sourceName, title: a.neutralTitle, summary: a.summary })) }));
      const reply = await complete(ai, { system: SYSTEM, messages: [{ role: "user", content: JSON.stringify({ items: payload }) }], json: true, maxTokens: 300 + threads.length * 40 });
      for (const r of schema.parse(parseJsonReply(reply)).items) if (threads.some((t) => t.id === r.id)) out.set(r.id, Math.round(r.optimistic));
    } catch (error) {
      console.warn("[ai] vibe analysis failed, using lexicon:", error instanceof Error ? error.message : error);
    }
  }
  for (const t of threads) if (!out.has(t.id)) out.set(t.id, heuristicVibe(t));
  return out;
}

/** Blends the AI estimate (worth 10 pseudo-votes) with real fan votes cast in the app. */
export function blendVibe(aiOptimistic: number | null, votes: { optimistic: number; worried: number }): { optimistic: number; worried: number; votes: number } | null {
  const total = votes.optimistic + votes.worried;
  if (aiOptimistic === null && total === 0) return null;
  const weight = aiOptimistic === null ? 0 : 10;
  const ai = aiOptimistic ?? 50;
  const optimistic = Math.round(((ai / 100) * weight + votes.optimistic) / (weight + total) * 100);
  return { optimistic, worried: 100 - optimistic, votes: total };
}
