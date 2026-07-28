-- Manual migration — remove the raw IPs already stored in repo_visits.
--
-- visitor_id used to hold the client IP verbatim, so every historical row is
-- personal data kept indefinitely. New rows are hashed by the application; this
-- one-way pass covers the rows written before that.
--
-- md5(visitor_id || visit_day) stays injective per (visitor, day), so the
-- unique (visitor_id, repo_full_name, visit_day) constraint still holds and no
-- ranking count changes. Data-only, no DDL.
--
-- NOT idempotent in the sense of matching the application's hash — it only
-- needs to run once, and re-running merely rehashes an already opaque value.
-- Guarded so it skips rows that are already 32-char hex.

UPDATE "repo_visits"
SET "visitor_id" = md5("visitor_id" || "visit_day"::text)
WHERE "visitor_id" !~ '^[0-9a-f]{32}$';
