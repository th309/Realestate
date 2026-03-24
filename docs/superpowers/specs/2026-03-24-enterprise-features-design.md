# Enterprise Features Design Spec

**Date:** 2026-03-24
**Status:** Approved
**Author:** Troy

---

## Overview

Add a complete enterprise layer to PropertyIQ targeting brokerages and real estate teams (5-50 agents). Enterprise orgs get a self-serve admin portal, report-level branding, embeddable widgets, a full platform API, and per-seat billing via Stripe.

### Primary Customer

Brokerage or real estate team where a team lead/broker manages seats and agents share data. Secondary future use case: data/analytics companies embedding PropertyIQ via API + widgets.

### Architecture

Monolith extension (Approach A). All enterprise features are added as new NestJS modules and Next.js routes within the existing codebase. No new services or infrastructure.

### Key Decisions Summary

| Decision     | Choice                                                                              | Rationale                                                                         |
| ------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Architecture | Monolith extension                                                                  | Single developer, existing Railway infra, NestJS modules provide clean separation |
| Roles        | Admin + Member (2 roles)                                                            | Simplicity; sufficient for brokerage use case                                     |
| White-label  | Report-level branding + embeddable widgets                                          | High impact, avoids full UI theming complexity                                    |
| API          | Full platform API (scores, metrics, reports, watchlist, time-series, rankings)      | Enables CRM/dashboard integrations and future reseller model                      |
| Billing      | Flat enterprise + 10 seats included, extra seats at 1/10th price, billed at sign-up | Clean model, auto-renews, Stripe handles payment lifecycle                        |
| Embeds       | Score rings + metric cards + interactive map (iframe-only, no JS SDK in V1)         | Full widget kit; JS SDK deferred                                                  |
| Testing      | Live data only — real Supabase, Stripe test mode, real Redis                        | No mocks; catches RLS gaps, webhook race conditions, CORS issues                  |

---

## Section 1: Data Model

### Organizations Table (extend existing)

The `organizations` table already exists (migration 030, lines 547-567) with columns including `primary_color`, `secondary_color`, `contact_email`, `custom_domain`, `subscription_tier`, `subscription_status`, `max_users`, etc. We extend it with enterprise-specific columns via ALTER TABLE.

**Migration SQL:**

```sql
-- Extend existing organizations table for enterprise features
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#2563eb',
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS seat_limit INT DEFAULT 10,
  ADD COLUMN IF NOT EXISTS extra_seats INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'pending'
    CHECK (billing_status IN ('pending', 'active', 'past_due', 'canceled')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS api_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS embed_enabled BOOLEAN DEFAULT false;

-- Reconcile with existing columns:
-- max_users (existing) → seat_limit (new): seat_limit is the enterprise concept.
--   max_users remains for legacy/non-enterprise orgs. Enterprise logic reads seat_limit.
-- subscription_status (existing) → billing_status (new): billing_status is enterprise-specific.
--   subscription_status remains for individual user tier tracking.
-- primary_color (existing) → accent_color (new): accent_color is for report branding.
--   primary_color remains for any future full UI theming.
-- logo_url already exists on the table — no ALTER needed.

-- Transfer ownership endpoint required: PUT /api/org/:slug/transfer-ownership
-- owner_id is nullable with ON DELETE SET NULL so that if the owner deletes their
-- account, the org survives. A new admin must be promoted to owner.
```

**Target schema after migration (enterprise-relevant columns):**

```
organizations
  id, name, slug                      -- existing
  owner_id        UUID (nullable, FK → auth.users ON DELETE SET NULL)
  logo_url        TEXT                -- existing
  accent_color    TEXT DEFAULT '#2563eb'
  website_url     TEXT
  seat_limit      INT DEFAULT 10
  extra_seats     INT DEFAULT 0
  billing_status  TEXT DEFAULT 'pending'
  stripe_customer_id      TEXT
  stripe_subscription_id  TEXT
  api_enabled     BOOLEAN DEFAULT false
  embed_enabled   BOOLEAN DEFAULT false
  created_at, updated_at              -- existing
```

### Organization Members Table (new)

```sql
CREATE TABLE organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  invited_by      UUID REFERENCES auth.users(id),
  invited_at      TIMESTAMPTZ DEFAULT now(),
  joined_at       TIMESTAMPTZ,           -- null until invite accepted
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- V1: Single-org membership only. Prevents a user from joining multiple orgs.
-- Remove this constraint when multi-org support is added.
CREATE UNIQUE INDEX idx_org_members_single_org ON organization_members(user_id)
  WHERE status IN ('pending', 'active');
```

**Note on member removal:** Removing a member is a hard DELETE, not a soft delete. The audit log captures the removal event with full context (who was removed, by whom, when). This avoids the unique constraint conflict where re-inviting a removed member would fail. The `'suspended'` status is for temporary lockouts (e.g., billing past-due), not removal.

### Organization Invites Table (new)

```sql
CREATE TABLE organization_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  token           TEXT UNIQUE NOT NULL,
  invited_by      UUID REFERENCES auth.users(id),
  expires_at      TIMESTAMPTZ NOT NULL,  -- 7 days from creation
  accepted_at     TIMESTAMPTZ,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

### API Keys Table (new)

```sql
CREATE TABLE organization_api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  key_prefix      TEXT NOT NULL,          -- first 8 chars: piq_live_abc1...
  key_hash        TEXT NOT NULL,          -- SHA-256 (intentionally fast — see note below)
  scopes          TEXT[] NOT NULL,
  rate_limit_rpm  INT DEFAULT 60,
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id),
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Index on key_hash for O(1) lookup on every API request.
-- SHA-256 is used (not bcrypt/argon2) because API keys are high-entropy random
-- strings, not user-chosen passwords. Brute-force is not a realistic attack vector.
-- Fast hashing is critical since this runs on every API request.
CREATE UNIQUE INDEX idx_api_keys_hash ON organization_api_keys(key_hash)
  WHERE is_active = true;

