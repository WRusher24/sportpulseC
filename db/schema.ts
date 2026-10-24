import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  check
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ enums */

export const sportTypeEnum = pgEnum("sport_type", ["football", "basketball"]);
export const themeEnum = pgEnum("theme_preference", ["dark", "light", "pitch", "night"]);
export const matchStatusEnum = pgEnum("match_status", [
  "scheduled",
  "first_half",
  "half_time",
  "second_half",
  "extra_time",
  "finished",
  "postponed"
]);
export const eventTypeEnum = pgEnum("event_type", ["goal", "card", "substitution", "var"]);
export const articleCategoryEnum = pgEnum("article_category", [
  "football_israel",
  "football_world",
  "basketball_israel",
  "basketball_world",
  "transfers",
  "other"
]);
export const voteEnum = pgEnum("vibe_vote", ["optimistic", "worried"]);

/* ------------------------------------------------------------------ core */

export const leagues = pgTable(
  "leagues",
  {
    id: text("id").primaryKey(),
    nameHe: text("name_he").notNull(),
    nameEn: text("name_en").notNull(),
    country: text("country").notNull(),
    logoUrl: text("logo_url"),
    sportType: sportTypeEnum("sport_type").notNull(),
    season: text("season").notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
    /** External provider ids; null when the provider has no (verified) id for the competition. */
    apiFootballId: integer("api_football_id"),
    apiBasketballId: integer("api_basketball_id"),
    sportmonksId: integer("sportmonks_id"),
    /** Last successful provider sync (fixtures + standings). */
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true })
  },
  (t) => [index("leagues_sport_idx").on(t.sportType, t.sortOrder)]
);

