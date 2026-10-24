import { buildAliasIndex, rankTeams } from "@/lib/ingest/classify";
import { buildTeamFacts, FORM_HE, matchSummaryLine, type TeamFacts } from "@/lib/analytics/facts";
import type { Repo } from "@/lib/data/repo";
import { fmtDate, fmtNum, fmtPct } from "@/lib/format";
import type { MatchDTO, TeamDTO } from "@/lib/types";
import { complete, hasAi, streamCompletion, type AiConfig, type ChatMessage } from "./client";

export const ANALYST_SYSTEM = `אתה "האנליסט" – עוזר טקטי וסטטיסטי של אפליקציית הספורט הישראלית "ספורט פאלס".
כללים:
1. ענה תמיד בעברית רהוטה ותמציתית (עד 220 מילים), בפסקאות קצרות או בנקודות.
2. הסתמך אך ורק על הנתונים שסופקו בבלוק "נתונים" (טבלה, תוצאות, xG, החזקת כדור, אירועי משחק, הסתברויות העונה) ועל ידע כללי בכדורגל/כדורסל. לעולם אל תמציא סטטיסטיקות, שמות שחקנים או תוצאות. אם חסר נתון – אמור זאת במפורש.
3. כשהנתונים מסומנים "baseline" אין עדיין נתוני משחקים אמיתיים מספק חי – ציין זאת ואל תנתח תוצאות שלא קיימות בנתונים.
4. כתוב כל מספר בספרות מערביות (0-9) בלבד. אחוזים, תוצאות ומינוטים בספרות לועזיות.
5. הסתברויות העונה הן הערכת מונטה-קרלו מבוססת קצב נקודות נוכחי – הצג אותן כהערכה, לא כוודאות.
6. שאלות על "מה קרה במחצית השנייה" – נתח לפי ציר האירועים, כרטיסים, חילופים ושינוי ב-xG/החזקת כדור אם קיימים.`;

export type AnalystContext = { teams: TeamDTO[]; facts: TeamFacts[] };

export async function buildAnalystContext(repo: Repo, question: string, fallbackTeamId?: string | null): Promise<AnalystContext> {
  const [teamList, leagues] = await Promise.all([repo.listTeams(), repo.listLeagues()]);
  const teamMap = new Map(teamList.map((t) => [t.id, t]));
  const ranked = rankTeams(buildAliasIndex(teamList), question, "").filter((r) => r.score >= 3);
  const picked = ranked.slice(0, 2).map((r) => r.team);
  if (picked.length === 0 && fallbackTeamId && teamMap.get(fallbackTeamId)) picked.push(teamMap.get(fallbackTeamId) as TeamDTO);
  const facts = await Promise.all(picked.map((t) => buildTeamFacts(repo, t, leagues, teamMap)));
  return { teams: picked, facts };
}

const SCENARIO_WORDS = /(תרחיש|עליי|אליפות|פלייאוף|פלייאוף|סיכוי|הסתברות|ירידה|לעלות|יעלה|תעלה|תוכל לעלות|מקום|טבלה|סיום העונה)/;
const HALF_WORDS = /(מחצית|שליטה|איבד|איבדה|הפסיד|הפסידה|למה|מה קרה|התמוטט|קרס|קריסה)/;
const NEXT_WORDS = /(הבא|הקרוב|מחר|השבוע|ניחוש|תחזית|צפי|מי תנצח|יתקיים)/;

