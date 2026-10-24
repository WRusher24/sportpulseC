CREATE TYPE "public"."article_category" AS ENUM('football_israel', 'football_world', 'basketball_israel', 'basketball_world', 'transfers', 'other');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('goal', 'card', 'substitution', 'var');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'first_half', 'half_time', 'second_half', 'extra_time', 'finished', 'postponed');--> statement-breakpoint
CREATE TYPE "public"."sport_type" AS ENUM('football', 'basketball');--> statement-breakpoint
CREATE TYPE "public"."theme_preference" AS ENUM('dark', 'light', 'pitch', 'night');--> statement-breakpoint
CREATE TYPE "public"."vibe_vote" AS ENUM('optimistic', 'worried');--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"master_thread_id" uuid,
	"original_title" text NOT NULL,
	"cleaned_neutral_title" text,
	"full_text" text DEFAULT '' NOT NULL,
	"summary_tldr" text,
	"source_key" text NOT NULL,
	"source_name" text NOT NULL,
	"source_url" text NOT NULL,
	"original_image_url" text,
	"author" text,
	"published_at" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"category" "article_category" DEFAULT 'other' NOT NULL,
	"team_id" text,
	"clickbait_score" smallint DEFAULT 0 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" text NOT NULL,
	"digest_date" text NOT NULL,
	"content_he" text NOT NULL,
	"generated_by" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fan_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"player_name" text NOT NULL,
	"rating" smallint NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fan_ratings_range" CHECK ("fan_ratings"."rating" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "ingest_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"fetched" integer DEFAULT 0 NOT NULL,
	"inserted" integer DEFAULT 0 NOT NULL,
	"report" jsonb
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" text PRIMARY KEY NOT NULL,
	"name_he" text NOT NULL,
	"name_en" text NOT NULL,
	"country" text NOT NULL,
	"logo_url" text,
	"sport_type" "sport_type" NOT NULL,
	"season" text NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"api_football_id" integer,
	"api_basketball_id" integer,
	"sportmonks_id" integer,
	"last_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "master_story_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"primary_title_he" text NOT NULL,
	"ai_vibe_score" smallint,
	"vibe_worried_score" smallint,
	"team_id" text,
	"signature" text DEFAULT '' NOT NULL,
	"category" "article_category" DEFAULT 'other' NOT NULL,
	"hero_image_url" text,
	"article_count" integer DEFAULT 1 NOT NULL,
	"last_published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "threads_vibe_range" CHECK ("master_story_threads"."ai_vibe_score" is null or ("master_story_threads"."ai_vibe_score" between 0 and 100))
);
--> statement-breakpoint
CREATE TABLE "match_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" text NOT NULL,
	"minute" smallint NOT NULL,
	"team_id" text,
	"event_type" "event_type" NOT NULL,
	"player_name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" text PRIMARY KEY NOT NULL,
	"league_id" text NOT NULL,
	"home_team_id" text NOT NULL,
	"away_team_id" text NOT NULL,
	"home_score" smallint,
	"away_score" smallint,
	"status" "match_status" DEFAULT 'scheduled' NOT NULL,
	"minute" smallint,
	"match_timestamp" timestamp with time zone NOT NULL,
	"venue" text,
	"round" text,
	"stats_json" jsonb,
	"line_ups_json" jsonb,
	"external_id" text,
	"is_demo" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standings" (
	"league_id" text NOT NULL,
	"team_id" text NOT NULL,
	"played" smallint DEFAULT 0 NOT NULL,
	"wins" smallint DEFAULT 0 NOT NULL,
	"draws" smallint DEFAULT 0 NOT NULL,
	"losses" smallint DEFAULT 0 NOT NULL,
	"goals_for" integer DEFAULT 0 NOT NULL,
	"goals_against" integer DEFAULT 0 NOT NULL,
	"points" smallint DEFAULT 0 NOT NULL,
	"form" text DEFAULT '' NOT NULL,
	"xg_for" real,
	"xg_against" real,
	"is_demo" boolean DEFAULT false NOT NULL,
	CONSTRAINT "standings_league_id_team_id_pk" PRIMARY KEY("league_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"name_he" text NOT NULL,
	"name_en" text NOT NULL,
	"logo_url" text,
	"league_id" text NOT NULL,
	"sport_type" "sport_type" NOT NULL,
	"venue" text,
	"city" text,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"primary_color" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"favorite_team_id" text,
	"theme_preference" "theme_preference" DEFAULT 'dark' NOT NULL,
	"custom_api_keys_json" text,
	"notification_prefs_json" jsonb DEFAULT '{"goals":true,"kickoff":true,"finalWhistle":true,"breakingNews":true,"digest":true}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vibe_votes" (
	"thread_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"vote" "vibe_vote" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vibe_votes_thread_id_user_id_pk" PRIMARY KEY("thread_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_master_thread_id_master_story_threads_id_fk" FOREIGN KEY ("master_thread_id") REFERENCES "public"."master_story_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digests" ADD CONSTRAINT "digests_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_ratings" ADD CONSTRAINT "fan_ratings_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fan_ratings" ADD CONSTRAINT "fan_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_story_threads" ADD CONSTRAINT "master_story_threads_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings" ADD CONSTRAINT "standings_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings" ADD CONSTRAINT "standings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_favorite_team_id_teams_id_fk" FOREIGN KEY ("favorite_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vibe_votes" ADD CONSTRAINT "vibe_votes_thread_id_master_story_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."master_story_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vibe_votes" ADD CONSTRAINT "vibe_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "articles_source_url_uq" ON "articles" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "articles_thread_idx" ON "articles" USING btree ("master_thread_id");--> statement-breakpoint
CREATE INDEX "articles_published_idx" ON "articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "articles_team_idx" ON "articles" USING btree ("team_id","published_at");--> statement-breakpoint
CREATE INDEX "articles_category_idx" ON "articles" USING btree ("category","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "digests_team_day_uq" ON "digests" USING btree ("team_id","digest_date");--> statement-breakpoint
CREATE UNIQUE INDEX "fan_ratings_uq" ON "fan_ratings" USING btree ("match_id","user_id","player_name");--> statement-breakpoint
CREATE INDEX "fan_ratings_match_idx" ON "fan_ratings" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "leagues_sport_idx" ON "leagues" USING btree ("sport_type","sort_order");--> statement-breakpoint
CREATE INDEX "threads_recent_idx" ON "master_story_threads" USING btree ("last_published_at");--> statement-breakpoint
CREATE INDEX "threads_team_idx" ON "master_story_threads" USING btree ("team_id","last_published_at");--> statement-breakpoint
CREATE INDEX "events_match_idx" ON "match_events" USING btree ("match_id","minute");--> statement-breakpoint
CREATE INDEX "matches_league_time_idx" ON "matches" USING btree ("league_id","match_timestamp");--> statement-breakpoint
CREATE INDEX "matches_time_idx" ON "matches" USING btree ("match_timestamp");--> statement-breakpoint
CREATE INDEX "matches_status_idx" ON "matches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "matches_home_idx" ON "matches" USING btree ("home_team_id");--> statement-breakpoint
CREATE INDEX "matches_away_idx" ON "matches" USING btree ("away_team_id");--> statement-breakpoint
CREATE INDEX "standings_points_idx" ON "standings" USING btree ("league_id","points");--> statement-breakpoint
CREATE INDEX "teams_league_idx" ON "teams" USING btree ("league_id");--> statement-breakpoint
CREATE INDEX "teams_name_en_idx" ON "teams" USING btree ("name_en");--> statement-breakpoint
CREATE INDEX "teams_name_he_idx" ON "teams" USING btree ("name_he");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");