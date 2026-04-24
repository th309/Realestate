-- Migration: Add tier column to organizations
-- Backs the read-through entitlement resolver (see design doc
-- 2026-04-24-entitlement-inheritance-and-mcp-cache-design.md, section 3.2).
--
-- Today the only paid org plan is Enterprise, so the default is 'enterprise'
-- and the CHECK constraint is tight. When a second paid org plan lands,
-- relax the CHECK and update writers (organizations.service.ts, any future
-- Stripe-price-to-tier mapper).
--
-- Idempotent: safe to re-run. Uses IF NOT EXISTS and a DO-block with a
-- duplicate_object guard on the CHECK constraint.

BEGIN;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'enterprise';

DO $$
BEGIN
  ALTER TABLE organizations
    ADD CONSTRAINT organizations_tier_check CHECK (tier IN ('enterprise'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE 'Migration complete: organizations.tier column added with default enterprise';
END $$;