/** Data-only answer used when no AI key is configured: every sentence is computed from the stored facts. */
export function ruleBasedAnswer(question: string, ctx: AnalystContext): string {
  if (ctx.facts.length === 0) {
    return "לא זיהיתי בשאלה קבוצה מהליגות שאני מכסה. נסו לציין שם קבוצה (למשל: \"מכבי חיפה\" או \"Arsenal\") – או בחרו קבוצה אהובה במסך \"הקבוצה שלי\".\n\nכדי לקבל ניתוח חופשי מבוסס בינה מלאכותית, הוסיפו מפתח AI במסך ההגדרות.";
  }
  const parts: string[] = [];
  for (const f of ctx.facts) {
    const lines: string[] = [`**${f.name}** (${f.league})`];
    if (f.standing && f.standing.played > 0) {
      lines.push(`• מקום ${fmtNum(f.standing.position)} מתוך ${fmtNum(f.standing.of)} עם ${fmtNum(f.standing.points)} נקודות אחרי ${fmtNum(f.standing.played)} משחקים (הפרש ${f.standing.goalDifference > 0 ? "+" : ""}${fmtNum(f.standing.goalDifference)}). מאזן אחרון: ${f.standing.form.split("").map((c) => FORM_HE[c] ?? c).join(" ") || "אין נתונים"}.`);
    }
    if (HALF_WORDS.test(question) && f.lastMatch) {
      const m = f.lastMatch;
      const sh = m.secondHalf;
      const fh = m.firstHalf;
      lines.push(`• במשחק האחרון מול ${m.opponent} (${m.score}): במחצית הראשונה ${fmtNum(fh.goalsFor)}:${fmtNum(fh.goalsAgainst)} ובשנייה ${fmtNum(sh.goalsFor)}:${fmtNum(sh.goalsAgainst)}.`);
      if (sh.goalsAgainst > fh.goalsAgainst) lines.push(`• ההגנה ספגה יותר שערים במחצית השנייה (${fmtNum(sh.goalsAgainst)} לעומת ${fmtNum(fh.goalsAgainst)}), לצד ${fmtNum(m.substitutions)} חילופים ו-${fmtNum(m.cards)} כרטיסים במשחק.`);
      const r = f.recent[0];
      if (r?.possession !== null && r?.xgFor !== null) lines.push(`• מדדי המשחק: החזקת כדור ${fmtPct(r.possession)}, xG ${fmtNum(r.xgFor, 2)} מול ${fmtNum(r.xgAgainst ?? 0, 2)}.`);
      if (m.timeline.length) lines.push(`• ציר אירועים: ${m.timeline.slice(0, 6).join(" | ")}`);
    }
    if (SCENARIO_WORDS.test(question) && f.scenarios) {
      const s = f.scenarios;
      lines.push(`• הערכת מונטה-קרלו לסיום העונה: מקום צפוי ${fmtNum(s.expectedPosition, 1)} עם כ-${fmtNum(s.expectedPoints)} נקודות; סיכוי לאליפות ${fmtPct(s.title)}, לסיום בצמרת (טופ ${fmtNum(s.topBracket.n)}) ${fmtPct(s.topBracket.probability)}, ולסיום באזור התחתון (${fmtNum(s.bottomBracket.n)} האחרונות) ${fmtPct(s.bottomBracket.probability)}.`);
      if (f.leaders[0]) lines.push(`• בצמרת: ${f.leaders.slice(0, 3).map((l) => `${l.team} (${fmtNum(l.points)})`).join(", ")}.`);
    }
    if (NEXT_WORDS.test(question) || (!HALF_WORDS.test(question) && !SCENARIO_WORDS.test(question))) {
      if (f.recent.length) lines.push(`• 5 המשחקים האחרונים: ${f.recent.map((r) => `${r.opponent} ${r.score} (${FORM_HE[r.result]})`).join("; ")}.`);
      if (f.upcoming.length) lines.push(`• המשחקים הבאים: ${f.upcoming.map((u) => `${u.opponent} (${u.venue}, ${u.date} ${u.time})`).join("; ")}.`);
    }
    if (f.dataSource === "baseline" && f.recent.length === 0) lines.push("_עדיין אין במערכת תוצאות אמיתיות – חיברו ספק נתונים בהגדרות כדי לקבל ניתוח מבוסס משחקים._");
    parts.push(lines.join("\n"));
  }
  parts.push("_ניתוח מבוסס נתונים בלבד. להסברים חופשיים ועמוקים יותר הוסיפו מפתח AI במסך ההגדרות._");
  return parts.join("\n\n");
}

export function analystMessages(history: ChatMessage[], question: string, ctx: AnalystContext): ChatMessage[] {
  const trimmed = history.slice(-6).map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
  const data = ctx.facts.length ? JSON.stringify(ctx.facts) : "לא זוהתה קבוצה בשאלה – ענה בהסבר כללי ובקש מהמשתמש לציין קבוצה.";
  return [...trimmed, { role: "user", content: `${question.slice(0, 1200)}\n\nנתונים:\n${data}` }];
}

/** Streams the analyst reply: LLM when a key is available, otherwise the data-driven answer in small chunks. */
export async function* analystReply(ai: AiConfig, repo: Repo, history: ChatMessage[], question: string, favoriteTeamId?: string | null): AsyncGenerator<string> {
  const ctx = await buildAnalystContext(repo, question, favoriteTeamId);
  if (!hasAi(ai)) {
    const text = ruleBasedAnswer(question, ctx);
    for (let i = 0; i < text.length; i += 24) yield text.slice(i, i + 24);
    return;
  }
  yield* streamCompletion(ai, { system: ANALYST_SYSTEM, messages: analystMessages(history, question, ctx), maxTokens: 900 });
}

/* ------------------------------------------------------------------ pre / post match insights */

export type MatchInsightMode = "pre" | "live" | "post";

