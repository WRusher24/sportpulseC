import { z } from "zod";
import { complete, hasAi, parseJsonReply, type AiConfig } from "./client";
import { firstSentences } from "./text";
import { cleanText } from "./sanitize";

export type NeutralizeInput = { id: string; title: string; text: string };
export type NeutralizeResult = { neutralTitle: string; summary: string; clickbaitScore: number };

const SYSTEM = `אתה עורך חדשות ספורט ישראלי אובייקטיבי. עבור כל כתבה קבל כותרת מקורית וטקסט, והחזר:
- neutralTitle: כותרת בעברית, ענינית, ניטרלית ועובדתית. ללא סימני קריאה, ללא מטאפורות מוגזמות ("רעידת אדמה", "הלם", "דרמה"), ללא שאלות מסקרנות, ללא הסתרת מידע. שמור על כל העובדות, השמות והתוצאות מהכותרת המקורית ומהטקסט. עד 90 תווים.
- summary: תקציר TLDR בעברית של משפט עד שניים (עד 220 תווים), רק מידע שמופיע בטקסט.
- clickbaitScore: מספר שלם 0-100 המעריך עד כמה הכותרת המקורית סנסציונית או מטעה (0 = ענינית לחלוק).
אסור להמציא עובדות. אם הכותרת המקורית כבר ניטרלית, החזר אותה כמעט כלשונה.
החזר JSON בלבד בפורמט: {"items":[{"id":"...","neutralTitle":"...","summary":"...","clickbaitScore":0}]}`;

const schema = z.object({
  items: z.array(z.object({ id: z.string(), neutralTitle: z.string().min(3).max(200), summary: z.string().max(600).default(""), clickbaitScore: z.number().min(0).max(100) }))
});

const SENSATIONAL = [
  "רעידת אדמה", "הלם", "דרמה", "בלעדי", "סנסציה", "פצצה", "אוי ואבוי", "לא תאמינו", "תראו מה", "מטורף", "היסטרי", "בום", "וואו",
  "שוק", "קריסה", "מהפך", "מדהים", "עוצר נשימה", "חשיפה", "זה קרה", "כולם מדברים", "שברו את"
];

/** Rule-based fallback used when no AI key is configured: removes sensational punctuation, interjections and emoji. */
export function heuristicNeutralize(title: string, text: string): NeutralizeResult {
  const lower = title.toLowerCase();
  let score = 0;
  score += Math.min(40, (title.match(/[!?]/g)?.length ?? 0) * 15);
  score += SENSATIONAL.filter((w) => lower.includes(w)).length * 20;
  if (/[A-Z]{4,}/.test(title)) score += 10;
  let t = title
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/([!?])\1+/g, "$1")
    .replace(/[!?]+\s*$/g, "")
    .replace(/^\s*(הלם|דרמה|בלעדי|וואו|שוק|בום)\s*[:!\-–]+\s*/u, "")
    .replace(/\s*[!]+\s*/g, ": ")
    .replace(/:\s*:/g, ":")
    .replace(/\s{2,}/g, " ")
    .replace(/[:\-–\s]+$/g, "")
    .trim();
  if (t.length < 8) t = title.trim();
  return { neutralTitle: t.slice(0, 120), summary: firstSentences(text || title, 220), clickbaitScore: Math.min(100, score) };
}

export async function neutralizeBatch(ai: AiConfig, items: NeutralizeInput[]): Promise<Map<string, NeutralizeResult>> {
  const out = new Map<string, NeutralizeResult>();
  if (items.length === 0) return out;

  if (hasAi(ai)) {
    try {
      const payload = items.map((i) => ({ id: i.id, title: cleanText(i.title, 300), text: cleanText(i.text, 1800) }));
      const reply = await complete(ai, { system: SYSTEM, messages: [{ role: "user", content: JSON.stringify({ items: payload }) }], json: true, maxTokens: 400 + items.length * 260 });
      const parsed = schema.parse(parseJsonReply(reply));
      for (const r of parsed.items) {
        if (items.some((i) => i.id === r.id)) out.set(r.id, { neutralTitle: r.neutralTitle.trim(), summary: r.summary.trim(), clickbaitScore: Math.round(r.clickbaitScore) });
      }
    } catch (error) {
      console.warn("[ai] neutralize failed, using heuristic:", error instanceof Error ? error.message : error);
    }
  }
  for (const i of items) if (!out.has(i.id)) out.set(i.id, heuristicNeutralize(i.title, i.text));
  return out;
}
