# Enterprise Organization Improvements — Design Spec

**Date:** 2026-03-25
**Status:** Draft
**Scope:** 7 features across org admin, billing, and platform admin

---

## 1. Auto-Enable API & Embed Flags on Org Creation

**Problem:** `api_enabled` and `embed_enabled` default to `false`. Enterprise orgs see "not enabled" on API Keys and Embeds pages until an admin manually flips DB flags.

**Design:** In `organizations.service.ts` `create()`, set both flags to `true` when the owner's tier is enterprise. On org deletion, these are moot (row is gone). No UI needed.

**Backend change:** `organizations.service.ts` — BEFORE inserting the org, check the owner's `subscription_tier` from `user_profiles`. If enterprise, include `api_enabled: true, embed_enabled: true` in the initial insert payload. This avoids a race condition where the org briefly exists with flags set to false.

**Files:** `packages/backend/src/organizations/organizations.service.ts`

---

## 2. Reports Dashboard Card

**Problem:** The "Reports This Month" card on the org admin dashboard is a placeholder showing "coming soon."

**Design:** Replace with a real card showing three layers of data:

### 2a. Count + Trend

- Query `reports` table: `COUNT(*) WHERE organization_id = :orgId AND created_at >= :startOfMonth`
- Compare to previous month for trend arrow (up/down/flat)
- Display: "14 reports this month" with green/red trend badge

### 2b. Per-Member Breakdown

- Query: `GROUP BY user_id` for current month, join `user_profiles` for names
- Display as a small ranked list below the count (top 3 members, "and X others")
- Truncate to avoid card bloat

### 2c. Usage / Quota

- **New feature definition:** Add `monthly_report_limit` to `feature_definitions` table
- Enterprise default: 100 (or -1 for unlimited). Pro: 10. Free: 3.
- Add to `tier_features` for each tier
- Display: progress bar showing `used / limit` (like SeatUsageBar)
- If limit is -1 (unlimited), show count only without bar

### Backend endpoint

New: `GET /api/org/:slug/reports/stats` — returns `{ count, previousCount, byMember: [{userId, name, count}], limit }`.
Guards: JwtAuthGuard + OrgContextGuard + OrgMemberGuard.

### Frontend

- New fetcher: `fetchOrgReportStats(slug)` in `lib/data/fetchers/org-reports.ts`
- Replace the placeholder card in `OrgDashboardCards.tsx` with real data
- Keep the existing card layout pattern (icon + label + big number + sub-content)

**Files:**

- `packages/backend/src/organizations/org-report-stats.service.ts` (new)
- `packages/backend/src/organizations/organizations.controller.ts` (new endpoint)
- `packages/frontend/lib/data/fetchers/org-reports.ts` (new)
- `packages/frontend/app/org/components/OrgDashboardCards.tsx` (modify)
- SQL: insert `monthly_report_limit` feature definition + tier_features rows

---

## 3. Audit Log Filters

**Problem:** The audit log is a flat paginated list with no filtering.

**Design:** Add three filter controls above the table:

### Filters

1. **Action type** — dropdown: All, Member Events, Billing, Settings, API Keys, Embeds, Branding
   - Maps to action prefixes: `member_*`, `billing_*`/`seats_*`, `org_*`, `api_key_*`, `embed_token_*`, `branding_*`/`logo_*`
2. **Date range** — two date inputs (from/to), defaults to last 30 days
3. **Actor** — text input with email autocomplete from org members list

### Backend changes

`GET /api/org/:slug/audit` already exists. Add optional query params:

- `action_prefix` — filter by action name prefix (e.g., `member` matches `member_invited`, `member_removed`)
- `from` / `to` — ISO date range filter on `created_at`
- `actor_id` — filter by specific actor UUID

The `OrgAuditService.getAuditLog()` method already accepts pagination. Add filter params to the query builder.

### Frontend changes

- Add filter bar above the audit table
- Filters update query params, triggering a refetch
- Reset pagination when filters change
- Show active filter count badge

**Files:**

- `packages/backend/src/org-audit/org-audit.service.ts` (modify query)
- `packages/backend/src/org-audit/org-audit.controller.ts` (add query params)
- `packages/frontend/app/org/[slug]/admin/audit/page.tsx` (add filter UI)

---

## 4. Admin Users Page: Sort/Filter by Org

**Problem:** The platform admin users page shows org name/role but can't sort or filter by it.

**Design:**

- Add an **"Organization" filter dropdown** next to the existing tier filter
  - Options: "All", then a list of org names fetched from backend
- Add **sortable column header** on the org name column
- Backend: add `org` query param to `GET /api/admin/users` that filters by `organization_id`
- Backend: add `sort=organization` option for ordering

### Backend changes

In `admin/users/users.service.ts` `listUsers()`:

