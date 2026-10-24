# SportPulse Israel – ספורט פאלס

Hebrew RTL mobile-first Israeli sports aggregator: multi-source news ingestion, AI story clustering and anti-clickbait titles, live match center, fan ratings and an AI analyst.

Stack: Next.js 16 (App Router, Server Actions), Tailwind CSS 3 (logical properties), Drizzle ORM + Neon PostgreSQL, Vercel Cron, OpenAI / Anthropic via runtime-overridable keys, API-Football / Sportmonks adapters.

* Deploy: see [DEPLOYS_GUIDE.md](DEPLOYS_GUIDE.md)
* Use: see [USER_GUIDE.md](USER_GUIDE.md)
* Scripts: `npm run dev | build | typecheck | test | db:generate | db:migrate | db:seed`

Structure: `app/` routes and API, `components/` UI, `lib/` (ai, ingest, sports, analytics, data, server), `db/` schema and seed, `drizzle/` SQL migrations, `tests/`.