-- Lookup flow: hash incoming key with SHA-256, query WHERE key_hash = $hash AND is_active = true.
```

### Embed Tokens Table (new)

```sql
CREATE TABLE organization_embed_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  token           TEXT UNIQUE NOT NULL,
  allowed_origins TEXT[] NOT NULL,
  widget_types    TEXT[] NOT NULL,
  created_by      UUID REFERENCES auth.users(id),
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_embed_tokens_token ON organization_embed_tokens(token)
  WHERE is_active = true;
```

### Organization Audit Log (new)

```sql
CREATE TABLE organization_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id        UUID REFERENCES auth.users(id),
  action          TEXT NOT NULL,
  target_type     TEXT NOT NULL,
  target_id       TEXT,
  details         JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_org_audit_org_created ON organization_audit_log(organization_id, created_at DESC);
```

### Reports Table Modification

The `reports` table already has an `organization_id UUID` column (migration 030, line 415). Only the foreign key constraint needs to be added if not present:

```sql
-- Add FK constraint if missing (column already exists)
ALTER TABLE reports
  ADD CONSTRAINT fk_reports_organization
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
  ON DELETE SET NULL;
```

When a report is created by an org member, `organization_id` is set from their membership. This persists even if the user later leaves the org. `ON DELETE SET NULL` means if the org is deleted, the reports survive but lose branding.

### Row-Level Security Policies

Per CLAUDE.md Section 1.2: "RLS is Supreme." All new tables get RLS policies.

```sql
-- organization_members: members can read own org, admins can mutate
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_members_select ON organization_members FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

CREATE POLICY org_members_insert ON organization_members FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
  ));

CREATE POLICY org_members_update ON organization_members FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
  ));

CREATE POLICY org_members_delete ON organization_members FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
  ));

-- organization_invites: admins can CRUD, invited user can read their own invite
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_invites_admin ON organization_invites FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
  ));

CREATE POLICY org_invites_invitee ON organization_invites FOR SELECT
  USING (email = auth.email());

-- organization_api_keys: admins only
ALTER TABLE organization_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_api_keys_admin ON organization_api_keys FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
  ));

-- organization_embed_tokens: admins only
ALTER TABLE organization_embed_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_embed_tokens_admin ON organization_embed_tokens FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
  ));

-- organization_audit_log: admins can read, service role inserts
ALTER TABLE organization_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_audit_admin_read ON organization_audit_log FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND role = 'admin' AND status = 'active'
  ));
-- INSERT is service_role only (no user-facing insert policy)

-- GRANTs for service_role (required per Supabase key architecture)
GRANT ALL ON organization_members TO service_role;
GRANT ALL ON organization_invites TO service_role;
GRANT ALL ON organization_api_keys TO service_role;
GRANT ALL ON organization_embed_tokens TO service_role;
GRANT ALL ON organization_audit_log TO service_role;
GRANT ALL ON organization_members TO authenticated;
GRANT ALL ON organization_invites TO authenticated;
GRANT SELECT ON organization_api_keys TO authenticated;
GRANT SELECT ON organization_embed_tokens TO authenticated;
GRANT SELECT ON organization_audit_log TO authenticated;
```

### Supabase Storage: Logo Bucket

```sql
-- Create org-logos bucket: public read, service_role write
INSERT INTO storage.buckets (id, name, public) VALUES ('org-logos', 'org-logos', true);

-- Storage policy: org admins can upload/delete via service role
-- Uploads are handled server-side (NestJS) using the service_role key,
-- so no client-side storage policies are needed.
```

### Seat Enforcement: Atomic Check

Seat limit checks on invite must be atomic to prevent race conditions:

```sql
-- Postgres function for atomic seat check + invite insert
CREATE OR REPLACE FUNCTION invite_org_member(
  p_org_id UUID, p_email TEXT, p_role TEXT, p_token TEXT,
  p_invited_by UUID, p_expires_at TIMESTAMPTZ
) RETURNS UUID AS $$
DECLARE
  v_seat_limit INT;
  v_extra_seats INT;
  v_active_count INT;
  v_pending_count INT;
  v_invite_id UUID;
BEGIN
  -- Lock the org row to prevent concurrent seat changes
  SELECT seat_limit, extra_seats INTO v_seat_limit, v_extra_seats
  FROM organizations WHERE id = p_org_id FOR UPDATE;

  SELECT COUNT(*) INTO v_active_count
  FROM organization_members WHERE organization_id = p_org_id AND status = 'active';

  SELECT COUNT(*) INTO v_pending_count
  FROM organization_invites WHERE organization_id = p_org_id AND status = 'pending';

  IF v_active_count + v_pending_count >= v_seat_limit + v_extra_seats THEN
    RAISE EXCEPTION 'SEAT_LIMIT_REACHED';
  END IF;

  INSERT INTO organization_invites (organization_id, email, role, token, invited_by, expires_at)
  VALUES (p_org_id, p_email, p_role, p_token, p_invited_by, p_expires_at)
  RETURNING id INTO v_invite_id;

  RETURN v_invite_id;
