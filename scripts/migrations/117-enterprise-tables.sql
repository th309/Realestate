-- Migration 117: Enterprise Tables, RLS Policies, and Indexes
--
-- Adds enterprise capabilities to the PropertyIQ platform:
--   1. ALTER organizations — add enterprise-specific columns (owner, billing, API/embed flags)
--   2. organization_members — user-to-org membership with single-org enforcement
--   3. organization_invites — email invitations with token-based acceptance
--   4. organization_api_keys — hashed API keys with scopes and rate limits
--   5. organization_embed_tokens — embeddable widget tokens with origin restrictions
--   6. organization_audit_log — immutable audit trail for org actions
--   7. FK constraint on reports.organization_id → organizations(id)
--   8. RLS policies for all new tables
--   9. GRANT statements for service_role and authenticated
--  10. invite_org_member() — atomic seat-check-then-invite function
--
-- Idempotent: safe to re-run. Uses IF NOT EXISTS, DROP POLICY IF EXISTS,
-- CREATE OR REPLACE, and DO blocks with exception handlers.

BEGIN;

-- ============================================================================
-- SECTION 1: ALTER TABLE organizations — add enterprise columns
-- ============================================================================

-- owner_id: the auth.users row that owns this organization
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- accent_color: report branding accent (separate from primary/secondary)
-- NOTE: This column already exists in migration 030, but IF NOT EXISTS makes this safe.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#2563eb';

-- website_url: organization website
-- NOTE: This column already exists in migration 030, but IF NOT EXISTS makes this safe.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website_url TEXT;

-- seat_limit: maximum number of members (enterprise logic reads this, not max_users)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS seat_limit INT DEFAULT 10;

-- extra_seats: purchased add-on seats beyond seat_limit
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS extra_seats INT DEFAULT 0;

-- billing_status: Stripe subscription lifecycle state
-- Postgres doesn't support IF NOT EXISTS for CHECK constraints, so use exception handler
DO $$
BEGIN
  ALTER TABLE organizations ADD COLUMN billing_status TEXT DEFAULT 'pending'
    CHECK (billing_status IN ('pending', 'active', 'past_due', 'canceled'));
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- stripe_customer_id: Stripe customer reference for org-level billing
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- stripe_subscription_id: Stripe subscription reference for org-level billing
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- api_enabled: whether this org can create API keys
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS api_enabled BOOLEAN DEFAULT false;

-- embed_enabled: whether this org can create embed tokens
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS embed_enabled BOOLEAN DEFAULT false;

-- ============================================================================
-- SECTION 2: organization_members — user-to-org membership
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT now(),
  joined_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Single-org enforcement: a user can only be pending/active in ONE organization at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_single_org
  ON organization_members(user_id)
  WHERE status IN ('pending', 'active');

-- ============================================================================
-- SECTION 3: organization_invites — email-based invitations
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  token TEXT UNIQUE NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- SECTION 4: organization_api_keys — hashed API keys with scopes
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  rate_limit_rpm INT DEFAULT 60,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique hash lookup for active keys only (used during API auth)
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash
  ON organization_api_keys(key_hash)
  WHERE is_active = true;

-- ============================================================================
-- SECTION 5: organization_embed_tokens — widget embed tokens
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_embed_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  allowed_origins TEXT[] NOT NULL,
  widget_types TEXT[] NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Token lookup for active embed tokens only (used during embed auth)
CREATE INDEX IF NOT EXISTS idx_embed_tokens_token
  ON organization_embed_tokens(token)
  WHERE is_active = true;

-- ============================================================================
-- SECTION 6: organization_audit_log — immutable audit trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Primary query pattern: "show me audit events for org X, newest first"
CREATE INDEX IF NOT EXISTS idx_org_audit_org_created
  ON organization_audit_log(organization_id, created_at DESC);

-- ============================================================================
-- SECTION 7: Reports FK constraint (organization_id → organizations)
-- ============================================================================

-- reports.organization_id column exists since migration 030 but had no FK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_reports_organization'
  ) THEN
    ALTER TABLE reports
      ADD CONSTRAINT fk_reports_organization
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- SECTION 8: updated_at triggers for new tables with updated_at columns
-- ============================================================================

-- Reuse the update_updated_at_column() function from migration 030
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'organization_members',
            'organization_invites'
        ])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
            CREATE TRIGGER update_%I_updated_at
                BEFORE UPDATE ON %I
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        ', tbl, tbl, tbl, tbl);
    END LOOP;
END $$;

-- ============================================================================
-- SECTION 9: RLS Policies
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_embed_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_audit_log ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- organization_members policies
-- ---------------------------------------------------------------------------

-- SELECT: any active member of the same org can see the membership list
DROP POLICY IF EXISTS "Org members can view members" ON organization_members;
CREATE POLICY "Org members can view members" ON organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.status = 'active'
    )
  );

-- INSERT: only org admins can add members
DROP POLICY IF EXISTS "Org admins can insert members" ON organization_members;
CREATE POLICY "Org admins can insert members" ON organization_members
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role = 'admin' AND om.status = 'active'
    )
  );