- Accept `organizationId` filter param → `query.eq('organization_id', orgId)`
- Accept `sort` param → if `organization`, order by org name (join or subquery)

### Frontend changes

- Add org filter dropdown populated from backend (reuse existing org list from stats or add endpoint)
- Make org column header clickable for sort toggle

**Files:**

- `packages/backend/src/admin/users/users.service.ts` (modify listUsers)
- `packages/backend/src/admin/users/users.controller.ts` (add query params)
- `packages/frontend/app/admin/entitlements/users/page.tsx` (add filter + sort)

---

## 5. Delete Organization

**Problem:** No way to delete an org from the admin UI. If an enterprise user mistyped the org name, they're stuck.

**Design:** Two deletion paths with pre-deletion cleanup:

### Pre-Deletion Cleanup (both paths)

Before deleting the org row, the service MUST:

1. **Cancel Stripe subscription** — if `org.stripe_subscription_id` exists, cancel via Stripe API (cancel at period end to avoid mid-period refund complexity)
2. **Clear member profiles** — query all `organization_members`, then null out `user_profiles.organization_id` and `user_profiles.organization_role` for each member (these columns are NOT FK-cascaded)
3. **Preserve reports** — `reports.organization_id` uses `ON DELETE SET NULL`, so reports survive. Document this in confirmation dialogs.
4. Delete the org row → FK CASCADE removes members, invites, api_keys, embed_tokens, audit_log

After deletion: if the owner's `subscription_tier` is still `enterprise`, the `EnterpriseOnboardingGate` automatically detects `hasOrg: false` and re-triggers the wizard on next page load.

### 5a. Platform Admin Deletion

- New endpoint: `DELETE /api/admin/org/:orgId`
- Guards: JwtAuthGuard + AdminGuard (platform admin only)
- Runs pre-deletion cleanup, then deletes

### 5b. Enterprise Owner Self-Delete

- New endpoint: `DELETE /api/org/:slug` (owner only)
- Guards: JwtAuthGuard + OrgContextGuard + ownership check (`org.owner_id === userId`)
- Confirmation: requires `confirm: true` in body (prevents accidental deletion)
- Runs same pre-deletion cleanup, then deletes

### Frontend

- **Admin panel:** Add "Delete Org" button in user detail card (when user has an org)
- **Org admin dashboard:** Add "Delete Organization" in a danger zone section at bottom of dashboard
- Both show confirmation dialog: "This will cancel the Stripe subscription, remove all members, and delete API keys/embed tokens. Reports will be preserved. Enterprise users will be prompted to create a new org."

**Files:**

- `packages/backend/src/admin/users/users.controller.ts` (new admin delete endpoint)
- `packages/backend/src/admin/users/users.service.ts` (new deleteOrg method)
- `packages/backend/src/organizations/organizations.controller.ts` (new owner delete endpoint)
- `packages/backend/src/organizations/organizations.service.ts` (new delete method)
- `packages/frontend/app/admin/entitlements/users/page.tsx` (add delete org button)
- `packages/frontend/app/org/[slug]/admin/page.tsx` (add danger zone)

---

## 6. Rename Organization (Name + Slug with 30-Day Redirect)

**Problem:** Org name and slug are set at creation. Typos or rebranding require deletion and re-creation.

**Design:**

### 6a. Name Change

- Already partially supported: `update()` accepts `name`. Just needs frontend UI.

### 6b. Slug Change with Redirect

- New DB table: `organization_slug_redirects`

  ```sql
  CREATE TABLE organization_slug_redirects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    old_slug TEXT NOT NULL,
    new_slug TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL  -- created_at + 30 days
  );
  CREATE UNIQUE INDEX idx_slug_redirects_active ON organization_slug_redirects(old_slug) WHERE expires_at > now();
  ```

  When creating a new redirect, first expire any existing active redirects for the old slug. Also check the redirects table when validating a new slug to prevent collisions with active redirects from other orgs.

- When slug is updated:
  1. Validate new slug (same rules as creation: regex, reserved words, uniqueness)
  2. Update `organizations.slug`
  3. Insert redirect row: `old_slug → new_slug`, expires in 30 days
  4. Audit log the change

- **Redirect in layout** (NOT middleware — middleware runs on all requests including static assets):
  - In the org admin layout (`layout.tsx`), BEFORE mounting `OrgContextProvider`, call `GET /api/org/resolve-slug/:slug`
  - If it returns `{ redirect: newSlug }`, redirect to `/org/${newSlug}/admin/*` with 301
  - If 404, proceed normally with `OrgContextProvider`
  - The backend `OrgContextGuard` should ALSO check the redirects table to avoid 404ing during the 30-day window (for any direct API calls using the old slug)

### Frontend

