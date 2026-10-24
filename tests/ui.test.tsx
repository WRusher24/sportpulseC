import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { EventsTimeline } from "../components/EventsTimeline";
import { FormGuide } from "../components/FormGuide";
import { Lineups } from "../components/Lineups";
import { MatchRow } from "../components/MatchRow";
import { RatingsPanel } from "../components/RatingsPanel";
import { StandingsTable } from "../components/StandingsTable";
import { StatBars } from "../components/StatBars";
import { StoryReader } from "../components/StoryReader";
import { ThreadCard } from "../components/ThreadCard";
import { VibeBar } from "../components/VibeBar";
import type { ArticleDTO, EventDTO, MatchDTO, StandingDTO, TeamDTO } from "../lib/types";

const WESTERN_ONLY = /[٠-٩۰-۹]/;
const team = (id: string, nameHe: string): TeamDTO => ({ id, nameHe, nameEn: id, logoUrl: null, leagueId: "il-premier", sportType: "football", venue: null, city: null, aliases: [], primaryColor: null });
const teams = new Map([["h", team("h", "מכבי חיפה")], ["a", team("a", "הפועל באר שבע")]]);
const match = (over: Partial<MatchDTO> = {}): MatchDTO => ({ id: "m1", leagueId: "il-premier", homeTeamId: "h", awayTeamId: "a", homeScore: 3, awayScore: 1, status: "finished", minute: null, matchTimestamp: "2026-10-24T17:30:00Z", venue: null, round: "מחזור 9", stats: { possession: [58, 42], shots: [14, 6], xg: [2.31, 0.84], passAccuracy: [86, 79] }, lineUps: null, externalId: null, isDemo: false, ...over });
const text = (html: string) => html.replace(/<[^>]+>/g, " ");

test("score layout follows match status and keeps home on the home side (DOM order = RTL right-to-left)", () => {
  const html = renderToStaticMarkup(<MatchRow match={match()} teams={teams} />);
  assert.ok(html.indexOf("מכבי חיפה") < html.indexOf(">3<") && html.indexOf(">3<") < html.indexOf(">1<") && html.indexOf(">1<") < html.indexOf("הפועל באר שבע"));
  const upcoming = renderToStaticMarkup(<MatchRow match={match({ status: "scheduled", homeScore: 2, awayScore: 2 })} teams={teams} />);
  assert.ok(!upcoming.includes(">2<"), "UPCOMING must not render a score");
  assert.ok(upcoming.includes("20:30"));
  const live = renderToStaticMarkup(<MatchRow match={match({ status: "second_half", minute: 67, homeScore: 1, awayScore: 0 })} teams={teams} />);
  assert.ok(live.includes("מחצית שנייה") && live.includes(">67"));
});

test("every rendered widget uses Western digits and logical (RTL-safe) classes only", () => {
  const rows: StandingDTO[] = [1, 2, 3].map((p) => ({ leagueId: "il-premier", teamId: p === 1 ? "h" : "a", position: p, played: 9, wins: 6, draws: 2, losses: 1, goalsFor: 18, goalsAgainst: 7, goalDifference: 11, points: 20, form: "WWDLW", isDemo: false }));
  const events: EventDTO[] = [
    { id: "1", matchId: "m1", minute: 23, teamId: "h", eventType: "goal", playerName: "שחקן", description: "בישול: X" },
    { id: "2", matchId: "m1", minute: 47, teamId: "a", eventType: "card", playerName: "Y", description: "כרטיס צהוב" },
    { id: "3", matchId: "m1", minute: 70, teamId: "h", eventType: "var", playerName: "Z", description: "בדיקת VAR" }
  ];
  const players = [1, 2].map((n) => ({ name: `Player ${n}`, number: n, position: "G", starter: true }));
  const lineUps = { home: { formation: "4-3-3", coach: null, players }, away: { formation: null, coach: null, players }, mediaGrades: { "home:Player 1": 7.5 } };
  const article = (id: string, src: string, clickbait: number): ArticleDTO => ({ id, threadId: "t", originalTitle: "רעידת אדמה!", neutralTitle: "ניצחון 3:1", fullText: "פסקה ראשונה.\n\n## כותרת משנה\n\nפסקה 2 עם 123.", summary: "תקציר", sourceKey: src, sourceName: src, sourceUrl: "https://example.org/a", imageUrl: null, author: null, publishedAt: "2026-10-24T10:00:00Z", category: "football_israel", teamId: "h", clickbaitScore: clickbait, isDemo: false });
  const arts = [article("1", "ספורט 5", 80), article("2", "ONE", 0)];
  const html = [
    renderToStaticMarkup(<StandingsTable rows={rows.map((r, i) => ({ ...r, liveResult: i === 0 ? "W" : null, positionChange: i === 0 ? 2 : 0 }))} teams={teams} sport="football" zones={{ top: 1, bottom: 1 }} />),
    renderToStaticMarkup(<EventsTimeline events={events} homeTeamId="h" />),
    renderToStaticMarkup(<StatBars stats={match().stats} sport="football" homeName="מכבי חיפה" awayName="הפועל באר שבע" />),
    renderToStaticMarkup(<Lineups lineUps={lineUps} homeName="מכבי חיפה" awayName="הפועל באר שבע" fanAverages={new Map([["Player 1", 8.2]])} />),
    renderToStaticMarkup(<FormGuide home={teams.get("h")!} away={teams.get("a")!} homeForm="WWDLW" awayForm="LLDWW" h2h={[match()]} teams={teams} />),
    renderToStaticMarkup(<VibeBar optimistic={82} worried={18} votes={40} />),
    renderToStaticMarkup(<ThreadCard thread={{ id: "t", titleHe: "ניצחון 3:1", vibeOptimistic: 82, vibeWorried: 18, teamId: "h", category: "football_israel", heroImageUrl: null, lastPublishedAt: "2026-10-24T10:00:00Z", articles: arts }} />),
    renderToStaticMarkup(<StoryReader articles={arts} />),
    renderToStaticMarkup(<RatingsPanel matchId="m1" finished signedIn lineUps={lineUps} homeName="מכבי חיפה" awayName="הפועל באר שבע" summary={[{ playerName: "Player 1", average: 8.25, count: 12 }]} mine={{ "Player 1": { rating: 9, note: null } }} />)
  ].join("\n");
  assert.ok(!WESTERN_ONLY.test(html), "found Arabic-Indic digits");
  assert.match(text(html), /8\.3|8\.2/); // fan average rendered with Western decimals
  assert.ok(text(html).includes("86%") && text(html).includes("2.31"));
  assert.ok(!/class="[^"]*\b(ml|mr|pl|pr|left|right|text-left|text-right|border-l|border-r|rounded-l|rounded-r)-/.test(html), "physical direction utility found");
});

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|css)$/.test(f)) out.push(p);
  }
  return out;
}

test("source audit: no physical left/right Tailwind utilities anywhere in app/ and components/", () => {
  const bad = /(?<![\w-])(?:-?m[lr]|p[lr]|border-[lr]|rounded-[lr]|text-(?:left|right)|float-(?:left|right)|(?:left|right)-\d)(?:-[\w\[\]./]+)?(?=[\s"'`])/;
  const offenders = [...walk("app"), ...walk("components")].filter((f) => f.endsWith(".tsx")).flatMap((f) => readFileSync(f, "utf8").split("\n").flatMap((line, i) => (/className/.test(line) && bad.test(line.replace(/\b(?:mt|mb|pt|pb)-/g, "")) ? [`${f}:${i + 1}`] : [])));
  assert.deepEqual(offenders, []);
});