export async function matchInsight(
  repo: Repo,
  ai: AiConfig,
  matchId: string
): Promise<{ mode: MatchInsightMode; text: string; usedAi: boolean } | null> {
  const found = await repo.getMatch(matchId);
  if (!found) return null;
  const { match, events } = found;
  const [teams, leagues] = await Promise.all([repo.listTeams(), repo.listLeagues()]);
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const name = (id: string) => teamMap.get(id)?.nameHe ?? id;
  const mode: MatchInsightMode = match.status === "finished" ? "post" : match.status === "scheduled" ? "pre" : "live";
  const [home, away, h2h] = await Promise.all([
    buildTeamFacts(repo, teamMap.get(match.homeTeamId) as TeamDTO, leagues, teamMap),
    buildTeamFacts(repo, teamMap.get(match.awayTeamId) as TeamDTO, leagues, teamMap),
    repo.headToHead(match.homeTeamId, match.awayTeamId, 5)
  ]);
  const facts = {
    mode,
    match: { league: leagues.find((l) => l.id === match.leagueId)?.nameHe, round: match.round, venue: match.venue, date: fmtDate(match.matchTimestamp), status: match.status, minute: match.minute, score: match.homeScore === null ? null : `${fmtNum(match.homeScore)}:${fmtNum(match.awayScore ?? 0)} (${name(match.homeTeamId)}:${name(match.awayTeamId)})` },
    stats: match.stats,
    events: events.map((e) => `${fmtNum(e.minute)}' ${name(e.teamId ?? "")} ${e.description ?? e.eventType} – ${e.playerName}`),
    home: { ...home, lastMatch: undefined },
    away: { ...away, lastMatch: undefined },
    headToHead: h2h.map((m) => matchSummaryLine(m, name))
  };

  if (hasAi(ai)) {
    try {
      const task = mode === "pre" ? "כתוב תצוגה מקדימה של המשחק: מצב הקבוצות, מאזן אחרון, מפתחות טקטיים, וקווי הסתברות זהירים." : mode === "post" ? "כתוב סיכום ותובנות אחרי המשחק: מה הכריע, מה אומרים ה-xG והסטטיסטיקות, נקודות חוזק וחולשה." : "כתוב עדכון מצב משחק חי: איפה המשחק עומד לפי הנתונים עד כה.";
      const text = await complete(ai, { system: ANALYST_SYSTEM, messages: [{ role: "user", content: `${task} 4-5 נקודות קצרות.\n\nנתונים:\n${JSON.stringify(facts)}` }], maxTokens: 700 });
      return { mode, text: text.trim(), usedAi: true };
    } catch (e) {
      console.warn("[ai] match insight failed, using template:", e instanceof Error ? e.message : e);
    }
  }
  return { mode, text: templateInsight(mode, match, home, away, name, h2h), usedAi: false };
}

function templateInsight(mode: MatchInsightMode, m: MatchDTO, home: TeamFacts, away: TeamFacts, name: (id: string) => string, h2h: MatchDTO[]): string {
  const lines: string[] = [];
  const form = (f: TeamFacts) => f.standing?.form.split("").map((c) => FORM_HE[c] ?? c).join(" ") || "אין נתונים";
  if (mode === "pre") {
    lines.push(`• ${home.name} (מקום ${home.standing ? fmtNum(home.standing.position) : "—"}, מאזן ${form(home)}) מארחת את ${away.name} (מקום ${away.standing ? fmtNum(away.standing.position) : "—"}, מאזן ${form(away)}).`);
    if (home.scenarios && away.scenarios) lines.push(`• לפי הערכת מונטה-קרלו: סיום צפוי במקום ${fmtNum(home.scenarios.expectedPosition, 1)} ל${home.name} לעומת ${fmtNum(away.scenarios.expectedPosition, 1)} ל${away.name}.`);
    if (h2h.length) lines.push(`• מפגשים אחרונים: ${h2h.map((x) => matchSummaryLine(x, name)).join("; ")}.`);
  } else {
    const s = m.stats;
    lines.push(`• תוצאה${mode === "live" ? " נוכחית" : ""}: ${matchSummaryLine(m, name)}.`);
    if (s?.xg) lines.push(`• xG: ${fmtNum(s.xg[0], 2)} מול ${fmtNum(s.xg[1], 2)} – ${s.xg[0] > s.xg[1] ? name(m.homeTeamId) : name(m.awayTeamId)} יצרה הזדמנויות איכותיות יותר.`);
    if (s?.possession) lines.push(`• החזקת כדור ${fmtPct(s.possession[0])}–${fmtPct(s.possession[1])}, בעיטות למסגרת ${fmtNum(s.shotsOnTarget?.[0] ?? 0)}–${fmtNum(s.shotsOnTarget?.[1] ?? 0)}.`);
    if (s?.fgPct) lines.push(`• אחוזי קליעה ${fmtPct(s.fgPct[0], 1)}–${fmtPct(s.fgPct[1], 1)}, ריבאונדים ${fmtNum(s.rebounds?.[0] ?? 0)}–${fmtNum(s.rebounds?.[1] ?? 0)}.`);
  }
  lines.push("_תובנה מבוססת נתונים (ללא מפתח AI). הוסיפו מפתח בהגדרות לניתוח טקטי חופשי._");
  return lines.join("\n");
}
