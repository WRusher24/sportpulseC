import { buildTeamFacts } from "@/lib/analytics/facts";
import type { Repo } from "@/lib/data/repo";
import { fmtNum, israelDayKey } from "@/lib/format";
import type { DigestDTO, TeamDTO } from "@/lib/types";
import { ANALYST_SYSTEM } from "./analyst";
import { complete, hasAi, type AiConfig } from "./client";

const DIGEST_SYSTEM = `${ANALYST_SYSTEM}

משימה נוכחית: כתוב את "מה חדש הבוקר" – סיכום בוקר אישי שנקרא בכ-60 שניות (110-150 מילים) לאוהד הקבוצה.
מבנה: פתיחה קצרה "בוקר טוב" + שם הקבוצה; "מה קרה בלילה" (ידיעות מרכזיות); "העברות ושמועות" (רק אם יש בנתונים); "מה הלאה" (המשחקים הקרובים). אל תמציא ידיעות שלא בנתונים. אם אין חדשות – אמור זאת וסכם את מצב הקבוצה.`;

export async function generateDigest(repo: Repo, ai: AiConfig, teamId: string, day = israelDayKey()): Promise<DigestDTO | null> {
  const [teams, leagues] = await Promise.all([repo.listTeams(), repo.listLeagues()]);
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const team = teamMap.get(teamId) as TeamDTO | undefined;
  if (!team) return null;

  const facts = await buildTeamFacts(repo, team, leagues, teamMap);
  const since = Date.now() - 26 * 3_600_000;
  const threads = (await repo.listThreads({ teamId, limit: 12 })).filter((t) => new Date(t.lastPublishedAt).getTime() >= since);
  const news = threads.map((t) => ({ title: t.titleHe, outlets: t.articles.map((a) => a.sourceName), category: t.category }));
  const transfers = news.filter((n) => n.category === "transfers");

  let content: string;
  let generatedBy = "template";
  if (hasAi(ai)) {
    try {
      content = (await complete(ai, { system: DIGEST_SYSTEM, messages: [{ role: "user", content: `נתונים:\n${JSON.stringify({ team: team.nameHe, news, transfers, facts: { standing: facts.standing, recent: facts.recent.slice(0, 3), upcoming: facts.upcoming, dataSource: facts.dataSource } })}` }], maxTokens: 600 })).trim();
      generatedBy = "ai";
    } catch (e) {
      console.warn("[ai] digest failed, using template:", e instanceof Error ? e.message : e);
      content = templateDigest(team, facts, news);
    }
  } else {
    content = templateDigest(team, facts, news);
  }
  const digest: DigestDTO = { teamId, digestDate: day, contentHe: content, generatedBy };
  await repo.saveDigest(digest);
  return digest;
}

function templateDigest(team: TeamDTO, facts: Awaited<ReturnType<typeof buildTeamFacts>>, news: Array<{ title: string; outlets: string[] }>): string {
  const lines = [`בוקר טוב, אוהדי ${team.nameHe}!`];
  if (news.length) {
    lines.push("מה קרה בלילה:");
    for (const n of news.slice(0, 4)) lines.push(`• ${n.title} (${fmtNum(n.outlets.length)} ${n.outlets.length === 1 ? "מקור" : "מקורות"})`);
  } else {
    lines.push("לא פורסמו ידיעות חדשות על הקבוצה בלילה האחרון.");
  }
  if (facts.standing) lines.push(`מצב בטבלה: מקום ${fmtNum(facts.standing.position)} מתוך ${fmtNum(facts.standing.of)} עם ${fmtNum(facts.standing.points)} נקודות.`);
  const last = facts.recent[0];
  if (last) lines.push(`המשחק האחרון: ${last.opponent} (${last.venue}) – ${last.score}.`);
  if (facts.upcoming.length) lines.push(`מה הלאה: ${facts.upcoming.map((u) => `${u.opponent} (${u.date}, ${u.time})`).join("; ")}.`);
  return lines.join("\n");
}

/** Generates the digest for every team that has at least one fan (account or recent cookie-less demand is handled lazily on read). */
export async function generateDigestsForTeams(repo: Repo, ai: AiConfig, teamIds: string[], day = israelDayKey()): Promise<number> {
  let n = 0;
  for (const id of teamIds) {
    if (await repo.getDigest(id, day)) continue;
    if (await generateDigest(repo, ai, id, day)) n++;
  }
  return n;
}
