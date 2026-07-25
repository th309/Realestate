-- Unique constraint on brands.name so BrandKitService.ensurePropertyIqBrand can
-- seed via an atomic upsert (INSERT ... ON CONFLICT (name) DO NOTHING) instead of
-- a check-then-insert that could race two concurrent cold starts into duplicate
-- 'PropertyIQ' rows. Idempotent; safe because brands has no duplicate names.

CREATE UNIQUE INDEX IF NOT EXISTS uq_brands_name ON brands (name);