- Add "Organization Settings" section on dashboard or a new settings sub-page
- Name: text input, editable
- Slug: text input with live preview, shows warning about URL change
- Save button, confirmation dialog for slug changes ("URLs will change. Old URLs redirect for 30 days.")

### Backend changes

- Extend `UpdateOrganizationDto` to accept `slug`
- Modify `update()` to handle slug changes (validate + insert redirect + update)
- New endpoint: `GET /api/org/resolve-slug/:slug`

**Files:**

- SQL migration: create `organization_slug_redirects` table
- `packages/backend/src/organizations/dto/update-organization.dto.ts` (add slug)
- `packages/backend/src/organizations/organizations.service.ts` (modify update, add redirect logic)
- `packages/backend/src/organizations/organizations.controller.ts` (add resolve-slug endpoint)
- `packages/frontend/app/org/[slug]/admin/layout.tsx` (add redirect check)
- `packages/frontend/app/org/[slug]/admin/page.tsx` (add settings section)

---

## 7. Enterprise Downgrade with Member Notification

**Problem:** No way for an enterprise owner to downgrade. If they do (via Stripe), org members aren't notified.

**Design:**

### 7a. Downgrade Trigger & Member State Machine

The Stripe billing portal already allows plan changes. The existing `OrgBillingWebhookService` handles `customer.subscription.updated` events.

When a subscription changes from enterprise to pro/free:

1. Update `organizations.billing_status` to reflect new state
2. Update owner's `user_profiles.subscription_tier` to the new tier
3. **Revoke enterprise features:** Set `api_enabled: false`, `embed_enabled: false` on the org
4. **Members keep their membership** but lose enterprise-tier access (entitlements are tier-based, not membership-based). The org row continues to exist.
5. Members' `user_profiles.subscription_tier` stays unchanged (they inherit access from the org's tier via entitlements, not via their own profile)
6. Queue member notification (see 7b)

**The org is NOT deleted on downgrade.** It persists with reduced features. Members can still access the org admin pages but will see paywalls on enterprise-gated features.

### 7b. Member Notification Email

Queue notifications using a fire-and-forget pattern (webhook must return 200 within 30s):

- Set a `downgrade_notified_at IS NULL` flag on affected members
- A follow-up async job (or `waitUntil`/`after`) sends emails
- For each member, send an email via the existing email service:
  - Subject: "Your enterprise account has been downgraded"
  - Body: Explains the change, offers two CTAs:
    1. **"Create your own Enterprise account"** → link to `/pricing?plan=enterprise`
    2. **"Upgrade to Pro"** → link to `/pricing?plan=pro`
  - Include org name, effective date, what features they lose
- Add `org_downgraded` to the `AuditAction` type union

### 7c. In-App Notification

- On next login, downgraded org members see a banner (similar to `OrgSetupBanner`) explaining the change
- Banner links to pricing page
- Dismissible (unlike the enterprise onboarding banner)

### 7d. Improved Billing Portal Link

- Current "Manage Billing" button opens Stripe portal
- Add context above the button: current plan name, next billing date, amount
- Add a prominent "Change Plan" section with the available tiers and prices
  - Show current plan highlighted
  - Other plans show "Switch to X" buttons
  - Clicking opens Stripe portal pre-configured for that plan change (if Stripe supports it) or the general portal

### Stripe Portal Configuration

- Stripe Customer Portal can be configured to show plan switching. This is a Stripe Dashboard setting, not code.
- In code: `createBillingPortalSession` can pass `flow_data.type: 'subscription_update'` to open directly to the plan change view.

**Files:**

- `packages/backend/src/org-billing/org-billing-webhook.service.ts` (add downgrade detection)
- `packages/backend/src/org-billing/org-downgrade-notifier.service.ts` (new — email + audit)
- `packages/frontend/app/org/[slug]/admin/billing/page.tsx` (improve portal section + plan display)
- Email template: `packages/backend/src/org-billing/templates/downgrade-notification.ts` (new)

---

## Implementation Order

Build in this order (each step is independently deployable):

1. **Auto-enable flags** — 5 minutes, unblocks testing
2. **Audit log filters** — backend + frontend, no new tables
3. **Admin users org filter** — small backend + frontend change
4. **Reports dashboard card** — new endpoint + fetcher + card, includes migration for report quota
5. **Delete org** — backend + frontend, two paths (admin + owner). Simpler than rename, unblocks "delete and re-create" testing
6. **Org rename with redirect** — new table + backend + frontend + layout redirect check
7. **Enterprise downgrade + notification** — Stripe webhook + async email + banner

---

## Out of Scope

- Per-member report analytics page (just the dashboard card for now)
- Org-level report templates or shared report libraries
- Custom domain mapping for org slugs
- SSO/SAML for enterprise orgs
- Audit log export (CSV/PDF)
