-- Content pipeline Phase 8: one style-preferences row per brand.
--
-- collections_preferences was created in 20260725171557 with only a non-unique
-- index on brand_id. Phase 8 (StylePreferenceService) treats it as exactly one
-- row per brand — the brand's saved style references plus its signal weight —
-- so two concurrent cold starts must not be able to split a brand's likes
-- across two rows.
--
-- Deduplicate first (keeping the earliest row, which is the one the service
-- reads), then add the unique index. Idempotent and safe on an empty table,
-- which is what every environment has today: the table had zero consumers
-- before this phase.

DELETE FROM collections_preferences a
USING collections_preferences b
WHERE a.brand_id = b.brand_id
  AND (a.created_at, a.id) > (b.created_at, b.id);

CREATE UNIQUE INDEX IF NOT EXISTS collections_preferences_brand_id_key
  ON collections_preferences (brand_id);

-- The original non-unique index is now redundant (the unique index serves the
-- same lookups) but harmless; left in place so this migration stays additive.