-- UPDATE: only org admins can update members
DROP POLICY IF EXISTS "Org admins can update members" ON organization_members;
CREATE POLICY "Org admins can update members" ON organization_members
  FOR UPDATE USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role = 'admin' AND om.status = 'active'
    )
  );

-- DELETE: only org admins can remove members
DROP POLICY IF EXISTS "Org admins can delete members" ON organization_members;
CREATE POLICY "Org admins can delete members" ON organization_members
  FOR DELETE USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role = 'admin' AND om.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- organization_invites policies
-- ---------------------------------------------------------------------------

-- ALL operations: org admins can manage invites
DROP POLICY IF EXISTS "Org admins can manage invites" ON organization_invites;
CREATE POLICY "Org admins can manage invites" ON organization_invites
  FOR ALL USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role = 'admin' AND om.status = 'active'
    )
  );

-- SELECT: invitees can see their own invites (by email match)
DROP POLICY IF EXISTS "Invitees can view own invites" ON organization_invites;
CREATE POLICY "Invitees can view own invites" ON organization_invites
  FOR SELECT USING (
    email = auth.email()
  );

-- ---------------------------------------------------------------------------
-- organization_api_keys policies
-- ---------------------------------------------------------------------------

-- ALL operations: only org admins
DROP POLICY IF EXISTS "Org admins can manage api keys" ON organization_api_keys;
CREATE POLICY "Org admins can manage api keys" ON organization_api_keys
  FOR ALL USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role = 'admin' AND om.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- organization_embed_tokens policies
-- ---------------------------------------------------------------------------

-- ALL operations: only org admins
DROP POLICY IF EXISTS "Org admins can manage embed tokens" ON organization_embed_tokens;
CREATE POLICY "Org admins can manage embed tokens" ON organization_embed_tokens
  FOR ALL USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role = 'admin' AND om.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- organization_audit_log policies
-- ---------------------------------------------------------------------------

-- SELECT only: org admins can read audit logs (INSERT is service_role only)
DROP POLICY IF EXISTS "Org admins can view audit log" ON organization_audit_log;
CREATE POLICY "Org admins can view audit log" ON organization_audit_log
  FOR SELECT USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.role = 'admin' AND om.status = 'active'
    )
  );

-- ============================================================================
-- SECTION 10: GRANT statements
-- ============================================================================

-- service_role: full access to all enterprise tables (backend uses service_role)
GRANT ALL ON organization_members TO service_role;
GRANT ALL ON organization_invites TO service_role;
GRANT ALL ON organization_api_keys TO service_role;
GRANT ALL ON organization_embed_tokens TO service_role;
GRANT ALL ON organization_audit_log TO service_role;

-- authenticated: full CRUD on membership/invite tables (RLS enforces row-level access)
GRANT ALL ON organization_members TO authenticated;
GRANT ALL ON organization_invites TO authenticated;

-- authenticated: read-only on sensitive tables (RLS enforces admin-only access)
GRANT SELECT ON organization_api_keys TO authenticated;
GRANT SELECT ON organization_embed_tokens TO authenticated;
GRANT SELECT ON organization_audit_log TO authenticated;

-- ============================================================================
-- SECTION 11: invite_org_member() — atomic seat check + invite creation
-- ============================================================================

-- This function atomically checks seat limits (using FOR UPDATE to prevent races)
-- and creates an invite in a single transaction. Returns the new invite UUID.
-- Raises 'SEAT_LIMIT_REACHED' if the org has no remaining capacity.

CREATE OR REPLACE FUNCTION invite_org_member(
  p_org_id UUID,
  p_email TEXT,
  p_role TEXT,
  p_token TEXT,
  p_invited_by UUID,
  p_expires_at TIMESTAMPTZ
) RETURNS UUID AS $$
DECLARE
  v_seat_limit INT;
  v_extra_seats INT;
  v_active_count INT;
  v_pending_count INT;
  v_invite_id UUID;
BEGIN
  -- Lock the org row to prevent concurrent seat allocation races
  SELECT seat_limit, extra_seats INTO v_seat_limit, v_extra_seats
  FROM organizations WHERE id = p_org_id FOR UPDATE;

  -- Count current active members
  SELECT COUNT(*) INTO v_active_count
  FROM organization_members
  WHERE organization_id = p_org_id AND status = 'active';

  -- Count pending invites (not yet accepted/expired/revoked)
  SELECT COUNT(*) INTO v_pending_count
  FROM organization_invites
  WHERE organization_id = p_org_id AND status = 'pending';

  -- Enforce seat limit: active members + pending invites must not exceed capacity
  IF v_active_count + v_pending_count >= v_seat_limit + v_extra_seats THEN
    RAISE EXCEPTION 'SEAT_LIMIT_REACHED';
  END IF;

  -- Create the invite
  INSERT INTO organization_invites (organization_id, email, role, token, invited_by, expires_at)
  VALUES (p_org_id, p_email, p_role, p_token, p_invited_by, p_expires_at)
  RETURNING id INTO v_invite_id;

  RETURN v_invite_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 117 completed: Enterprise tables, RLS policies, indexes, and invite_org_member() function created';
END $$;
