-- Dedupe deal_analyses to one row per (owner_id, address_full).
--
-- The Analyzer's Share/PDF/Notes-save actions each independently INSERTed a
-- new row with no identity key, so repeat saves of the same property in one
-- sitting produced multiple rows (observed: one address saved 8x in 90
-- minutes, another 5x in 10 minutes). A handful of rows also have no
-- resolved address at all (address_full IS NULL), which rendered as a bare
-- ", " in the saved-analyses list.
--
-- This is a one-time cleanup followed by a constraint so
-- AnalyzerPersistenceService.save() can upsert by (owner_id, address_full)
-- going forward instead of blind-inserting.

-- 1. Rows with no resolved address have nothing usable to key on or display.
DELETE FROM deal_analyses WHERE address_full IS NULL;

-- 2. Collapse existing duplicate (owner_id, address_full) groups down to the
--    most recently updated row per group.
DELETE FROM deal_analyses d
USING deal_analyses newer
WHERE d.owner_id = newer.owner_id
  AND d.address_full = newer.address_full
  AND (
    d.updated_at < newer.updated_at
    OR (d.updated_at = newer.updated_at AND d.created_at < newer.created_at)
    OR (d.updated_at = newer.updated_at AND d.created_at = newer.created_at AND d.id < newer.id)
  );

-- 3. Enforce going forward.
ALTER TABLE deal_analyses ALTER COLUMN address_full SET NOT NULL;
ALTER TABLE deal_analyses ADD CONSTRAINT deal_analyses_owner_address_unique UNIQUE (owner_id, address_full);
