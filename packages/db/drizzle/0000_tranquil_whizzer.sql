CREATE TYPE "public"."analysis_status" AS ENUM('pending', 'cloning', 'analyzing', 'screenshots', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "branches" (
	"repository_id" text NOT NULL,
	"name" text NOT NULL,
	"sha" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "branches_repository_id_name_pk" PRIMARY KEY("repository_id","name")
);
--> statement-breakpoint
CREATE TABLE "commit_parents" (
	"commit_sha" text NOT NULL,
	"parent_sha" text NOT NULL,
	CONSTRAINT "commit_parents_commit_sha_parent_sha_pk" PRIMARY KEY("commit_sha","parent_sha")
);
--> statement-breakpoint
CREATE TABLE "commits" (
	"sha" text PRIMARY KEY NOT NULL,
	"repository_id" text NOT NULL,
	"message" text NOT NULL,
	"author_name" text NOT NULL,
	"author_email" text NOT NULL,
	"author_date" timestamp NOT NULL,
	"committer_name" text NOT NULL,
	"committer_email" text NOT NULL,
	"committer_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evolution_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"repository_id" text,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"snapshots" jsonb NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"tag_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"description" text,
	"default_branch" text DEFAULT 'main' NOT NULL,
	"last_github_sha" text,
	"last_analyzed_sha" text,
	"status" "analysis_status" DEFAULT 'pending' NOT NULL,
	"analysis_progress" integer DEFAULT 0 NOT NULL,
	"stars_count" integer DEFAULT 0 NOT NULL,
	"forks_count" integer DEFAULT 0 NOT NULL,
	"basic_data" jsonb,
	"deep_analysis" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "repositories_full_name_unique" UNIQUE("full_name")
);
--> statement-breakpoint
CREATE TABLE "screenshots" (
	"id" text PRIMARY KEY NOT NULL,
	"repository_id" text NOT NULL,
	"commit_sha" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commit_parents" ADD CONSTRAINT "commit_parents_commit_sha_commits_sha_fk" FOREIGN KEY ("commit_sha") REFERENCES "public"."commits"("sha") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commits" ADD CONSTRAINT "commits_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evolution_snapshots" ADD CONSTRAINT "evolution_snapshots_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evolution_owner_name_idx" ON "evolution_snapshots" USING btree ("owner","name");