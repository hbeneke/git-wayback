CREATE TABLE "evolution_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"snapshots" jsonb NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"tag_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repo_visits" (
	"visitor_id" text NOT NULL,
	"repo_full_name" text NOT NULL,
	"repo_avatar" text,
	"visit_day" date DEFAULT CURRENT_DATE NOT NULL,
	"visited_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_visitor_repo_day" UNIQUE("visitor_id","repo_full_name","visit_day")
);
--> statement-breakpoint
CREATE INDEX "idx_repo_visits_visit_day" ON "repo_visits" USING btree ("visit_day");--> statement-breakpoint
CREATE INDEX "idx_repo_visits_repo" ON "repo_visits" USING btree ("repo_full_name");