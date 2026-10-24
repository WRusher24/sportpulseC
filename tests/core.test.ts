import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBaseline } from "../db/baseline";
import { LEAGUE_SEEDS, TEAM_SEEDS } from "../db/seed-teams";
import { buildAliasIndex, detectCategory, detectTeam } from "../lib/ingest/classify";
import { findThread } from "../lib/ingest/cluster";
import { extractArticle } from "../lib/ingest/extract";
import { parseFeed } from "../lib/ingest/feed";
import { heuristicNeutralize } from "../lib/ai/neutralize";
import { fmtNum, fmtDate, fmtShortDate, fmtTime, toWesternDigits } from "../lib/format";
import { resolveCredentials } from "../lib/server/credentials";
import { decryptJson, encryptJson, hashPassword, verifyPassword } from "../lib/server/secrets";
import { signSession, verifySession } from "../lib/server/session-token";
import { simulateSeason } from "../lib/analytics/season";
import { sanitizeUserKeys, safePublicHttpsUrl } from "../lib/keys";
import { mapEspnEvent, mapEspnStandings } from "../lib/sports/espn";
import { ChainProvider } from "../lib/sports/chain";
import { makeScrapeContext, parseResults, parseStandingsTables, discoverScoreLinks, israelLocalToUtc } from "../lib/sports/portal-parse";
import type { SportsProvider } from "../lib/sports/types";

const baseline = buildBaseline(new Date("2026-10-24T08:00:00Z"));

test("seed is real-world structure only: no fabricated matches, results or articles", () => {
  assert.equal(baseline.matches.length, 0);
  assert.equal(baseline.events.length, 0);
  assert.equal(baseline.articles.length, 0);
  assert.equal(baseline.threads.length, 0);
  assert.ok(baseline.standings.every((s) => s.played === 0 && s.points === 0));
});

test("seed contains the required real leagues and clubs", () => {
  const leagues = new Set(LEAGUE_SEEDS.map((l) => l.nameEn));
  for (const n of ["Israeli Premier League", "Liga Leumit", "Winner League Basketball", "UEFA Champions League", "English Premier League", "Spanish La Liga", "EuroLeague Basketball", "NBA"]) assert.ok(leagues.has(n), n);
  const ids = new Set(TEAM_SEEDS.map((t) => t.id));
  for (const id of ["maccabi-haifa", "maccabi-tel-aviv-fc", "beitar-jerusalem", "hapoel-beer-sheva", "hapoel-tel-aviv-fc", "maccabi-tel-aviv-bc", "hapoel-jerusalem-bc", "hapoel-tel-aviv-bc", "real-madrid", "arsenal", "oklahoma-city-thunder"]) assert.ok(ids.has(id), id);
  assert.equal(TEAM_SEEDS.filter((t) => t.leagueId === "epl").length, 20);
  assert.equal(TEAM_SEEDS.filter((t) => t.leagueId === "laliga").length, 20);
  assert.equal(TEAM_SEEDS.filter((t) => t.leagueId === "nba").length, 30);
  assert.equal(TEAM_SEEDS.filter((t) => t.leagueId === "il-premier").length, 14);
  assert.equal(new Set(TEAM_SEEDS.map((t) => t.id)).size, TEAM_SEEDS.length);
  for (const t of TEAM_SEEDS) assert.ok(LEAGUE_SEEDS.some((l) => l.id === t.leagueId && l.sportType === t.sportType), t.id);
});

test("format helpers render Western numerals under the he-IL locale", () => {
  const d = new Date("2026-10-24T17:30:00Z");
  for (const out of [fmtDate(d), fmtShortDate(d), fmtTime(d), fmtNum(1234.5, 1)]) assert.ok(!/[\u0660-\u0669\u06f0-\u06f9]/.test(out), out);
  assert.equal(fmtTime(d), "20:30");
  assert.equal(fmtNum(7, 2), "7.00");
  assert.equal(toWesternDigits("٠١٢٣٤٥٦٧٨٩ ۰۱۲"), "0123456789 012");
});

