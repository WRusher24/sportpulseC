import * as cheerio from "cheerio";
import { buildAliasIndex, findMentions, type Mention } from "@/lib/ingest/classify";
import { israelDayKey } from "@/lib/format";
import { toWesternDigits } from "@/lib/format";
import type { LeagueDTO, MatchStatus, TeamDTO } from "@/lib/types";
import { TeamMatcher } from "./team-match";
import type { ProviderMatch, ProviderStanding } from "./types";

/**
 * Selector-free parsers for the Israeli sports portals (Sport5, ONE, Sport1, Ynet, Walla).
 * Portals change their markup often, so instead of CSS selectors these parsers recognise *content*: a table whose rows are
 * real club names followed by played / W / D / L / goals / points is a league table; an element that mentions exactly two
 * clubs of one league plus a score or a kick-off time is a match. Everything is validated (played = W+D+L, one league per
 * table) so a wrong guess is dropped rather than stored.
 */
export type ScrapeContext = {
  teams: TeamDTO[];
  leagues: LeagueDTO[];
  matcher: TeamMatcher;
  index: ReturnType<typeof buildAliasIndex>;
};

export const makeScrapeContext = (teams: TeamDTO[], leagues: LeagueDTO[]): ScrapeContext => ({ teams, leagues, matcher: new TeamMatcher(teams), index: buildAliasIndex(teams) });

export type ScrapedTable = { leagueId: string; rows: Array<ProviderStanding & { teamId: string }> };

const squash = (s: string) => toWesternDigits(s.replace(/[‎‏‪-‮ ]/g, " ").replace(/\s+/g, " ").trim());
const INT = /^[+\-−]?\d{1,4}$/;
const GOALS = /^(\d{1,4})\s*[:\-–]\s*(\d{1,4})$/;

/* ------------------------------------------------------------------ standings */

export function parseStandingsTables(html: string, ctx: ScrapeContext): ScrapedTable[] {
  const $ = cheerio.load(html);
  const found: ScrapedTable[] = [];

  $("table").each((_, table) => {
    type Raw = { candidates: TeamDTO[]; cells: string[] };
    const raws: Raw[] = [];
    $(table).find("tr").each((__, tr) => {
      const cells = $(tr).find("td, th").toArray().map((c) => squash($(c).text()));
      if (cells.length < 5) return;
      const teamIdx = cells.findIndex((c) => c.length > 1 && c.length <= 40 && !/^[\d\s:+\-–.%]+$/.test(c) && ctx.matcher.findAll(c).length > 0);
      if (teamIdx < 0) return;
      raws.push({ candidates: ctx.matcher.findAll(cells[teamIdx]), cells: cells.slice(teamIdx + 1) });
    });
    if (raws.length < 6) return;

    // One table = one league: pick the league that explains most rows.
    const counts = new Map<string, number>();
    for (const r of raws) for (const l of new Set(r.candidates.map((t) => t.leagueId))) counts.set(l, (counts.get(l) ?? 0) + 1);
    const [leagueId, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
    if (!leagueId || n < Math.max(6, raws.length * 0.8)) return;

    const rows: ScrapedTable["rows"] = [];
    for (const r of raws) {
      const team = r.candidates.find((t) => t.leagueId === leagueId);
      if (!team) continue;
      const g = r.cells.findIndex((c) => GOALS.test(c));
      if (g < 0) continue;
      const [, gf, ga] = GOALS.exec(r.cells[g]) as RegExpExecArray;
      const before = r.cells.slice(0, g).filter((c) => INT.test(c)).map((c) => Number(c.replace("−", "-")));
      const after = r.cells.slice(g + 1).filter((c) => INT.test(c)).map((c) => Number(c.replace("−", "-")));
      if (before.length < 3) continue;
      const [played, wins, draws, losses] = before.length >= 4 ? before.slice(-4) : [before[0], before[1], 0, before[2]];
      if (played !== wins + draws + losses) continue;
      const points = after.length ? after[after.length - 1] : wins * 3 + draws;
      rows.push({ teamId: team.id, teamName: team.nameHe, played, wins, draws, losses, goalsFor: Number(gf), goalsAgainst: Number(ga), points, form: "" });
    }
    if (rows.length >= 6 && new Set(rows.map((r) => r.teamId)).size === rows.length) found.push({ leagueId, rows });
  });
  return found;
}

/* ------------------------------------------------------------------ results & fixtures */

const FINISHED = /(סיום|הסתיים|סוף המשחק|סופית|FT\b)/i;
const LIVE_MINUTE = /(\d{1,3})\s*(?:\+\d+)?\s*['׳′’]/;
const LIVE_WORD = /(בשידור חי|\bלייב\b|\bLIVE\b|הפסקה|מחצית (?:ראשונה|שנייה))/i;
const HALF_TIME = /(הפסקה|מחצית(?! (?:ראשונה|שנייה))|\bHT\b)/i;
const TIME = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;
const DATE = /\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/;

function tzOffsetMs(ts: number): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ts / 1000) * 1000;
}

