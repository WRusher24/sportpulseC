# SportPulse Israel – Deployment Guide

Production deployment of **SportPulse Israel (ספורט פאלס)** on GitHub + Vercel + Neon PostgreSQL.
The project is zero-config for Vercel: no code edits are required, only environment variables.

## 1. How the repository was populated

The codebase was generated in a single session, validated, and pushed to
`https://github.com/WRusher24/sportpulseC` on branch `claude/sweet-brahmagupta-2zurya`:

1. `git init`-equivalent: the repository was cloned empty; all project files were created inside it.
2. Validation before the push: `npm run typecheck`, `npm test` (18 tests, including the SQL migration, seed and repository running against a real Postgres engine via PGlite) and `next build` all pass.
3. Files were committed with a clean message history and pushed with `git push -u origin <branch>`.
4. Merge the branch into `main` (or make it your production branch in Vercel) when you are ready to go live.

## 2. Import into Vercel

1. Create a Neon project (https://neon.tech) and copy the **pooled** connection string (`postgresql://…neon.tech/…?sslmode=require`).
2. In Vercel: **Add New → Project → Import Git Repository** and select `sportpulseC`.
3. Framework preset is detected automatically (Next.js). `vercel.json` already sets the build command (`npm run vercel-build`), cron jobs and function durations. Do not change them.
4. Add the environment variables below, then click **Deploy**.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes (production) | Neon connection string. Without it the app still runs on an in-memory store (no persistence, no accounts across instances). |
| `AUTH_SECRET` | recommended | 32+ random chars (`openssl rand -hex 32`). Signs session cookies and encrypts API keys synced to accounts. Falls back to a value derived from `DATABASE_URL`. |
| `CRON_SECRET` | recommended | Vercel sends it as `Authorization: Bearer …` to cron routes; requests without it are rejected. |
| `AI_PROVIDER` (`openai` \| `anthropic` \| `gemini` \| `custom`), `GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `CUSTOM_AI_BASE_URL`, `CUSTOM_AI_API_KEY`, `CUSTOM_AI_MODEL` | optional | System AI fallback (anti-clickbait titles, vibe, digest, analyst). With several keys the order is: `AI_PROVIDER`, then Gemini, OpenAI, Anthropic, custom. Without any key the app uses deterministic, data-driven fallbacks. `CUSTOM_AI_BASE_URL` is any OpenAI-compatible server (Ollama, vLLM, OpenRouter, Groq…). |
| `SPORTS_PROVIDER` (`auto` default \| `espn` \| `portals` \| `api-football` \| `sportmonks` \| `mock`), `API_FOOTBALL_KEY`, `API_BASKETBALL_KEY`, `SPORTMONKS_TOKEN` | **not needed** | Live data works with **no key**: see section 5. Paid keys are optional and, when present, are tried first. `mock` disables live data. |
| `FEED_URL_SPORT5`, `FEED_URL_ONE`, `FEED_URL_SPORT1`, `FEED_URL_YNET`, `FEED_URL_WALLA` | optional | Override an RSS endpoint if a portal moves its feed. |
| `SKIP_DB_SEED`, `SKIP_INGEST_ON_BUILD`, `DISABLE_LAZY_REFRESH` | optional | Skip the first-deploy seed / first news pull / the refresh-on-visit cycle. |

## 3. Environment variables vs. Settings-page API keys

Every credential is resolved per request with this precedence:

1. **Key typed in `/settings`** – stored encrypted in the browser (AES-GCM, non-extractable key in IndexedDB, ciphertext in localStorage) and sent over HTTPS in request headers (`x-sp-*`) to API routes, or as an argument to Server Actions.
2. **Key synced to the signed-in account** – encrypted server-side with AES-256-GCM (`users.custom_api_keys_json`).
3. **System environment variable.**

Consequences: a deployment works with only env vars; individual fans/admins can override them without redeploying; keys are never logged, never cached (`no-store`), and are never part of exports. Cron jobs always use environment variables only.
System-funded AI calls are rate limited (30 per hour per IP); users with their own key are not.

## 4. Database migrations and seeding (automatic)

`npm run vercel-build` = `tsx scripts/prebuild.ts && next build`:

1. Applies the SQL files in `drizzle/` through Drizzle's Neon migrator (idempotent, tracked in `__drizzle_migrations`).
2. If the database is empty, seeds it (`db/seed.ts`, `ON CONFLICT DO NOTHING`): 8 competitions and 119 real clubs with grounds and provider ids, plus opening tables.
3. Makes one best-effort news ingestion so the feed is populated on day one (never fails the build).

If `DATABASE_URL` is missing the step is skipped. Manual commands: `npm run db:migrate`, `npm run db:seed`, `npm run db:generate` (after editing `db/schema.ts`; commit the generated SQL).

### About the data

* Real and static: leagues, clubs (Hebrew and English names, aliases, grounds), provider ids.
* Club lists are the last verified top-flight rosters; promotion/relegation is reconciled when the provider sync runs.
* **No fabricated fixtures, results, player names or articles are seeded.** Real data arrives through the pipelines below.

## 5. Data pipelines: news, scores, fixtures, tables

### News (Sport5, ONE, Sport1, Ynet Sport, Walla Sport)

Each cycle: RSS feed (HTML section-page fallback) → dedupe by canonical URL → full-text extraction with Cheerio (ads, banners, popups, affiliate/betting promos, widgets and scripts removed; plain text only) → team/category detection → **story clustering into master threads** (same team, 36 h window, headline overlap) → anti-clickbait neutral titles + TL;DR → vibe score.

### Live scores, fixtures and standings – no subscription required

The default `auto` chain, in order:

1. a paid provider (API-Football / Sportmonks) **only if** you supplied a key;
2. **ESPN public JSON** (free, key-less, unofficial): English Premier League, La Liga, Champions League, NBA;
3. **Israeli portal scraping** (automatic fallback): the five portals' home pages are crawled, their "table / results / fixtures" links are discovered, and the parsers recognise league tables and match rows from the *content* (club names + played/W/D/L/goals/points, scores, minutes, kick-off times) rather than CSS selectors. Results are validated (played = W+D+L, one league per table) before they are stored. This covers the Israeli Premier League, Liga Leumit and Winner League, plus anything the portals publish for other leagues.

Scraped data has no lineups, per-match statistics or event timelines (those need a provider); the match page shows empty states instead of inventing them. Fixtures/tables refresh at most every 15–20 minutes per league; live scores whenever a match is active.

> Honest limits: the portal parsers and ESPN mappings are covered by unit tests on representative HTML/JSON, but the build environment could not reach those sites. If a portal changes its structure or hides tables behind JavaScript rendering, that source silently yields nothing and the next one is used; check `GET /api/cron/ingest` (per-source errors in the JSON) after deploying.

### Match correctness rules

* All day grouping, kick-off parsing and "today" logic use `Asia/Jerusalem` (daylight saving aware); provider timestamps are stored as UTC instants.
* The match **status is authoritative** for rendering: UPCOMING never shows a score, LIVE shows score + minute, FINAL shows the score without a minute (`lib/data/normalize.ts`). A "live" row older than 3.5 hours becomes FINAL; one that starts in the future becomes UPCOMING.
* Provider/scraper calls bypass Next's data cache (`no-store`), so cached payloads cannot override fresh fixture or event states.
* Portal scraping merges what several sites say about the same fixture: home/away orientation is decided by **vote** across sources (scores are flipped to the winning orientation) and the most advanced status wins; one pairing yields one row per Israel day.
* Events, statistics and lineups come from ESPN's match summary for Premier League, La Liga, Champions League (or a paid provider for everything else); finished matches are back-filled within 3 days. Portals provide scores and tables only.
* **Live standings ("טבלה בזמן אמת")**: the Tables tab adds every in-progress match to the official table (with ▲/▼ movement); "חזרה לטבלה הרשמית" shows the provider table unchanged.

### How often it runs (3 layers)

| Layer | Frequency | Notes |
| --- | --- | --- |
| Vercel Cron `/api/cron/ingest` | daily 00:00 UTC | Hobby plan limit. Digest cron: 04:00 and 05:00 UTC (only the one at 07:00 Israel time does work, so DST is handled). |
| GitHub Actions `.github/workflows/scheduled-refresh.yml` | **every 5 minutes**, free | Add repository secrets `APP_URL` (e.g. `https://your-app.vercel.app`) and `CRON_SECRET` (same value as the Vercel variable). Without `APP_URL` the workflow does nothing. GitHub may delay scheduled runs by a few minutes under load. |
| Refresh on visit | whenever the latest run is > 5 min old | The first request after that window schedules a background cycle (`after()`), so data stays fresh while anyone uses the app, with no extra setup. |

On a Pro plan you can set the ingest cron in `vercel.json` back to `*/5 * * * *`.

Scraping notes: the user-agent identifies the bot, requests have timeouts/size caps, extraction output is plain text only, and every article shows a source badge with a canonical link. Check each portal's terms of use and robots.txt before enabling full-text republishing or score scraping in production. Puppeteer is intentionally not used (headless Chromium does not fit serverless limits).

### AI providers

Gemini, OpenAI, Anthropic and any OpenAI-compatible endpoint are first-class. Gemini model names are retired regularly (1.5 and 2.5 already have been). The default is `gemini-3.8-flash`; if Google answers 404 for a model you did not pin, the app asks Google's model list for the newest Flash model your key can use and retries. Leave the model field empty for this automatic behaviour; a model typed in Settings (or `GEMINI_MODEL`) is used exactly as given.

The analyst never ends on a bare error: if the LLM fails, the reply falls back to the data-driven answer built from the same facts. Context sent to any LLM is sanitised (control characters, code fences and instruction-like phrases removed, lengths capped) and all Server Actions are guarded so the UI receives a clean error message instead of an exception. User-supplied custom endpoints must be public HTTPS (localhost, private IPs and redirects are refused to prevent SSRF); the operator-controlled `CUSTOM_AI_BASE_URL` variable may point anywhere.

## 6. Local development

```bash
npm install
cp .env.example .env.local   # optional
npm run dev                  # http://localhost:3000 (in-memory store when DATABASE_URL is empty)
npm run typecheck && npm test
```

## 7. Quality gates

```bash
npm run typecheck        # TypeScript
npm test                 # 37 tests: parsers, scraping merge, providers, credentials, SQL migration/seed/repository on real Postgres (PGlite), RTL + Western-digit render audit
npm run build && npm run verify:serverless   # fails if any third-party package would be require()d at runtime (the ERR_REQUIRE_ESM class of bug)
npm run audit:ui         # needs a running server and a global playwright: RTL, Western digits, no overflow, WCAG AA contrast, 4 themes x 7 pages
```

## 8. Verification checklist after deploying

1. `/settings` → API keys → "בדיקת מפתח" confirms the AI and sports keys.
2. Trigger ingestion once: `curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/ingest` and inspect the JSON report (per-source errors show feed problems).
3. Trigger the digest: `…/api/cron/digest?force=1`.
4. `/api/ai-status` shows which credential source each integration uses (never the key).