const ynetFeed = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<item><title><![CDATA[רעידת אדמה בכרמל! מכבי חיפה הפילה את הפועל באר שבע]]></title><link>https://www.ynet.co.il/sport/article/abc123</link><pubDate>Sat, 24 Oct 2026 06:00:00 GMT</pubDate><description><![CDATA[<p>תקציר <b>הכתבה</b></p><img src="https://img/x.jpg">]]></description><dc:creator>דוד כהן</dc:creator><media:content url="https://img.example/hero.jpg"/></item>
<item><title>No link</title></item></channel></rss>`;

test("RSS parsing extracts title, link, date, plain-text description, image and author", () => {
  const items = parseFeed(ynetFeed, { key: "ynet" }, "https://www.ynet.co.il/feed");
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://www.ynet.co.il/sport/article/abc123");
  assert.equal(items[0].description, "תקציר הכתבה");
  assert.equal(items[0].imageUrl, "https://img.example/hero.jpg");
  assert.equal(items[0].author, "דוד כהן");
  assert.equal(items[0].publishedAt, "2026-10-24T06:00:00.000Z");
});

const articleHtml = `<!doctype html><html><head><title>x</title>
<meta property="og:title" content="מכבי חיפה ניצחה 2:1"><meta property="og:image" content="/img/hero.jpg"><meta property="article:published_time" content="2026-10-24T05:00:00Z"><meta name="author" content="מאת: רוני לוי">
<link rel="canonical" href="https://www.sport5.co.il/article/1"></head><body>
<header><nav>תפריט</nav></header>
<div class="top-banner">קבלו בונוס הרשמה עכשיו!</div>
<div class="adsbygoogle">AD</div>
<article class="article-main">
<h1>מכבי חיפה ניצחה 2:1</h1>
<p>מכבי חיפה ניצחה את הפועל באר שבע 2:1 במשחק שנערך אמש באצטדיון סמי עופר, בפני קהל רב שהגיע לעודד את הקבוצה.</p>
<div class="promo-box"><p>תוכן שיווקי: הימורים בבית עם בונוס מיוחד לחברים חדשים באתר שלנו כאן ועכשיו</p></div>
<p>לחצו כאן להרשמה והרוויחו עד 500 שקל בונוס בהימורי ספורט מהאתר המוביל בישראל היום.</p>
<h2>הסיכום של המשחק</h2>
<p>השער המנצח נכבש בדקה ה-88 אחרי מהלך התקפי יפה של הקבוצה המארחת, שהציגה כושר התקפי מרשים לאורך כל המשחק.</p>
<iframe src="https://ads.example/x"></iframe><script>alert(1)</script>
<div class="related-articles"><p>קראו גם: כתבה אחרת על קבוצה אחרת שלא קשורה לכתבה הזו בכלל</p></div>
<a href="https://track.example/?affiliate=1">לחצו כאן</a>
</article><footer><p>כל הזכויות שמורות לאתר הספורט הישראלי בע״מ ואין להעתיק ללא רשות.</p></footer></body></html>`;

test("article extraction strips ads, promos, widgets, scripts and keeps clean editorial text", () => {
  const r = extractArticle(articleHtml, "https://www.sport5.co.il/article/1", { bodySelectors: [".article-main"], authorSelectors: [] });
  assert.equal(r.title, "מכבי חיפה ניצחה 2:1");
  assert.equal(r.imageUrl, "https://www.sport5.co.il/img/hero.jpg");
  assert.equal(r.author, "רוני לוי");
  assert.equal(r.canonicalUrl, "https://www.sport5.co.il/article/1");
  assert.equal(r.publishedAt, "2026-10-24T05:00:00.000Z");
  assert.ok(r.text.includes("השער המנצח נכבש בדקה ה-88"));
  assert.ok(r.text.includes("## הסיכום של המשחק"));
  for (const bad of ["בונוס", "הימור", "alert", "קראו גם", "כל הזכויות", "לחצו כאן", "תוכן שיווקי", "AD"]) assert.ok(!r.text.includes(bad), `leaked: ${bad}`);
  assert.ok(!/<[a-z]/i.test(r.text));
});

test("generic extractor works without site hints (text density heuristic)", () => {
  const r = extractArticle(articleHtml.replace('class="article-main"', ""), "https://x.example/a");
  assert.ok(r.text.length > 150);
});

const teams = baseline.teams;
const index = buildAliasIndex(teams);

test("team detection: Hebrew prefixes, longest alias wins, sport context disambiguates", () => {
  assert.equal(detectTeam(index, "מכבי חיפה הביסה את הפועל חיפה", "")?.id, "maccabi-haifa");
  assert.equal(detectTeam(index, "הפועל חיפה הפתיעה בבית", "")?.id, "hapoel-haifa");
  assert.equal(detectTeam(index, "ניצחון של מכבי תל אביב בכדורסל ביורוליג", "")?.id, "maccabi-tel-aviv-bc");
  assert.equal(detectTeam(index, "מכבי תל אביב הפסידה בליגת העל בשער בדקה ה-90", "כדורגל")?.id, "maccabi-tel-aviv-fc");
  assert.equal(detectTeam(index, "Arsenal beat Chelsea", "")?.id, "arsenal");
  assert.equal(detectTeam(index, "ביום שלישי יתקיים משחק", ""), null);
});

test("category detection", () => {
  const t = teams.find((x) => x.id === "maccabi-haifa")!;
  assert.equal(detectCategory(t, "מכבי חיפה ניצחה", ""), "football_israel");
  assert.equal(detectCategory(t, "מכבי חיפה חתמה על שחקן חדש", ""), "transfers");
  assert.equal(detectCategory(teams.find((x) => x.id === "arsenal")!, "ארסנל ניצחה", ""), "football_world");
  assert.equal(detectCategory(teams.find((x) => x.id === "hapoel-jerusalem-bc")!, "הפועל ירושלים ניצחה", ""), "basketball_israel");
});

test("story clustering groups the same event across outlets and keeps different events apart", () => {
  const sig = "מכבי חיפה ניצחה הפועל באר שבע דרמה סמי עופר דקה 88 שער".split(" ").map((w) => w).join(" ");
  const cand = [{ id: "t1", signature: "חיפה ניצחה פועל באר שבע דרמה סמי עופר שער", teamId: "maccabi-haifa", category: "football_israel" as const, lastPublishedAt: "2026-10-24T06:00:00Z", titleHe: "x" }];
  void sig;
  const same = findThread(cand, { title: "מכבי חיפה גברה על הפועל באר שבע בדרמה", leadText: "המשחק נערך בסמי עופר והסתיים בשער דרמטי", teamId: "maccabi-haifa", category: "football_israel", publishedAt: "2026-10-24T07:00:00Z" });
  assert.equal(same?.id, "t1");
  const other = findThread(cand, { title: "מאמן בית״ר ירושלים הודיע על התפטרות מהתפקיד", leadText: "", teamId: "beitar-jerusalem", category: "football_israel", publishedAt: "2026-10-24T07:00:00Z" });
  assert.equal(other, null);
  const stale = findThread(cand, { title: "מכבי חיפה גברה על הפועל באר שבע בדרמה", leadText: "", teamId: "maccabi-haifa", category: "football_israel", publishedAt: "2026-10-27T07:00:00Z" });
  assert.equal(stale, null);
});

test("anti-clickbait heuristic strips sensational framing and scores it", () => {
  const r = heuristicNeutralize("רעידת אדמה בכרמל!!! מכבי חיפה הפילה את הפועל באר שבע!", "מכבי חיפה ניצחה את הפועל באר שבע 2:1. זה קרה אמש באצטדיון.");
  assert.ok(!r.neutralTitle.includes("!"));
  assert.ok(r.clickbaitScore >= 40);
  assert.ok(r.summary.startsWith("מכבי חיפה ניצחה"));
  assert.ok(heuristicNeutralize("מכבי חיפה ניצחה 2:1 את הפועל באר שבע", "").clickbaitScore < 20);
});

test("credential precedence: browser keys > account keys > environment", () => {
  const save = { ...process.env };
  process.env.OPENAI_API_KEY = "env-openai-key-1234";
  process.env.ANTHROPIC_API_KEY = "";
  process.env.API_FOOTBALL_KEY = "";
  process.env.SPORTMONKS_TOKEN = "";
  process.env.SPORTS_PROVIDER = "";
  process.env.AI_PROVIDER = "";
  process.env.GEMINI_API_KEY = "";
  process.env.CUSTOM_AI_BASE_URL = "";
  try {
    assert.deepEqual([resolveCredentials().ai.source, resolveCredentials().ai.apiKey], ["env", "env-openai-key-1234"]);
    assert.equal(resolveCredentials({ accountKeys: { openaiKey: "account-key-12345" } }).ai.apiKey, "account-key-12345");
    const user = resolveCredentials({ requestKeys: { openaiKey: "browser-key-12345" }, accountKeys: { openaiKey: "account-key-12345" } });
    assert.deepEqual([user.ai.apiKey, user.ai.source], ["browser-key-12345", "user"]);
    const claude = resolveCredentials({ requestKeys: { anthropicKey: "sk-ant-browser-123", aiProvider: "anthropic" } });
    assert.equal(claude.ai.provider, "anthropic");
    assert.equal(resolveCredentials().sports.provider, "auto");
    assert.equal(resolveCredentials().sports.source, "none");
    assert.equal(resolveCredentials({ requestKeys: { apiFootballKey: "football-key-1234" } }).sports.source, "user");
    assert.equal(resolveCredentials({ requestKeys: { sportsProvider: "api-football" } }).sports.provider, "auto"); // no key: free chain
    assert.equal(resolveCredentials({ requestKeys: { sportsProvider: "portals" } }).sports.provider, "portals");
    assert.equal(resolveCredentials({ requestKeys: { sportsProvider: "mock", apiFootballKey: "football-key-1234" } }).sports.provider, "mock");
  } finally {
    Object.assign(process.env, save);
  }
});

test("user key sanitising rejects malformed keys", () => {
  assert.deepEqual(sanitizeUserKeys({ openaiKey: "short", anthropicKey: "has space in it 123", apiFootballKey: "valid-key-12345" }), { apiFootballKey: "valid-key-12345" });
});

test("secrets: AES-GCM envelope round-trips and rejects tampering; scrypt verifies; sessions are signed", async () => {
  const env = encryptJson({ openaiKey: "sk-test-12345678" });
  assert.deepEqual(decryptJson(env), { openaiKey: "sk-test-12345678" });
  assert.equal(decryptJson(env.slice(0, -2) + "AA"), null);
  assert.ok(!env.includes("sk-test"));
  const h = await hashPassword("correct horse");
  assert.ok(await verifyPassword("correct horse", h));
  assert.ok(!(await verifyPassword("wrong", h)));
  const tok = signSession("user-1");
  assert.equal(verifySession(tok), "user-1");
  assert.equal(verifySession(tok.replace("user-1", "user-2")), null);
  assert.equal(verifySession(tok, Date.now() + 31 * 86_400_000), null);
});

test("season simulation: probabilities are coherent and favour the leader", () => {
  const ids = TEAM_SEEDS.filter((t) => t.leagueId === "il-premier").map((t) => t.id);
  const table = ids.map((teamId, i) => ({ leagueId: "il-premier", teamId, position: i + 1, played: 10, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 14 - i * 2, points: 30 - i * 2, form: "", isDemo: false }));
  const sims = simulateSeason(table, { totalGames: 26, sport: "football", runs: 600 });
  for (const d of sims) assert.ok(Math.abs(d.positions.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(sims[0].expectedPosition < sims.at(-1)!.expectedPosition);
});

test("Gemini and custom OpenAI-compatible providers resolve with the right precedence", () => {
  const save = { ...process.env };
  for (const k of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "AI_PROVIDER", "CUSTOM_AI_BASE_URL", "CUSTOM_AI_API_KEY"]) process.env[k] = "";
  try {
    assert.equal(resolveCredentials().ai.provider, null);
    process.env.GEMINI_API_KEY = "env-gemini-key-1234";
    assert.deepEqual([resolveCredentials().ai.provider, resolveCredentials().ai.source, resolveCredentials().ai.model], ["gemini", "env", "gemini-2.5-flash"]);
    const picked = resolveCredentials({ requestKeys: { aiProvider: "openai", openaiKey: "browser-openai-1234", geminiKey: "browser-gemini-1234" } });
    assert.deepEqual([picked.ai.provider, picked.ai.apiKey], ["openai", "browser-openai-1234"]);
    const custom = resolveCredentials({ requestKeys: { aiProvider: "custom", customBaseUrl: "https://llm.example.com/v1/", customModel: "llama3.1:8b" } });
    assert.deepEqual([custom.ai.provider, custom.ai.baseUrl, custom.ai.model, custom.ai.apiKey], ["custom", "https://llm.example.com/v1", "llama3.1:8b", null]);
    assert.equal(resolveCredentials({ requestKeys: { customBaseUrl: "http://localhost:11434/v1" } }).ai.provider, "gemini"); // unsafe URL dropped
  } finally {
    Object.assign(process.env, save);
  }
});

test("SSRF guard accepts only public https endpoints", () => {
  assert.equal(safePublicHttpsUrl("https://api.groq.com/openai/v1/"), "https://api.groq.com/openai/v1");
  for (const bad of ["http://api.example.com/v1", "https://localhost/v1", "https://127.0.0.1/v1", "https://10.0.0.5/v1", "https://192.168.1.2/v1", "https://169.254.169.254/latest", "https://[::1]/v1", "https://user:pw@example.com/v1", "https://intranet/v1", "https://box.local/v1", "ftp://example.com", "not a url"]) assert.equal(safePublicHttpsUrl(bad), null, bad);
});

test("ESPN mapping: statuses, scores, minutes and standings", () => {
  const ev = (state: string, name: string, period: number, clock: string, hs: string, as: string) => ({ id: "1", date: "2026-10-24T14:00Z", competitions: [{ competitors: [{ homeAway: "home" as const, score: hs, team: { displayName: "Arsenal" } }, { homeAway: "away" as const, score: as, team: { displayName: "Chelsea" } }], status: { displayClock: clock, period, type: { name, state } } }] });
  assert.equal(mapEspnEvent(ev("pre", "STATUS_SCHEDULED", 0, "0'", "0", "0"), "epl", false)?.homeScore, null);
  const live = mapEspnEvent(ev("in", "STATUS_SECOND_HALF", 2, "67'", "2", "1"), "epl", false)!;
  assert.deepEqual([live.status, live.minute, live.homeScore, live.awayScore, live.leagueId], ["second_half", 67, 2, 1, "epl"]);
  assert.equal(mapEspnEvent(ev("post", "STATUS_FULL_TIME", 2, "90'", "3", "0"), "epl", false)?.status, "finished");
  assert.equal(mapEspnEvent(ev("in", "STATUS_HALFTIME", 1, "45'", "0", "0"), "epl", false)?.status, "half_time");
  const table = mapEspnStandings({ children: [{ standings: { entries: [{ team: { displayName: "Arsenal" }, stats: [{ name: "gamesPlayed", value: 9 }, { name: "wins", value: 7 }, { name: "ties", value: 1 }, { name: "losses", value: 1 }, { name: "pointsFor", value: 20 }, { name: "pointsAgainst", value: 5 }, { name: "points", value: 22 }] }] } }] }, false);
  assert.deepEqual([table[0].played, table[0].points, table[0].goalsFor], [9, 22, 20]);
});

const T = (id: string) => TEAM_SEEDS.find((t) => t.id === id)!.nameHe;
const premier = TEAM_SEEDS.filter((t) => t.leagueId === "il-premier");
const ctx = makeScrapeContext(baseline.teams, baseline.leagues);

test("portal scraper: league table is recognised from content, not selectors", () => {
  const rows = premier.slice(0, 8).map((t, i) => `<tr><td>${i + 1}</td><td><a>${t.nameHe}</a></td><td>10</td><td>${8 - i}</td><td>1</td><td>${1 + i}</td><td>${20 - i}:${5 + i}</td><td>${25 - 3 * i}</td></tr>`).join("");
  const html = `<html><body><table><tr><th>#</th><th>קבוצה</th><th>מש'</th><th>נצ'</th><th>ת'</th><th>הפ'</th><th>שערים</th><th>נק'</th></tr>${rows}</table><table><tr><td>x</td><td>y</td></tr></table></body></html>`;
  const tables = parseStandingsTables(html, ctx);
  assert.equal(tables.length, 1);
  assert.equal(tables[0].leagueId, "il-premier");
  assert.equal(tables[0].rows.length, 8);
  assert.deepEqual([tables[0].rows[0].played, tables[0].rows[0].wins, tables[0].rows[0].goalsFor, tables[0].rows[0].points], [10, 8, 20, 25]);
  // arithmetic that does not add up (played != W+D+L) is rejected
  assert.equal(parseStandingsTables(html.replace(/<td>10<\/td>/g, "<td>11</td>"), ctx).length, 0);
});