/** Wall-clock time in Israel -> UTC instant (handles daylight saving). */
export function israelLocalToUtc(y: number, mo: number, d: number, h: number, mi: number): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const first = guess - tzOffsetMs(guess);
  return new Date(guess - tzOffsetMs(first));
}

function inferDate(text: string, now: Date): { y: number; mo: number; d: number } | null {
  const m = DATE.exec(text);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  let y = m[3] ? Number(m[3]) : now.getUTCFullYear();
  if (y < 100) y += 2000;
  if (!m[3]) {
    const t = Date.UTC(y, mo - 1, d);
    if (t - now.getTime() > 200 * 86_400_000) y -= 1;
    else if (now.getTime() - t > 200 * 86_400_000) y += 1;
  }
  return { y, mo, d };
}

function commonLeague(a: Mention, b: Mention, ctx: ScrapeContext, hint: string): { leagueId: string; home: TeamDTO; away: TeamDTO } | null {
  const leagueIds = [...new Set(a.teams.map((t) => t.leagueId))].filter((l) => b.teams.some((t) => t.leagueId === l));
  const pickLeague = leagueIds[0];
  if (pickLeague) return { leagueId: pickLeague, home: a.teams.find((t) => t.leagueId === pickLeague) as TeamDTO, away: b.teams.find((t) => t.leagueId === pickLeague) as TeamDTO };
  // Cross-competition ties (Champions League / EuroLeague): need an explicit hint in the text and same sport.
  const sport = a.teams[0].sportType;
  const tie = ctx.leagues.find((l) => l.sportType === sport && (l.id === "ucl" || l.id === "euroleague") && new RegExp(l.id === "ucl" ? "ליגת האלופות|Champions" : "יורוליג|EuroLeague", "i").test(hint));
  const home = a.teams.find((t) => t.sportType === sport);
  const away = b.teams.find((t) => t.sportType === sport && t.id !== home?.id);
  return tie && home && away ? { leagueId: tie.id, home, away } : null;
}

