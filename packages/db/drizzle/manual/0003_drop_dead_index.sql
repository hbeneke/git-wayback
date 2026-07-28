-- Manual migration — drop the unused evolution index.
--
-- Every read of evolution_snapshots is a primary-key lookup on `id` (the full
-- cache key). The (owner, name) index was never consulted by any query and
-- only cost write throughput.
--
-- Already absent from the 0000 baseline, so this is only needed on databases
-- provisioned before the rebaseline. Idempotent.

DROP INDEX IF EXISTS "evolution_owner_name_idx";