test("portal scraper: finished, live and upcoming matches", () => {
  const now = new Date("2026-10-24T13:00:00Z");
  const html = `<html><head><title>תוצאות ליגת העל</title></head><body><ul>
    <li class="g">${T("maccabi-haifa")} 2 - 1 ${T("hapoel-beer-sheva")} סיום</li>
    <li class="g">${T("beitar-jerusalem")} 0:1 ${T("maccabi-netanya")} 67'</li>
    <li class="g">24.10 ${T("hapoel-tel-aviv-fc")} ${T("bnei-sakhnin")} 20:30</li>
    <li class="g">מכבי נתניה בלי יריב כאן</li></ul></body></html>`;
  const m = parseResults(html, ctx, now);
  const by = (home: string) => m.find((x) => x.homeName === T(home))!;
  assert.equal(m.length, 3);
  assert.deepEqual([by("maccabi-haifa").status, by("maccabi-haifa").homeScore, by("maccabi-haifa").awayScore, by("maccabi-haifa").leagueId], ["finished", 2, 1, "il-premier"]);
  assert.deepEqual([by("beitar-jerusalem").status, by("beitar-jerusalem").minute, by("beitar-jerusalem").awayScore], ["second_half", 67, 1]);
  assert.deepEqual([by("hapoel-tel-aviv-fc").status, by("hapoel-tel-aviv-fc").homeScore, by("hapoel-tel-aviv-fc").kickoff], ["scheduled", null, "2026-10-24T17:30:00.000Z"]);
});