export function parseResults(html: string, ctx: ScrapeContext, now = new Date()): ProviderMatch[] {
  const $ = cheerio.load(html);
  const pageHint = squash($("title").text() + " " + $("h1").text());
  const out = new Map<string, ProviderMatch>();
  let scanned = 0;

  $("li, tr, article, a, div, p, span").each((_, el) => {
    if (scanned > 3000) return false;
    const raw = squash($(el).text());
    if (raw.length < 8 || raw.length > 240) return;
    scanned++;
    const mentions = findMentions(ctx.index, raw);
    if (mentions.length !== 2) return;
    const pair = commonLeague(mentions[0], mentions[1], ctx, `${raw} ${pageHint}`);
    if (!pair) return;
    const basketball = pair.home.sportType === "basketball";

    // Remove club names so digits inside them cannot be mistaken for a score.
    let stripped = raw;
    for (const m of mentions) stripped = stripped.split(m.alias).join(" ");
    for (const t of [pair.home, pair.away]) for (const n of [t.nameHe, ...t.aliases]) stripped = stripped.split(n).join(" ");

    let homeScore: number | null = null;
    let awayScore: number | null = null;
    const sc = /(\d{1,3})\s*([:\-–])\s*(\d{1,3})/.exec(stripped);
    const looksLikeClock = sc && sc[2] === ":" && !basketball && /^\d{1,2}:\d{2}$/.test(sc[0].replace(/\s/g, "")) && Number(sc[1]) <= 23 && Number(sc[3]) <= 59;
    if (sc && !looksLikeClock) {
      homeScore = Number(sc[1]);
      awayScore = Number(sc[3]);
    }

    // The match date may sit in the element itself or in a nearby date heading.
    let context = raw;
    let date = inferDate(raw, now);
    if (!date) {
      let node = $(el);
      for (let up = 0; up < 3 && !date; up++) {
        const heading = node.prevAll().slice(0, 3).toArray().map((x) => squash($(x).text()).slice(0, 80)).join(" ");
        date = inferDate(heading, now);
        context += ` ${heading}`;
        node = node.parent();
      }
    }
    const today = israelDayKey(now).split("-").map(Number);
    const d = date ?? { y: today[0], mo: today[1], d: today[2] };
    const time = TIME.exec(looksLikeClock || homeScore === null ? stripped : "");

    let status: MatchStatus;
    let minute: number | null = null;
    const liveMin = LIVE_MINUTE.exec(stripped);
    if (homeScore === null) {
      if (!time) return;
      status = "scheduled";
    } else if (FINISHED.test(raw)) status = "finished";
    else if (liveMin || LIVE_WORD.test(raw)) {
      status = HALF_TIME.test(raw) ? "half_time" : liveMin && Number(liveMin[1]) > 45 ? "second_half" : "first_half";
      minute = liveMin ? Number(liveMin[1]) : null;
    } else status = "finished";

    const kickoff = time ? israelLocalToUtc(d.y, d.mo, d.d, Number(time[1]), Number(time[2])) : israelLocalToUtc(d.y, d.mo, d.d, status === "finished" ? 12 : now.getUTCHours() + 3, 0);
    const dayKey = `${d.y}${String(d.mo).padStart(2, "0")}${String(d.d).padStart(2, "0")}`;
    const externalId = `portal-${pair.home.id}-${pair.away.id}-${dayKey}`;
    const prev = out.get(externalId);
    const rank = (s: MatchStatus) => (s === "finished" ? 1 : s === "scheduled" ? 0 : 2);
    if (prev && rank(prev.status) >= rank(status)) return;
    out.set(externalId, {
      externalId,
      leagueExternalId: null,
      leagueId: pair.leagueId,
      homeName: pair.home.nameHe,
      awayName: pair.away.nameHe,
      homeScore,
      awayScore,
      status,
      minute,
      kickoff: kickoff.toISOString(),
      venue: null,
      round: null
    });
  });
  return [...out.values()];
}

/** Links on a portal home/section page that probably lead to tables, results or fixtures. */
export function discoverScoreLinks(html: string, base: string, limit = 5): string[] {
  const $ = cheerio.load(html);
  const baseHost = new URL(base).hostname.replace(/^www\./, "");
  const root = baseHost.split(".").slice(-2).join(".");
  const urls = new Map<string, number>();
  $("a[href]").each((_, a) => {
    const text = squash($(a).text());
    if (!/(טבלת|טבלה|תוצאות|לוח משחקים|משחקי הערב|משחקי היום|מחזור)/.test(text) || text.length > 40) return;
    try {
      const u = new URL($(a).attr("href") as string, base);
      if ((u.protocol !== "https:" && u.protocol !== "http:") || !u.hostname.endsWith(root)) return;
      urls.set(u.toString(), /טבלת|טבלה/.test(text) ? 2 : 1);
    } catch {
      /* skip malformed href */
    }
  });
  return [...urls.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([u]) => u);
}
