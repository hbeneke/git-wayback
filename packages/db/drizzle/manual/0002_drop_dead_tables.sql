-- Manual migration — Task 4: drop abandoned schema.
--
-- SUPERSEDED: folded into the 0000 baseline. Kept as a record of what was
-- applied by hand; see ../../README.md. Do not run on a new database.
--
-- WHY MANUAL (at the time): drizzle history was drifted (see manual/0001).
-- Apply by hand against Neon, or via `db:push`. Do NOT use `drizzle-kit
-- generate`.
--
-- DESTRUCTIVE: drops tables that the app no longer reads or writes
-- (clone/analysis architecture was replaced by the GitHub API). Confirm there
-- is no data worth keeping before running. Idempotent.

-- evolution_snapshots no longer references repositories.
ALTER TABLE "evolution_snapshots"
  DROP CONSTRAINT IF EXISTS "evolution_snapshots_repository_id_repositories_id_fk";
ALTER TABLE "evolution_snapshots" DROP COLUMN IF EXISTS "repository_id";

-- Dead tables (CASCADE clears their FKs in one shot).
DROP TABLE IF EXISTS "branches" CASCADE;
DROP TABLE IF EXISTS "commit_parents" CASCADE;
DROP TABLE IF EXISTS "commits" CASCADE;
DROP TABLE IF EXISTS "screenshots" CASCADE;
DROP TABLE IF EXISTS "repositories" CASCADE;

-- Enum only used by the dropped repositories.status column.
DROP TYPE IF EXISTS "analysis_status";
