/** Hebrew/English text utilities shared by the clustering engine, classifier and heuristics. */

const HEBREW_STOPWORDS = new Set(
  "של על עם את זה זאת הוא היא הם הן אל או גם כי אבל אם לא כל מה מי איך למה כך עוד רק כבר אחרי לפני בין תוך מול אצל ללא אחד אחת שני שתי היה הייתה היו יהיה תהיה להיות נגד לאחר בעקבות לקראת ואת וגם אותו אותה אותם יותר פחות מאוד הכי יום ערב לילה השבוע הערב אמש היום מחר".split(" ")
);
const ENGLISH_STOPWORDS = new Set("the a an of in on at to for and or vs v with is are was were be by from as it its".split(" "));

const PREFIXES = ["וכש", "ולכש", "ש", "וב", "ול", "ומ", "וה", "וש", "כש", "מה", "בה", "לה", "ב", "ל", "מ", "ה", "ו", "כ"];

/** Strips a single leading Hebrew prefix when the remaining stem is still long enough to be meaningful. */
export function stemHebrew(word: string): string {
  for (const p of PREFIXES) {
    if (word.startsWith(p) && word.length - p.length >= 3) return word.slice(p.length);
  }
  return word;
}

export function normalize(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[֑-ׇ]/g, "") // niqqud / cantillation
    .replace(/[׳’'`´]/g, "")
    .replace(/[״“”"]/g, "")
    .toLowerCase();
}

export function tokenize(input: string): string[] {
  return normalize(input)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1)
    .filter((t) => !HEBREW_STOPWORDS.has(t) && !ENGLISH_STOPWORDS.has(t))
    .map((t) => (/[֐-׿]/.test(t) ? stemHebrew(t) : t))
    .filter((t) => t.length > 1 && !HEBREW_STOPWORDS.has(t));
}

export function jaccard(a: Iterable<string>, b: Iterable<string>): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export function firstSentences(text: string, maxChars = 220): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (end > 60 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…").trim();
}