export const teams = pgTable(
  "teams",
  {
    id: text("id").primaryKey(),
    nameHe: text("name_he").notNull(),
    nameEn: text("name_en").notNull(),
    logoUrl: text("logo_url"),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "restrict" }),
    sportType: sportTypeEnum("sport_type").notNull(),
    venue: text("venue"),
    city: text("city"),
    /** Alternative spellings (Hebrew + English) used for search and for provider/article matching. */
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
    primaryColor: text("primary_color")
  },
  (t) => [
    index("teams_league_idx").on(t.leagueId),
    index("teams_name_en_idx").on(t.nameEn),
    index("teams_name_he_idx").on(t.nameHe)
  ]
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    favoriteTeamId: text("favorite_team_id").references(() => teams.id, { onDelete: "set null" }),
    themePreference: themeEnum("theme_preference").notNull().default("dark"),
    /** AES-256-GCM envelope (server-side encrypted). Never contains plaintext keys. */
    customApiKeysJson: text("custom_api_keys_json"),
    notificationPrefsJson: jsonb("notification_prefs_json")
      .$type<NotificationPrefs>()
      .notNull()
      .default(sql`'{"goals":true,"kickoff":true,"finalWhistle":true,"breakingNews":true,"digest":true}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)]
);

export type NotificationPrefs = {
  goals: boolean;
  kickoff: boolean;
  finalWhistle: boolean;
  breakingNews: boolean;
  digest: boolean;
};

/* ------------------------------------------------------------------ news */

export const masterStoryThreads = pgTable(
  "master_story_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    primaryTitleHe: text("primary_title_he").notNull(),
    /** Percentage (0-100) of optimistic sentiment. Null until analysed. */
    aiVibeScore: smallint("ai_vibe_score"),
    vibeWorriedScore: smallint("vibe_worried_score"),
    teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
    /** Space separated normalized tokens used by the clustering engine. */
    signature: text("signature").notNull().default(""),
    category: articleCategoryEnum("category").notNull().default("other"),
    heroImageUrl: text("hero_image_url"),
    articleCount: integer("article_count").notNull().default(1),
    lastPublishedAt: timestamp("last_published_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("threads_recent_idx").on(t.lastPublishedAt),
    index("threads_team_idx").on(t.teamId, t.lastPublishedAt),
    check("threads_vibe_range", sql`${t.aiVibeScore} is null or (${t.aiVibeScore} between 0 and 100)`)
  ]
);

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    masterThreadId: uuid("master_thread_id").references(() => masterStoryThreads.id, { onDelete: "set null" }),
    originalTitle: text("original_title").notNull(),
    cleanedNeutralTitle: text("cleaned_neutral_title"),
    fullText: text("full_text").notNull().default(""),
    summaryTldr: text("summary_tldr"),
    sourceKey: text("source_key").notNull(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url").notNull(),
    originalImageUrl: text("original_image_url"),
    author: text("author"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
    category: articleCategoryEnum("category").notNull().default("other"),
    teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
    /** 1 when the title was rewritten by the anti-clickbait engine. */
    clickbaitScore: smallint("clickbait_score").notNull().default(0),
    isDemo: boolean("is_demo").notNull().default(false)
  },
  (t) => [
    uniqueIndex("articles_source_url_uq").on(t.sourceUrl),
    index("articles_thread_idx").on(t.masterThreadId),
    index("articles_published_idx").on(t.publishedAt),
    index("articles_team_idx").on(t.teamId, t.publishedAt),
    index("articles_category_idx").on(t.category, t.publishedAt)
  ]
);

export const vibeVotes = pgTable(
  "vibe_votes",
  {
    threadId: uuid("thread_id")
      .notNull()
      .references(() => masterStoryThreads.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vote: voteEnum("vote").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [primaryKey({ columns: [t.threadId, t.userId] })]
);

export const digests = pgTable(
  "digests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    /** Israel-local calendar day (YYYY-MM-DD). */
    digestDate: text("digest_date").notNull(),
    contentHe: text("content_he").notNull(),
    generatedBy: text("generated_by").notNull().default("system"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex("digests_team_day_uq").on(t.teamId, t.digestDate)]
);

export const ingestRuns = pgTable("ingest_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  fetched: integer("fetched").notNull().default(0),
  inserted: integer("inserted").notNull().default(0),
  report: jsonb("report").$type<Record<string, unknown>>()
});

/* ------------------------------------------------------------------ match centre */

export type MatchStats = Partial<
  Record<
    | "possession"
    | "shots"
    | "shotsOnTarget"
    | "corners"
    | "offsides"
    | "fouls"
    | "passAccuracy"
    | "xg"
    | "fgPct"
    | "threePct"
    | "rebounds"
    | "assists"
    | "turnovers"
    | "steals",
    [number, number]
  >
>;

export type LineupPlayer = { name: string; number: number | null; position: string | null; starter: boolean };
export type LineUps = {
  home: { formation: string | null; coach: string | null; players: LineupPlayer[] };
  away: { formation: string | null; coach: string | null; players: LineupPlayer[] };
  mediaGrades?: Record<string, number>;
};

export const matches = pgTable(
  "matches",
  {
    id: text("id").primaryKey(),
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    homeTeamId: text("home_team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    awayTeamId: text("away_team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    homeScore: smallint("home_score"),
    awayScore: smallint("away_score"),
    status: matchStatusEnum("status").notNull().default("scheduled"),
    minute: smallint("minute"),
    matchTimestamp: timestamp("match_timestamp", { withTimezone: true }).notNull(),
    venue: text("venue"),
    round: text("round"),
    statsJson: jsonb("stats_json").$type<MatchStats>(),
    lineUpsJson: jsonb("line_ups_json").$type<LineUps>(),
    externalId: text("external_id"),
    /** true while the row still carries the bundled baseline data (replaced by provider sync). */
    isDemo: boolean("is_demo").notNull().default(false)
  },
  (t) => [
    index("matches_league_time_idx").on(t.leagueId, t.matchTimestamp),
    index("matches_time_idx").on(t.matchTimestamp),
    index("matches_status_idx").on(t.status),
    index("matches_home_idx").on(t.homeTeamId),
    index("matches_away_idx").on(t.awayTeamId)
  ]
);

export const matchEvents = pgTable(
  "match_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    minute: smallint("minute").notNull(),
    teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
    eventType: eventTypeEnum("event_type").notNull(),
    playerName: text("player_name").notNull(),
    description: text("description")
  },
  (t) => [index("events_match_idx").on(t.matchId, t.minute)]
);

export const standings = pgTable(
  "standings",
  {
    leagueId: text("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    played: smallint("played").notNull().default(0),
    wins: smallint("wins").notNull().default(0),
    draws: smallint("draws").notNull().default(0),
    losses: smallint("losses").notNull().default(0),
    goalsFor: integer("goals_for").notNull().default(0),
    goalsAgainst: integer("goals_against").notNull().default(0),
    points: smallint("points").notNull().default(0),
    /** Most recent result last, e.g. "WDLWW". */
    form: text("form").notNull().default(""),
    xgFor: real("xg_for"),
    xgAgainst: real("xg_against"),
    isDemo: boolean("is_demo").notNull().default(false)
  },
  (t) => [primaryKey({ columns: [t.leagueId, t.teamId] }), index("standings_points_idx").on(t.leagueId, t.points)]
);

export const fanRatings = pgTable(
  "fan_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: text("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    playerName: text("player_name").notNull(),
    rating: smallint("rating").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("fan_ratings_uq").on(t.matchId, t.userId, t.playerName),
    index("fan_ratings_match_idx").on(t.matchId),
    check("fan_ratings_range", sql`${t.rating} between 1 and 10`)
  ]
);

/* ------------------------------------------------------------------ relations */

export const leaguesRelations = relations(leagues, ({ many }) => ({
  teams: many(teams),
  matches: many(matches),
  standings: many(standings)
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  league: one(leagues, { fields: [teams.leagueId], references: [leagues.id] }),
  fans: many(users),
  articles: many(articles)
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  favoriteTeam: one(teams, { fields: [users.favoriteTeamId], references: [teams.id] }),
  ratings: many(fanRatings),
  votes: many(vibeVotes)
}));

export const threadsRelations = relations(masterStoryThreads, ({ one, many }) => ({
  team: one(teams, { fields: [masterStoryThreads.teamId], references: [teams.id] }),
  articles: many(articles),
  votes: many(vibeVotes)
}));

export const articlesRelations = relations(articles, ({ one }) => ({
  thread: one(masterStoryThreads, { fields: [articles.masterThreadId], references: [masterStoryThreads.id] }),
  team: one(teams, { fields: [articles.teamId], references: [teams.id] })
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  league: one(leagues, { fields: [matches.leagueId], references: [leagues.id] }),
  home: one(teams, { fields: [matches.homeTeamId], references: [teams.id], relationName: "home" }),
  away: one(teams, { fields: [matches.awayTeamId], references: [teams.id], relationName: "away" }),
  events: many(matchEvents),
  ratings: many(fanRatings)
}));

export const matchEventsRelations = relations(matchEvents, ({ one }) => ({
  match: one(matches, { fields: [matchEvents.matchId], references: [matches.id] }),
  team: one(teams, { fields: [matchEvents.teamId], references: [teams.id] })
}));

export const standingsRelations = relations(standings, ({ one }) => ({
  league: one(leagues, { fields: [standings.leagueId], references: [leagues.id] }),
  team: one(teams, { fields: [standings.teamId], references: [teams.id] })
}));

export const fanRatingsRelations = relations(fanRatings, ({ one }) => ({
  match: one(matches, { fields: [fanRatings.matchId], references: [matches.id] }),
  user: one(users, { fields: [fanRatings.userId], references: [users.id] })
}));

export const vibeVotesRelations = relations(vibeVotes, ({ one }) => ({
  thread: one(masterStoryThreads, { fields: [vibeVotes.threadId], references: [masterStoryThreads.id] }),
  user: one(users, { fields: [vibeVotes.userId], references: [users.id] })
}));

export type League = typeof leagues.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type User = typeof users.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type Thread = typeof masterStoryThreads.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchEvent = typeof matchEvents.$inferSelect;
export type Standing = typeof standings.$inferSelect;
export type FanRating = typeof fanRatings.$inferSelect;
export type Digest = typeof digests.$inferSelect;