END;
$$ LANGUAGE plpgsql;
```

### Key Data Model Decisions

1. **Org-level billing, not user-level.** The org has a Stripe customer/subscription. Individual members inherit enterprise features from org membership.
2. **API keys are org-scoped, not user-scoped.** Scopes control what each key can access.
3. **Embed tokens are separate from API keys.** Embeds are public-facing with origin-restricted CORS; API keys are server-to-server with rate limiting.
4. **Invites use email + token.** Existing users get linked; new users go through sign-up that auto-joins them.
5. **`user_profiles.organization_id`** stays as denormalized convenience; `organization_members` is the source of truth. V1 enforces single-org membership via unique index on `user_id` (active/pending members only).
6. **Member removal is hard DELETE** with audit log entry. Avoids unique constraint conflicts on re-invite.
7. **Owner transfer endpoint required.** `owner_id` is nullable with `ON DELETE SET NULL` — org survives if owner deletes their account, but a new admin must be promoted to owner.
8. **SHA-256 for API key hashing** — intentionally fast for hot-path lookup. API keys are high-entropy random strings, not brute-forceable passwords.

---

## Section 2: Backend Modules & API Design

### New NestJS Modules

```
packages/backend/src/
├── organizations/                    # Core org management
│   ├── organizations.module.ts
│   ├── organizations.controller.ts   # CRUD orgs
│   ├── organizations.service.ts
│   ├── members.controller.ts         # Member management
│   ├── members.service.ts
│   ├── invites.controller.ts         # Invite flow
│   ├── invites.service.ts
│   ├── org-context.middleware.ts      # Resolves org from authenticated user
│   ├── org-admin.guard.ts            # Ensures user is org admin
│   ├── org-member.guard.ts           # Ensures user is org member
│   └── dto/
│       ├── create-organization.dto.ts
│       ├── update-organization.dto.ts
│       ├── invite-member.dto.ts
│       └── update-member-role.dto.ts
│
├── org-billing/                      # Stripe per-seat billing
│   ├── org-billing.module.ts
│   ├── org-billing.controller.ts
│   ├── org-billing.service.ts
│   └── org-billing-webhook.service.ts
│
├── org-branding/                     # Report-level white-label
│   ├── org-branding.module.ts
│   ├── org-branding.controller.ts
│   ├── org-branding.service.ts
│   └── dto/
│       └── update-branding.dto.ts
│
├── org-api-keys/                     # API key management
│   ├── org-api-keys.module.ts
│   ├── org-api-keys.controller.ts
│   ├── org-api-keys.service.ts
│   ├── api-key-auth.guard.ts
│   └── dto/
│       └── create-api-key.dto.ts
│
├── org-embeds/                       # Embeddable widget serving
│   ├── org-embeds.module.ts
│   ├── org-embeds.controller.ts
│   ├── org-embeds.service.ts
│   ├── embed-token.guard.ts
│   └── dto/
│       └── create-embed-token.dto.ts
│
├── org-audit/                        # Audit logging
│   ├── org-audit.module.ts
│   ├── org-audit.service.ts
│   └── org-audit.controller.ts
│
├── platform-api/                     # Public API v1
│   ├── platform-api.module.ts
│   ├── v1/
│   │   ├── scores.controller.ts
│   │   ├── metrics.controller.ts
│   │   ├── reports.controller.ts
│   │   ├── watchlist.controller.ts
│   │   ├── timeseries.controller.ts
│   │   └── rankings.controller.ts
│   ├── api-throttle.guard.ts
│   └── api-response.interceptor.ts
```

### API Endpoints

#### Organization Management — `JwtAuthGuard` + `OrgAdminGuard`

| Method   | Endpoint                              | Purpose                                 |
| -------- | ------------------------------------- | --------------------------------------- |
| `POST`   | `/api/org`                            | Create organization                     |
| `GET`    | `/api/org/:slug`                      | Get org details                         |
| `PUT`    | `/api/org/:slug`                      | Update org settings                     |
| `GET`    | `/api/org/:slug/members`              | List members                            |
| `POST`   | `/api/org/:slug/members/invite`       | Send invite email                       |
| `PUT`    | `/api/org/:slug/members/:userId/role` | Change member role                      |
| `DELETE` | `/api/org/:slug/members/:userId`      | Remove member                           |
| `POST`   | `/api/org/invite/:token/accept`       | Accept invite (JWT required)            |
| `PUT`    | `/api/org/:slug/transfer-ownership`   | Transfer org ownership to another admin |
| `GET`    | `/api/org/:slug/audit`                | Query audit log (paginated)             |

#### Billing — `JwtAuthGuard` + `OrgAdminGuard`

| Method | Endpoint                        | Purpose                                              |
| ------ | ------------------------------- | ---------------------------------------------------- |
| `POST` | `/api/org/billing/checkout`     | Create Stripe Checkout (org creation + payment)      |
| `POST` | `/api/org/:slug/billing/portal` | Stripe billing portal session                        |
| `PUT`  | `/api/org/:slug/billing/seats`  | Add/remove extra seats                               |
| `GET`  | `/api/org/:slug/billing/usage`  | Seat count, cost, next invoice                       |
| `POST` | `/api/webhooks/stripe`          | Stripe webhook (shared — routes by session metadata) |

#### Branding — `JwtAuthGuard` + `OrgAdminGuard`

| Method   | Endpoint                       | Purpose                            |
| -------- | ------------------------------ | ---------------------------------- |
| `GET`    | `/api/org/:slug/branding`      | Get current branding               |
| `PUT`    | `/api/org/:slug/branding`      | Update accent color, website, name |
| `POST`   | `/api/org/:slug/branding/logo` | Upload logo (multipart)            |
| `DELETE` | `/api/org/:slug/branding/logo` | Remove logo                        |

#### API Keys — `JwtAuthGuard` + `OrgAdminGuard`

| Method   | Endpoint                      | Purpose                                   |
| -------- | ----------------------------- | ----------------------------------------- |
| `GET`    | `/api/org/:slug/api-keys`     | List keys (prefix + name, never full key) |
| `POST`   | `/api/org/:slug/api-keys`     | Create key (returns full key ONCE)        |
| `PUT`    | `/api/org/:slug/api-keys/:id` | Update name, scopes, rate limit           |
| `DELETE` | `/api/org/:slug/api-keys/:id` | Revoke key                                |

#### Embed Tokens — `JwtAuthGuard` + `OrgAdminGuard`

| Method   | Endpoint                          | Purpose                      |
| -------- | --------------------------------- | ---------------------------- |
| `GET`    | `/api/org/:slug/embed-tokens`     | List tokens                  |
| `POST`   | `/api/org/:slug/embed-tokens`     | Create token                 |
| `PUT`    | `/api/org/:slug/embed-tokens/:id` | Update origins, widget types |
| `DELETE` | `/api/org/:slug/embed-tokens/:id` | Revoke token                 |

#### Embed Widget Data — `EmbedTokenGuard` (token + CORS origin)

| Method | Endpoint                                            | Purpose                       |
| ------ | --------------------------------------------------- | ----------------------------- |
| `GET`  | `/api/embed/score/:geoLevel/:geoId`                 | Score data for widget         |
| `GET`  | `/api/embed/metric-card/:metricId/:geoLevel/:geoId` | Metric snapshot               |
| `GET`  | `/api/embed/map/:geoLevel`                          | GeoJSON + metric data for map |
| `GET`  | `/api/embed/branding`                               | Org logo, accent color        |

#### Platform API v1 — `ApiKeyAuthGuard` + `ApiThrottleGuard`

| Method   | Endpoint                                        | Purpose                               |
| -------- | ----------------------------------------------- | ------------------------------------- |
| `GET`    | `/api/v1/scores/:geoLevel/:geoId`               | All scores for a geography            |
| `GET`    | `/api/v1/scores/:geoLevel/:geoId/:scoreType`    | Specific score with components        |
| `GET`    | `/api/v1/metrics/:metricId/:geoLevel`           | Snapshot for all regions (paginated)  |
| `GET`    | `/api/v1/metrics/:metricId/:geoLevel/:geoId`    | Single region metric                  |
| `GET`    | `/api/v1/timeseries/:metricId/:geoLevel/:geoId` | Historical time-series                |
| `GET`    | `/api/v1/rankings/:scoreType/:geoLevel`         | Top/bottom ranked markets             |
| `POST`   | `/api/v1/reports`                               | Trigger report generation (async)     |
| `GET`    | `/api/v1/reports/:id`                           | Get report (poll for completion)      |
| `GET`    | `/api/v1/reports`                               | List org's reports                    |
| `GET`    | `/api/v1/watchlist`                             | List watched geographies (org-scoped) |
| `POST`   | `/api/v1/watchlist`                             | Add to watchlist                      |
| `DELETE` | `/api/v1/watchlist/:id`                         | Remove from watchlist                 |

### Auth Flows

**Browser (logged-in user):**
JWT in cookie → `JwtAuthGuard` → `OrgContextMiddleware` resolves org_id → `OrgAdminGuard` or `OrgMemberGuard` checks role.

**Platform API (external):**
API key in `Authorization: Bearer piq_live_...` → `ApiKeyAuthGuard` hashes key, looks up org_id + scopes → `ApiThrottleGuard` checks Redis counter per key per minute.

**Embed widgets (public website):**
Embed token in query param `?token=emb_...` → `EmbedTokenGuard` validates token + checks `Origin` header against `allowed_origins` → returns data with matching CORS headers.

### Response Envelope (Platform API v1)

Success:

```json
{
  "data": { ... },
  "meta": {
    "request_id": "req_7f3a2b1c",
    "timestamp": "2026-03-24T14:30:00Z",
    "rate_limit": { "limit": 60, "remaining": 54, "reset_at": "2026-03-24T14:31:00Z" }
  }
}
```

List endpoints add `meta.pagination`: `{ total, limit, next_cursor }`. All list endpoints use cursor-based pagination with `?cursor=&limit=50` query params (not page-based).

Error:

```json
{
  "error": {
    "code": "INVALID_GEO_LEVEL",
    "message": "Geography level 'neighborhood' is not supported. Use: state, metro, county, zip.",
    "request_id": "req_7f3a2b1c"
  }
}
```

### Rate Limiting

Redis-backed sliding window per API key:

- Key pattern: `ratelimit:v1:{keyId}:{windowMinute}`
- TTL: 120 seconds
- Default: 60 RPM, configurable per key (60 / 120 / 300 / 600)
- Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### API Scopes

| Scope             | Endpoints                                                |
| ----------------- | -------------------------------------------------------- |
| `scores:read`     | `GET /api/v1/scores/*`                                   |
| `metrics:read`    | `GET /api/v1/metrics/*`, `GET /api/v1/timeseries/*`      |
| `rankings:read`   | `GET /api/v1/rankings/*`                                 |
| `reports:read`    | `GET /api/v1/reports`, `GET /api/v1/reports/:id`         |
| `reports:write`   | `POST /api/v1/reports`                                   |
| `watchlist:read`  | `GET /api/v1/watchlist`                                  |
| `watchlist:write` | `POST /api/v1/watchlist`, `DELETE /api/v1/watchlist/:id` |

### Key Backend Decisions

1. **Org context middleware** runs on all `/api/org/*` routes — attaches `req.org` and `req.orgRole`.
2. **Platform API v1 reuses existing services** — same `ScoringService`, different auth and response formatting.
3. **Reports via API are async** — returns `status: 'generating'` immediately, client polls until `status: 'complete'`.
4. **Watchlist is org-scoped in the API** — union of all org members' watchlist items.
5. **Every mutating org action** writes to `organization_audit_log` via `OrgAuditService.log()`.
6. **Cursor-based pagination** for all list endpoints (not page-based).
7. **Shared Stripe webhook endpoint.** Org billing webhooks use the existing `/api/webhooks/stripe` endpoint — NOT a separate URL. The handler inspects `session.metadata` to distinguish org checkouts (has `org_slug`) from individual user checkouts (has `user_id` + `tier`). Org-specific events are routed to `OrgBillingWebhookService`. The webhook endpoint MUST verify the Stripe signature using `stripe.webhooks.constructEvent()` with the existing `STRIPE_WEBHOOK_SECRET`.
8. **Dynamic CORS for embed endpoints.** Embed routes (`/api/embed/*`) need a custom NestJS interceptor that reads the embed token from the query param, looks up `allowed_origins`, and dynamically sets `Access-Control-Allow-Origin`. This interceptor must also handle preflight `OPTIONS` requests. The rest of the app's CORS configuration is unaffected.
9. **Embed backwards compatibility.** Existing public embed pages (no token required) continue to work. Token-based auth is required only for org-branded embeds. The `EmbedTokenGuard` checks: if `?token=` is present, validate it and apply org branding; if absent, serve the widget without branding (existing behavior). This prevents breaking any current embed deployments.

---

## Section 3: Frontend — Enterprise Admin Portal

### Route Structure

```
packages/frontend/app/org/
├── [slug]/
│   ├── admin/
│   │   ├── layout.tsx              # Admin shell: sidebar + org context provider
│   │   ├── page.tsx                # Dashboard overview
│   │   ├── members/
│   │   │   └── page.tsx            # Member list + invite flow
│   │   ├── branding/
│   │   │   └── page.tsx            # Logo upload, accent color, preview
│   │   ├── api-keys/
│   │   │   └── page.tsx            # API key management
│   │   ├── embeds/
│   │   │   └── page.tsx            # Embed token management + code snippets
│   │   ├── billing/
│   │   │   └── page.tsx            # Seat count, invoices, Stripe portal
│   │   └── audit/
│   │       └── page.tsx            # Activity log
└── invite/                         # OUTSIDE [slug]/admin/ — no OrgGuard wrapping
    └── [token]/
        └── page.tsx                # Invite acceptance (public, JWT required)
```

### Shared Components

```
packages/frontend/app/org/components/
├── OrgAdminSidebar.tsx         # M3 Navigation Drawer
├── OrgContextProvider.tsx      # React context: org data, role, branding
├── OrgGuard.tsx                # Client-side redirect if not org admin
├── MemberTable.tsx             # Sortable list with role badges, status pills
├── InviteMemberDialog.tsx      # M3 Dialog: email + role picker + send
├── ApiKeyCard.tsx              # Key prefix, scopes, last used, revoke
├── CreateApiKeyDialog.tsx      # Name, scopes checkboxes, rate limit dropdown
├── EmbedTokenCard.tsx          # Token, origins, widget types
├── CreateEmbedDialog.tsx       # Name, origins, widget type checkboxes
├── EmbedCodeSnippet.tsx        # Copyable iframe/JS code blocks
├── BrandingPreview.tsx         # Live preview of branded report header
├── LogoUploader.tsx            # Drag-and-drop with crop/resize
├── AccentColorPicker.tsx       # Color picker with WCAG AA contrast enforcement
├── AuditLogTable.tsx           # Paginated log with action icons, actor, timestamp
├── SeatUsageBar.tsx            # Visual: 7/10 seats used
└── OrgDashboardCards.tsx       # Overview stats
```

### Page Designs

**Dashboard (`/org/[slug]/admin`)** — Overview cards: Members (seat usage bar), Reports this month, API calls this month, Embed views this month, Recent audit log entries (last 5).

**Members** — Table with Name+email, Role badge (Admin green / Member blue), Status (Active/Pending/Suspended), Joined date, Actions (role toggle, remove with confirm). Invite button opens dialog; seat limit enforced (shows "Add seats" CTA when full).

**Branding** — Split layout: Left form controls (logo uploader, accent color picker, company name, website URL). Right live preview (mock report header with current branding). Preview shows org logo, accent color border, "Prepared by [Org]", "Powered by PropertyIQ".

**API Keys** — Card list: key prefix, name, scopes as chips, rate limit, last used. Create dialog: name, scope checkboxes, rate limit dropdown. On creation: modal shows full key ONCE with copy button + warning. Link to API docs below.

**Embeds** — Card list: token name, origins as chips, widget types as badges. Create dialog: name, allowed origins (multi-input), widget type checkboxes. Below each token: `EmbedCodeSnippet` with tabs for Score Ring / Metric Card / Interactive Map.

**Billing** — Plan summary ("Enterprise — 10 seats included"), seat usage bar, Add/Remove seats buttons, "Manage Billing" → Stripe Portal redirect, upcoming invoice preview, invoice history table with PDF links.

**Audit Log** — Paginated table: Action (icon + label), Actor (name + avatar), Target, Details (expandable), Timestamp. Filters: action type, date range, actor search.

### Data Layer

Fetchers in `lib/data/fetchers/`: `organizations.ts`, `org-billing.ts`, `org-branding.ts`, `org-api-keys.ts`, `org-embeds.ts`, `org-audit.ts`.

Hooks in `app/org/hooks/`: `useOrg.ts`, `useOrgMembers.ts`, `useOrgBilling.ts`, `useOrgBranding.ts`, `useOrgApiKeys.ts`, `useOrgEmbeds.ts`, `useOrgAudit.ts`.

### Key Frontend Decisions

1. **Separate route tree** (`/org/[slug]/admin/*`) — isolated from platform admin (`/admin/*`) and main app.
2. **`OrgContextProvider`** at layout level — fetches org data + role once, provides via React context.
3. **`OrgGuard`** redirects non-admins — members use the regular app with enterprise features unlocked.
4. **Invite acceptance route is OUTSIDE the admin layout.** `/org/invite/[token]` lives at `app/org/invite/[token]/page.tsx` — NOT under `[slug]/admin/`. This prevents `OrgGuard` from redirecting the invited user (who isn't a member yet) before they can accept.
5. **Invite flow reuses Resend** — same pattern as beta tester invites.
6. **All M3 design system** — cards, dialogs, tables, chips, badges per CLAUDE.md Section 8.
7. **Embed snippets auto-generate** with correct token, dimensions, and URL.

---

## Section 4: Embeddable Widgets

### Widget Routes

```
packages/frontend/app/embed/
├── layout.tsx                      # Minimal shell: no nav, branding wrapper only
├── score/[geoLevel]/[geoId]/page.tsx
├── metric-card/[metricId]/[geoLevel]/[geoId]/page.tsx
├── map/[geoLevel]/page.tsx
└── components/
    ├── EmbedShell.tsx              # Auth + branding resolver + error boundary
    ├── EmbedScoreRing.tsx          # Simplified ScoreWidget for embed
    ├── EmbedMetricCard.tsx         # Compact metric card
    ├── EmbedMiniMap.tsx            # Mapbox mini-map
    ├── EmbedBrandingBar.tsx        # Top bar: org logo + accent color
    ├── EmbedLoadingSkeleton.tsx    # Branded skeleton
    └── EmbedErrorState.tsx         # Error with retry
```

### Auth Flow

```
iframe src="/embed/score/metro/31080?token=emb_abc123"
→ EmbedShell reads ?token
→ GET /api/embed/branding?token=emb_abc123
  → EmbedTokenGuard validates: is_active, Origin vs allowed_origins, widget_type
  → Returns org branding (logo_url, accent_color, org_name)
  → Sets CORS headers
→ Widget calls data endpoint with same token
→ Same guard validates again on data request
```

### Widget Designs

**Score Ring** (~280×320px): Branding bar → Score ring with number + label + score type → Geography name → "Powered by PropertyIQ" footer link. Query params: `?token=emb_...&scoreType=homeready`.

**Metric Card** (~300×200px): Branding bar → Metric title → Formatted value + trend arrow → Geography name + data freshness → Footer link.

**Interactive Map** (~600×400px, responsive): Branding bar → Mapbox map with color-coded regions → Click region for tooltip → Color legend → Footer link. Query params: `?token=emb_...&metric=home_value&center=-96.8,32.7&zoom=6`. Pan/zoom enabled but constrained.

### Branding

`EmbedBrandingBar`: 40px tall, accent color background, org logo (24px) + org name left-aligned. Falls back to org name only if no logo.

`EmbedShell`: Wraps all widget pages. Resolves branding from token, applies as CSS variables, renders branding bar + footer.

### Key Embed Decisions

1. **Widgets are Next.js pages** in the same app under `/embed/*`. Layout strips all chrome.
2. **No client-side routing inside embeds.** Each widget is a single page. Map tooltips render inline.
3. **"Powered by PropertyIQ" is always visible.** Not removable. Fixed footer link.
4. **Widgets reuse existing components** — `ScoreDisplay`, `formatMetricValue`, `useMapLayers` logic adapted for embed.
5. **Responsive within bounds.** Score/metric are fixed dimensions. Map is responsive (min 300px, max 1200px, 3:2 ratio).
6. **No JS SDK in V1.** Iframe-only. JS SDK for dynamic resizing/postMessage is a natural follow-up.

---

## Section 5: Report Branding

### Where Branding Appears

1. **In-app report view** (`/reports/[id]`)
2. **Shared report link** (`/shared/report/[token]`)
3. **PDF export** (browser print)

All three render consistent branding.

### Branding Flow

```
Org admin sets logo + accent color → stored in organizations table
Org member generates report → report.organization_id set from membership
Report renders → checks organization_id → fetches org branding → applies branded header
No org → standard PropertyIQ header
```

### Visual Treatment

**Standard header:** PropertyIQ logo + report title + geography + date.

**Branded header:** Org logo (replaces PropertyIQ logo) + accent color top border + report title + geography + date + "Prepared by [Org Name] · website" + "Powered by PropertyIQ" in smaller text.

### Implementation

- Add `organization_id` column to `reports` table.
- On report creation, set from user's active org membership.
- New hook: `useReportBranding(organizationId)` — fetches branding if org exists, returns null otherwise.
- New component: `BrandedReportHeader.tsx` — renders branded variant; falls back to standard when branding is null.
- Public branding endpoint (no auth) for shared report links — returns only logo_url, accent_color, org_name, website_url.
- Print CSS: force background colors for accent bar, constrain logo size, style "Powered by" footer.

### Key Branding Decisions

1. **Branding is org-level, not report-level.** Every report from the org looks the same.
2. **`organization_id` persists on the report.** Old reports keep branding even if user leaves org.
3. **"Powered by PropertyIQ" is mandatory** and not removable.
4. **Public branding endpoint.** No auth needed for shared links — data is not sensitive.
5. **Logo stored in Supabase Storage.** Resized to max 400px wide, WebP format, `org-logos` bucket.
6. **Accent color constrained to WCAG AA** contrast against white text.

---

## Section 6: Platform API v1

### Design Principles

RESTful, JSON-only. Consistent envelope. API key auth (no OAuth). Versioned under `/api/v1/`. Paginated with cursors. Rate limited per key via Redis.

### Endpoint Reference

**Scores:**

- `GET /api/v1/scores/:geoLevel/:geoId` — All score types with components + confidence.
- `GET /api/v1/scores/:geoLevel/:geoId/:scoreType` — Single score type, full breakdown.

**Metrics:**

- `GET /api/v1/metrics/:metricId/:geoLevel?cursor=&limit=50` — All regions, paginated.
- `GET /api/v1/metrics/:metricId/:geoLevel/:geoId` — Single region value.

**Time Series:**

- `GET /api/v1/timeseries/:metricId/:geoLevel/:geoId?start=2024-01-01&end=2026-03-01&interval=monthly`

**Rankings:**

- `GET /api/v1/rankings/:scoreType/:geoLevel?limit=25&order=desc&state=TX`

**Reports (async):**

- `POST /api/v1/reports` — Trigger generation. Returns `{ id, status: 'generating', poll_url }`.
- `GET /api/v1/reports/:id` — Poll for completion. Returns full report when `status: 'complete'`.
- `GET /api/v1/reports?cursor=&limit=20` — List org's reports.

**Watchlist (org-scoped):**

- `GET /api/v1/watchlist`
- `POST /api/v1/watchlist` — `{ geography_level, geography_id, tags }`
- `DELETE /api/v1/watchlist/:id`

### API Documentation

Static Next.js page at `/docs/api` with: getting started guide, auth section, rate limiting explanation, full endpoint reference with examples, error codes, code examples (cURL, JavaScript, Python).

### Key API Decisions

1. **API keys, not OAuth.** Server-to-server; no "act on behalf of user" use case.
2. **Reports are async via polling.** AI generation takes 10-30s; returns immediately with status URL. Webhooks for completion deferred.
3. **Watchlist is org-scoped.** API exposes union of all org members' watchlists.
4. **Responses include formatted values.** Both raw `value` and `formatted` string provided.
5. **No webhook system in V1.** Polling works; webhooks add infrastructure complexity, deferred.

---

## Section 7: Billing — Stripe Per-Seat Subscription

### Stripe Product Structure

- **PropertyIQ Enterprise** — flat monthly price, includes 10 seats.
- **PropertyIQ Enterprise Seat** — per-unit monthly price (1/10th enterprise cost), for additional seats beyond 10.

Two prices on one subscription.

### Subscription Lifecycle

**Org Creation = Checkout:** Org admin fills org details → redirected to Stripe Checkout → payment collected → `checkout.session.completed` webhook → org created with `billing_status: 'active'`. No "pending" state — org doesn't exist until payment succeeds.

**Adding Extra Seats:** Admin requests N extra seats → backend adds/updates seat line item on subscription → Stripe prorates → `org.extra_seats` updated. Effective limit = `seat_limit + extra_seats`.

**Removing Extra Seats:** Admin reduces extras → backend verifies active members ≤ new limit → updates subscription quantity → `org.extra_seats` decremented. Returns 400 `SEATS_IN_USE` if over.

**Seat Enforcement:** On invite, backend checks `active_members + pending_invites < seat_limit + extra_seats`. Returns 400 `SEAT_LIMIT_REACHED` if over.

**Stripe Customer Portal:** For invoices, payment method, cancellation — redirect to Stripe-hosted portal.

### Webhook Handlers

| Event                           | Action                                                 |
| ------------------------------- | ------------------------------------------------------ |
| `checkout.session.completed`    | Create org, set Stripe IDs, `billing_status: 'active'` |
| `invoice.paid`                  | Confirm `billing_status: 'active'`                     |
| `invoice.payment_failed`        | Set `billing_status: 'past_due'`, email org admin      |
| `customer.subscription.updated` | Sync seat count                                        |
| `customer.subscription.deleted` | Set `billing_status: 'canceled'`, start grace period   |

**Grace period:** On cancellation, members retain access until current billing period ends. After that, they lose enterprise features and fall back to individual tier. Org data preserved for reactivation.

### Billing Page

Plan summary + seat usage bar + Add/Remove seats + upcoming invoice + invoice history + "Manage Billing" → Stripe Portal.

### Key Billing Decisions

1. **Two line items, one subscription.** Stripe handles proration automatically.
2. **Seat count validated on invite, not on login.** No hostile lockouts.
3. **Stripe Customer Portal** for PCI-compliant payment management.
4. **No self-serve downgrade.** Cancel enterprise → individual users revert to personal tier.
5. **Invoice data fetched from Stripe, not cached.** Always accurate.
6. **Past-due handling is gentle.** Email admin, let Stripe retry, only revoke after Stripe cancels.

---

## Section 8: Testing Strategy — Live Data Integration Tests

### Principle

No mocks. Every test hits real infrastructure: real Supabase, real Stripe (test mode), real Redis, real API endpoints.

### Test File Structure

```
packages/backend/test/enterprise/
├── setup/
│   ├── seed-test-org.ts          # Creates org, members, keys, tokens in real DB
│   ├── stripe-test-helpers.ts    # Stripe test-mode helpers
│   ├── test-env.ts               # Test env vars
│   └── cleanup.ts                # Tears down test data
│
├── organizations.e2e-spec.ts     # Org CRUD lifecycle
├── members.e2e-spec.ts           # Invite → accept → role change → remove
├── billing.e2e-spec.ts           # Checkout → add seats → payment failure → cancel
├── api-keys.e2e-spec.ts          # Create → use → scope enforcement → revoke
├── embeds.e2e-spec.ts            # Token → widget data → CORS → origin rejection
├── platform-api.e2e-spec.ts      # All v1 endpoints via API key auth
├── branding.e2e-spec.ts          # Upload logo → verify on report → verify on embed
├── audit-log.e2e-spec.ts         # Actions generate audit entries
└── rls-policies.e2e-spec.ts      # Supabase RLS enforcement per role

packages/frontend/test/enterprise/
├── org-admin-portal.e2e-spec.ts  # Playwright: admin portal flows
├── embed-widgets.e2e-spec.ts     # Playwright: iframe rendering + branding
└── report-branding.e2e-spec.ts   # Playwright: branded report
```

### Test Seed Data

Known test org (`test-brokerage`) with:

- Org admin user
- Org member user
- Outsider user (not in org)
- API key with limited scopes and low rate limit (10 RPM for throttle testing)
- Embed token with specific allowed origins and widget types

Cleanup deletes the test org and cascades after each suite.

### Backend Test Suites

**Organizations (7 tests):** Create, duplicate slug rejection, get as admin/member/outsider, update, update as non-admin rejection.

**Members (10 tests):** Invite, invalid email, invite at seat limit, accept (existing user), accept (new user), accept expired, change role, change role as non-admin, remove, remove last admin rejection.

**Billing (9 tests):** Create checkout session, simulate checkout.session.completed, add seats, remove seats (allowed), remove seats (over limit), simulate payment failure, simulate subscription deleted, create portal session, fetch upcoming invoice.

**API Keys (9 tests):** Create, list (no full key), auth with valid key, auth with revoked key, auth with expired key, scope enforcement, rate limit exceeded, rate limit headers, update scopes.

**Embeds (7 tests):** Create token, valid token + valid origin, valid token + wrong origin, revoked token, wrong widget type, branding endpoint, data matches internal API.

**Platform API v1 (11 tests):** Scores, metrics, timeseries with date range, rankings, create report (async), poll report completion, list reports, watchlist CRUD, response envelope shape, error shape, cursor pagination.

**Branding (7 tests):** Upload logo, update accent color, report gets organization_id, report includes branding, shared report includes branding, delete logo fallback, non-org report has no branding.

**RLS Policies (7 tests):** Admin reads members, member reads members, outsider blocked, admin reads audit, member blocked from audit, cross-org query returns empty, service role bypasses.

**Audit Log:** Covered implicitly — every mutating test asserts an audit log entry exists.

### Frontend E2E (Playwright)

**Admin Portal (11 tests):** Login as admin → dashboard loads, members page invite flow, role change, branding upload + preview, accent color change, API key creation, embed token + snippet, billing seat bar, audit log shows actions, member login blocked from admin, outsider blocked.

**Embed Widgets (6 tests):** Score widget loads, metric card loads, map widget loads, invalid token error, branding bar correct, "Powered by" link present.

**Report Branding (3 tests):** Branded header in app, branded header on shared link, print CSS applies.

### Test Execution

```bash
# Backend integration tests
cd packages/backend && npm run test:enterprise

# Frontend E2E
cd packages/frontend && npx playwright test test/enterprise/
```

### Key Testing Decisions

1. **Same Supabase project, dedicated test org.** No separate test project. Seed creates, cleanup deletes.
2. **Stripe test mode.** Real API calls with test keys. `stripe.testHelpers.testClocks` for time simulation.
3. **RLS tests use real JWTs.** Creates auth users in Supabase, queries with their tokens.
4. **Frontend E2E requires seeded data.** Playwright runs after seed script.
5. **Tests are independent but ordered within suites.** Each suite seeds and cleans up.
6. **CI-compatible.** Needs env vars for Supabase URL/keys, Stripe test keys, Redis URL.

---

## Deferred / Follow-Up Items

These are explicitly out of scope for V1 but noted for future planning:

| Item                                              | Rationale                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| JS embed SDK (postMessage, dynamic resize)        | Iframe works for V1; SDK adds complexity                           |
| Webhook system (report completion, alerts)        | Polling works; webhooks need retry queues, delivery tracking       |
| SSO / SAML                                        | Not needed for brokerage use case initially                        |
| Custom scoring weights per org                    | Global weights serve all customers for now                         |
| Link expiry UI in share modal                     | Backend supports `expiresInDays` but not exposed in V1             |
| Full UI white-label (custom domain, full theming) | Report-level branding covers the primary need                      |
| API rate limiting tiers (beyond per-key RPM)      | Simple per-key RPM is sufficient for launch                        |
| Org-level usage analytics dashboard               | Admin overview cards cover basics; detailed analytics deferred     |
| Scenario modeling / statistical deep dives        | Advertised but separate feature work, not part of enterprise infra |
