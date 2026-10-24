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
| `AI_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | optional | System AI fallback (anti-clickbait titles, vibe, digest, analyst). Without any key the app uses deterministic, data-driven fallbacks. |
| `SPORTS_PROVIDER`, `API_FOOTBALL_KEY`, `API_BASKETBALL_KEY`, `SPORTMONKS_TOKEN` | optional but needed for scores | Live fixtures, results, standings, lineups, events. **Without a provider the Match Center shows only opening tables (0 games) – nothing is invented.** |
| `FEED_URL_SPORT5`, `FEED_URL_ONE`, `FEED_URL_SPORT1`, `FEED_URL_YNET`, `FEED_URL_WALLA` | optional | Override an RSS endpoint if a portal moves its feed. |
| `SKIP_DB_SEED`, `SKIP_INGEST_ON_BUILD` | optional | Skip the first-deploy seed / first news pull. |

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

## 5. Background jobs (`vercel.json`)

| Route | Schedule | Work |
| --- | --- | --- |
| `/api/cron/ingest` | every 5 minutes | RSS (HTML-listing fallback) → full-text extraction with ad stripping → team/category detection → story clustering → anti-clickbait titles + TL;DR → vibe score; then provider sync (fixtures/standings every 6 h per league, live scores only when a match is active). |
| `/api/cron/digest?slot=summer` and `slot=winter` | 04:00 and 05:00 UTC | Cron is UTC-only; the route runs only when the Israel-local hour is 07, so exactly one of the two fires, all year (daylight saving safe). |

**Plan note:** Vercel Hobby allows only daily crons, so `*/5` requires Pro. On Hobby, change the ingest schedule to daily or call `GET /api/cron/ingest` every 5 minutes from an external scheduler (add header `Authorization: Bearer $CRON_SECRET`).

Scraping notes: the user-agent identifies the bot, requests have timeouts/size caps, extraction output is plain text only, and every article shows a source badge with a canonical link. Check each portal's terms of use and robots.txt before enabling full-text republishing; reduce to summaries if required. Puppeteer is intentionally not used (headless Chromium does not fit serverless limits); Cheerio handles server-rendered article pages.

## 6. Local development

```bash
npm install
cp .env.example .env.local   # optional
npm run dev                  # http://localhost:3000 (in-memory store when DATABASE_URL is empty)
npm run typecheck && npm test
```

## 7. Verification checklist after deploying

1. `/settings` → API keys → "בדיקת מפתח" confirms the AI and sports keys.
2. Trigger ingestion once: `curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/ingest` and inspect the JSON report (per-source errors show feed problems).
3. Trigger the digest: `…/api/cron/digest?force=1`.
4. `/api/ai-status` shows which credential source each integration uses (never the key).
