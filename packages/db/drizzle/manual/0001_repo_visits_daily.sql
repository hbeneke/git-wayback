-- Manual migration — Task 2: per-day visit dedup.
--
-- WHY MANUAL: drizzle migration history is drifted. Snapshot 0000 predates
-- repo_visits/evolution_snapshots (those were applied via `db:push`), so
-- `drizzle-kit generate` misdiagnoses repo_visits as a new/renamed table.
-- This file is the reviewed DDL to apply by hand against Neon (or via the
-- existing `db:push` workflow once Task 4 removes the dead schemas).
--
-- Idempotent. Safe to re-run.

-- 1. Day bucket column. Default CURRENT_DATE so the ALTER does not fail on
--    existing rows.
ALTER TABLE "repo_visits"
  ADD COLUMN IF NOT EXISTS "visit_day" date NOT NULL DEFAULT CURRENT_DATE;

-- 2. Backfill historical rows from their original timestamp so old visits
--    keep their real day instead of "today".
UPDATE "repo_visits" SET "visit_day" = "visited_at"::date;

-- 3. Swap the unique constraint: drop the global (visitor, repo) — which
--    capped a visitor to ONE row per repo forever — for per-day uniqueness.
--    Existing rows are 1-per-(visitor,repo) with distinct backfilled days,
--    so no conflict adding the new constraint.
ALTER TABLE "repo_visits" DROP CONSTRAINT IF EXISTS "unique_visitor_repo";
ALTER TABLE "repo_visits"
  ADD CONSTRAINT "unique_visitor_repo_day"
  UNIQUE ("visitor_id", "repo_full_name", "visit_day");

-- 4. Swap the window index onto the column the ranking queries now filter on.
DROP INDEX IF EXISTS "idx_repo_visits_visited_at";
CREATE INDEX IF NOT EXISTS "idx_repo_visits_visit_day"
  ON "repo_visits" ("visit_day");