test("Israel local time converts to UTC across DST", () => {
  assert.equal(israelLocalToUtc(2026, 10, 24, 20, 30).toISOString(), "2026-10-24T17:30:00.000Z"); // IDT (+3)
  assert.equal(israelLocalToUtc(2026, 12, 5, 20, 30).toISOString(), "2026-12-05T18:30:00.000Z"); // IST (+2)
});

test("portal link discovery finds table/results pages on the same site only", () => {
  const html = `<a href="/liga/table">טבלת ליגת העל</a><a href="https://evil.example.com/x">תוצאות</a><a href="/news/1">כתבה ארוכה על משהו אחר לגמרי</a><a href="/results">תוצאות</a>`;
  assert.deepEqual(discoverScoreLinks(html, "https://www.sport5.co.il/"), ["https://www.sport5.co.il/liga/table", "https://www.sport5.co.il/results"]);
});

test("provider chain falls through failures and empty answers", async () => {
  const mk = (id: string, fixtures: () => Promise<any[]>): SportsProvider => ({ id: id as never, liveDirect: false, refreshMs: 1000, supports: () => true, liveMatches: async () => [], fixtures, standings: async () => [], detail: async () => null });
  const league = baseline.leagues[0];
  const row = { externalId: "x", leagueExternalId: null, homeName: "a", awayName: "b", homeScore: null, awayScore: null, status: "scheduled" as const, minute: null, kickoff: "2026-10-24T10:00:00Z", venue: null, round: null };
  const chain = new ChainProvider([mk("espn", async () => { throw new Error("down"); }), mk("portals", async () => []), mk("api-football", async () => [row])]);
  assert.equal((await chain.fixtures(league, "2026-10-24", "2026-10-25")).length, 1);
});
