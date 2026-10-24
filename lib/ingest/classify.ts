import type { ArticleCategory, TeamDTO } from "@/lib/types";
import { normalize } from "@/lib/ai/text";

type AliasEntry = { alias: string; team: TeamDTO };

const BASKETBALL_HINT = /(כדורסל|יורוליג|ווינר|NBA|אן בי איי|euroleague|basketball|פלייאוף הסל)/i;
const FOOTBALL_HINT = /(כדורגל|ליגת העל|ליגה לאומית|שער|פנדל|מחצית|גביע|ליגת האלופות|פרמייר ליג|לה ליגה|football|soccer)/i;
const TRANSFER_HINT = /(העברה|חתם|חתמה|מצטרף|מצטרפת|עוזב|עוזבת|הושאל|השאלה|רכישה|רכש|שוק ההעברות|מגיע ל|מעבר ל|הצעה רשמית|הארכת חוזה|סיכמה עם|נחתם)/;
const WORLD_HINT = /(פרמייר ליג|לה ליגה|ליגת האלופות|ליגת האירופה|סרייה|בונדסליגה|NBA|יורוליג|ריאל מדריד|ברצלונה|מנצ'סטר|ליברפול|ארסנל|צ'לסי|באיירן|פריז סן)/i;

/** Alias index with longest-alias-first matching; aliases shorter than 4 characters are ignored to avoid false positives. */
export function buildAliasIndex(teams: TeamDTO[]): AliasEntry[] {
  const entries: AliasEntry[] = [];
  for (const team of teams) {
    const names = new Set([team.nameHe, team.nameEn, ...team.aliases].map(normalize).filter((n) => n.length >= 4));
    for (const alias of names) entries.push({ alias, team });
  }
  return entries.sort((a, b) => b.alias.length - a.alias.length);
}

/** True when `alias` occurs in `haystack` as a standalone word (a single Hebrew clitic prefix such as ה/ו/ב/ל/מ/ש is allowed). */
function occurs(haystack: string, alias: string): number {
  let count = 0;
  let from = 0;
  while (true) {
    const i = haystack.indexOf(alias, from);
    if (i < 0) return count;
    const before = haystack[i - 1];
    const after = haystack[i + alias.length];
    const startOk = i === 0 || !/[\p{L}\p{N}]/u.test(before) || (/[הובלמכש]/.test(before) && (i < 2 || !/[\p{L}\p{N}]/u.test(haystack[i - 2])));
    const endOk = after === undefined || !/[\p{L}\p{N}]/u.test(after);
    if (startOk && endOk) count++;
    from = i + alias.length;
  }
}

/** Ranks every team mentioned in the text (headline weighs 3x, first 600 characters of the body 1x). */
export function rankTeams(index: AliasEntry[], title: string, text: string): Array<{ team: TeamDTO; score: number }> {
  const t = normalize(title);
  const body = normalize(text.slice(0, 600));
  const sportContext = `${title} ${text.slice(0, 600)}`;
  const preferBasketball = BASKETBALL_HINT.test(sportContext) && !/כדורגל/.test(sportContext);

  const score = new Map<string, { team: TeamDTO; score: number }>();
  // Group teams sharing an alias (e.g. Maccabi Tel Aviv football / basketball); sport context then picks between them.
  const groups = new Map<string, TeamDTO[]>();
  for (const { alias, team } of index) groups.set(alias, [...(groups.get(alias) ?? []), team]);
  const aliases = [...groups.keys()].sort((x, y) => y.length - x.length);
  let consumedTitle = t;
  let consumedBody = body;
  for (const alias of aliases) {
    const inTitle = occurs(consumedTitle, alias);
    const inBody = occurs(consumedBody, alias);
    if (inTitle === 0 && inBody === 0) continue;
    // Earlier mention in the headline breaks ties ("A beat B" -> A).
    const firstAt = consumedTitle.indexOf(alias);
    const position = firstAt >= 0 ? 0.5 - Math.min(firstAt, 200) / 400 : 0;
    // Blank out the match so shorter aliases ("מכבי תל אביב") cannot re-match inside longer ones.
    consumedTitle = consumedTitle.split(alias).join(" ".repeat(alias.length));
    consumedBody = consumedBody.split(alias).join(" ".repeat(alias.length));
    for (const team of groups.get(alias) as TeamDTO[]) {
      const sportBonus = (team.sportType === "basketball") === preferBasketball ? 1.5 : 0;
      const cur = score.get(team.id) ?? { team, score: 0 };
      cur.score += inTitle * 3 + inBody + sportBonus + position;
      score.set(team.id, cur);
    }
  }
  return [...score.values()].sort((a, b) => b.score - a.score);
}

export function detectTeam(index: AliasEntry[], title: string, text: string): TeamDTO | null {
  return rankTeams(index, title, text)[0]?.team ?? null;
}

export function detectCategory(team: TeamDTO | null, title: string, text: string): ArticleCategory {
  const ctx = `${title} ${text.slice(0, 500)}`;
  if (TRANSFER_HINT.test(title)) return "transfers";
  const basketball = team ? team.sportType === "basketball" : BASKETBALL_HINT.test(ctx) && !FOOTBALL_HINT.test(ctx);
  const israeli = team ? ["il-premier", "il-leumit", "il-winner"].includes(team.leagueId) && !WORLD_HINT.test(title) : !WORLD_HINT.test(ctx);
  if (!team && !BASKETBALL_HINT.test(ctx) && !FOOTBALL_HINT.test(ctx)) return "other";
  if (basketball) return israeli ? "basketball_israel" : "basketball_world";
  return israeli ? "football_israel" : "football_world";
}
