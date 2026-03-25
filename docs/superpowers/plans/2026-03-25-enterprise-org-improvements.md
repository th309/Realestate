# Enterprise Organization Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 enterprise org features: auto-enable flags, reports dashboard, audit filters, admin org filter, org deletion, org rename with redirect, and enterprise downgrade with notification.

**Architecture:** Incremental backend-first approach. Each task adds a backend change, then its frontend consumer. All tasks are independently deployable and committable. DB migrations run via Supabase MCP. Backend is NestJS with Supabase (PostgreSQL). Frontend is Next.js 16 App Router with React Query.

**Tech Stack:** NestJS 11, Next.js 16, Supabase, Stripe, React Query, Tailwind CSS (M3 design system), class-validator DTOs

**Spec:** `docs/superpowers/specs/2026-03-25-enterprise-org-improvements-design.md`

---

## Task 1: Auto-Enable API & Embed Flags on Org Creation

**Files:**

- Modify: `packages/backend/src/organizations/organizations.service.ts:64-76` (create method insert)

- [ ] **Step 1: Check owner tier before insert**

In `organizations.service.ts`, before the `.insert()` call at line 70, query the owner's tier:

```typescript
// Before the insert — check if owner is enterprise
const { data: ownerProfile } = await this.supabase
  .from("user_profiles")
  .select("subscription_tier")
  .eq("id", ownerId)
  .single();

const isEnterprise = ownerProfile?.subscription_tier === "enterprise";
```

- [ ] **Step 2: Include flags in insert payload**

Modify the `.insert()` payload at line 70 to include the flags:

```typescript
.insert({
  name: dto.name,
  slug: dto.slug,
  owner_id: ownerId,
  ...(isEnterprise && { api_enabled: true, embed_enabled: true }),
})
```

- [ ] **Step 3: Verify and commit**

Run: `cd packages/backend && npx tsc --noEmit`

```bash
git add packages/backend/src/organizations/organizations.service.ts
git commit -m "feat: auto-enable api_enabled and embed_enabled for enterprise org creation"
```

---

## Task 2: Audit Log Filters — Backend

**Files:**

- Modify: `packages/backend/src/org-audit/org-audit.service.ts:121-162` (query method)
- Modify: `packages/backend/src/org-audit/org-audit.controller.ts:34-51` (GET endpoint)

- [ ] **Step 1: Add filter params to AuditQueryParams type**

In `org-audit.service.ts`, find the `AuditQueryParams` interface and add:

```typescript
actionPrefix?: string;  // matches actions starting with this prefix (e.g., 'member')
fromDate?: string;      // ISO date string, inclusive
toDate?: string;        // ISO date string, inclusive
actorId?: string;       // UUID of the actor
```

- [ ] **Step 2: Add filter logic to query() method**

After the existing `params.action` filter at line 138, add:

```typescript
if (params.actionPrefix) {
  query = query.like("action", `${params.actionPrefix}%`);
}
if (params.fromDate) {
  query = query.gte("created_at", params.fromDate);
}
if (params.toDate) {
  query = query.lte("created_at", `${params.toDate}T23:59:59.999Z`);
}
if (params.actorId) {
  query = query.eq("actor_id", params.actorId);
}
```

- [ ] **Step 3: Add query params to controller**

In `org-audit.controller.ts`, add query params to the `getAuditLog` method at line 34:

```typescript
@Query('action_prefix') actionPrefix?: string,
@Query('from') fromDate?: string,
@Query('to') toDate?: string,
@Query('actor_id') actorId?: string,
```

Pass them through to the service call.

- [ ] **Step 4: Verify and commit**

Run: `cd packages/backend && npx tsc --noEmit`

```bash
git add packages/backend/src/org-audit/
git commit -m "feat: add audit log filters — action prefix, date range, actor"
```

---

## Task 3: Audit Log Filters — Frontend

**Files:**

- Modify: `packages/frontend/app/org/[slug]/admin/audit/page.tsx:77-231`

- [ ] **Step 1: Add filter state**

Add state variables after the existing state at line 81:

```typescript
const [actionFilter, setActionFilter] = useState("");
const [fromDate, setFromDate] = useState("");
const [toDate, setToDate] = useState("");
const [actorFilter, setActorFilter] = useState("");
```

- [ ] **Step 2: Build filter params helper**

```typescript
function buildFilterParams() {
  const params: Record<string, string> = {};
  if (actionFilter) params.action_prefix = actionFilter;
  if (fromDate) params.from = fromDate;
  if (toDate) params.to = toDate;
  if (actorFilter) params.actor_id = actorFilter;
  return params;
}
```

- [ ] **Step 3: Update fetch calls to pass filters**

Modify `loadInitial()` and `loadMore()` to include filter params in the `fetchOrgAuditLog` call. Reset entries and cursor when filters change:

```typescript
useEffect(() => {
  loadInitial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [actionFilter, fromDate, toDate, actorFilter]);
```

- [ ] **Step 4: Add filter bar UI**

Insert after the page header, before the table. Use the existing M3 design patterns:

```tsx
<div className="flex flex-wrap items-center gap-3 mb-4">
  <select
    value={actionFilter}
    onChange={(e) => setActionFilter(e.target.value)}
    className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm"
  >
    <option value="">All Actions</option>
    <option value="member">Member Events</option>
    <option value="billing,seats">Billing</option>
    <option value="org">Settings</option>
    <option value="api_key">API Keys</option>
    <option value="embed_token">Embeds</option>
    <option value="branding,logo">Branding</option>
  </select>
  <input
    type="date"
    value={fromDate}
    onChange={(e) => setFromDate(e.target.value)}
    className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm"
    placeholder="From"
  />
  <input
    type="date"
    value={toDate}
    onChange={(e) => setToDate(e.target.value)}
    className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-sm"
    placeholder="To"
  />
</div>
```

- [ ] **Step 5: Update fetchOrgAuditLog to accept filter params**

In `packages/frontend/lib/data/fetchers/organizations.ts`, modify `fetchOrgAuditLog` to accept and pass through filter query params.

- [ ] **Step 6: Verify and commit**

```bash
git add packages/frontend/app/org/[slug]/admin/audit/ packages/frontend/lib/data/fetchers/organizations.ts
git commit -m "feat: add audit log filter UI — action type, date range"
```

---

## Task 4: Admin Users Page — Org Filter & Sort

**Files:**

- Modify: `packages/backend/src/admin/users/users.controller.ts:22-35`
- Modify: `packages/backend/src/admin/users/users.service.ts:73-107`
- Modify: `packages/frontend/app/admin/entitlements/users/page.tsx`

- [ ] **Step 1: Add backend query params**

In `users.controller.ts`, add `organization_id` and `sort` query params to the `listUsers` endpoint at line 22.

- [ ] **Step 2: Add backend filter logic**

In `users.service.ts` `getUsers()`, after the existing tier filter at line 105:

```typescript
if (options?.organizationId) {
  query = query.eq("organization_id", options.organizationId);
}
```

For sort by organization, the existing `order('created_at')` at line 96 needs to be conditional. If `sort === 'organization'`, order by organization name instead (since org name is joined later, sort after query using JS `.sort()`).

- [ ] **Step 3: Add org list endpoint for filter dropdown**

Add `GET /api/admin/organizations` to the admin users controller that returns `[{ id, name, slug, memberCount }]`. Simple query: `SELECT id, name, slug FROM organizations ORDER BY name`.

- [ ] **Step 4: Add frontend filter dropdown**

In `users/page.tsx`, add an org filter dropdown next to the existing tier filter. Fetch org list on mount. Pass `organization_id` param to the existing `fetchData()` call.

- [ ] **Step 5: Add sortable org column header**

Make the "Organization" column header clickable to toggle sort. Pass `sort=organization` to the backend.

- [ ] **Step 6: Verify and commit**

```bash
git add packages/backend/src/admin/users/ packages/frontend/app/admin/entitlements/users/
git commit -m "feat: admin users page — org filter dropdown and sortable org column"
```

---

## Task 5: Reports Dashboard Card — Backend

**Files:**

- Create: `packages/backend/src/organizations/org-report-stats.service.ts`
- Modify: `packages/backend/src/organizations/organizations.controller.ts` (new endpoint)
- Modify: `packages/backend/src/organizations/organizations.module.ts` (register service)

- [ ] **Step 1: Create OrgReportStatsService**

New file `org-report-stats.service.ts`:

```typescript
@Injectable()
export class OrgReportStatsService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async getStats(orgId: string): Promise<{
    count: number;
    previousCount: number;
    byMember: { userId: string; name: string; count: number }[];
    limit: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toISOString();
    const startOfPrevMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    ).toISOString();

    // Current month count
    const { count: currentCount } = await this.supabase
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", startOfMonth);

    // Previous month count
    const { count: prevCount } = await this.supabase
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", startOfPrevMonth)
      .lt("created_at", startOfMonth);

    // Per-member breakdown (current month)
    const { data: memberData } = await this.supabase
      .from("reports")
      .select("user_id")
      .eq("organization_id", orgId)
      .gte("created_at", startOfMonth);

    // Count per user and join names
    const userCounts = new Map<string, number>();
    (memberData || []).forEach((r) => {
      userCounts.set(r.user_id, (userCounts.get(r.user_id) || 0) + 1);
    });

    const userIds = [...userCounts.keys()];
    const { data: profiles } =
      userIds.length > 0
        ? await this.supabase
            .from("user_profiles")
            .select("id, full_name, email")
            .in("id", userIds)
        : { data: [] };

    const byMember = userIds
      .map((uid) => ({
        userId: uid,
        name:
          (profiles || []).find((p) => p.id === uid)?.full_name ||
          (profiles || []).find((p) => p.id === uid)?.email?.split("@")[0] ||
          "Unknown",
        count: userCounts.get(uid) || 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Report limit (from tier_features, default -1 unlimited)
    // TODO: Query feature_definitions for monthly_report_limit when added
    const limit = -1;

    return {
      count: currentCount || 0,
      previousCount: prevCount || 0,
      byMember,
      limit,
    };
  }
}
```

- [ ] **Step 2: Add endpoint to organizations controller**

```typescript
@Get(':slug/reports/stats')
@UseGuards(JwtAuthGuard, OrgContextGuard, OrgMemberGuard)
async getReportStats(@Req() req: any) {
  return this.reportStatsService.getStats(req.org.id);
}
```

- [ ] **Step 3: Register service in module**

Add `OrgReportStatsService` to providers in `organizations.module.ts`.

- [ ] **Step 4: Verify and commit**

```bash
git add packages/backend/src/organizations/
git commit -m "feat: add GET /api/org/:slug/reports/stats endpoint"
```

---

## Task 6: Reports Dashboard Card — Frontend

**Files:**

- Create: `packages/frontend/lib/data/fetchers/org-reports.ts`
- Modify: `packages/frontend/lib/data/index.ts` (export)
- Modify: `packages/frontend/app/org/components/OrgDashboardCards.tsx`

- [ ] **Step 1: Create fetcher**

New file `org-reports.ts`:

```typescript
import { fetchAPI } from "./base";

export interface OrgReportStats {
  count: number;
  previousCount: number;
  byMember: { userId: string; name: string; count: number }[];
  limit: number;
}

export async function fetchOrgReportStats(
  slug: string,
): Promise<OrgReportStats> {
  return fetchAPI<OrgReportStats>(`/api/org/${slug}/reports/stats`);
}
```

- [ ] **Step 2: Export from data index**

Add `fetchOrgReportStats` and `OrgReportStats` to `lib/data/index.ts`.

- [ ] **Step 3: Replace placeholder in OrgDashboardCards**

Replace the "Reports This Month" placeholder card with real data:

- Call `fetchOrgReportStats(org.slug)` in the `useEffect` alongside other fetches
- Show count as big number, trend arrow comparing `count` vs `previousCount`
- Show top 3 members below count
- Show progress bar if `limit > 0` (not unlimited)

Follow the existing card pattern: icon + label header, big number, sub-content.

- [ ] **Step 4: Verify and commit**

```bash
git add packages/frontend/lib/data/fetchers/org-reports.ts packages/frontend/lib/data/index.ts packages/frontend/app/org/components/OrgDashboardCards.tsx
git commit -m "feat: replace reports placeholder with live dashboard card — count, trend, per-member"
```

---

## Task 7: Delete Organization — Backend

**Files:**

- Modify: `packages/backend/src/admin/users/users.controller.ts`
- Modify: `packages/backend/src/admin/users/users.service.ts`

- [ ] **Step 1: Add deleteOrg method to users service**

```typescript
async deleteOrganization(orgId: string): Promise<void> {
  const client = this.supabase.getClient();

  // 1. Get all member user IDs before cascade deletes them
  const { data: members } = await client
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId);

  const memberUserIds = (members || []).map(m => m.user_id);

  // 2. Clear organization_id and organization_role on member profiles
  if (memberUserIds.length > 0) {
    await client
      .from('user_profiles')
      .update({ organization_id: null, organization_role: null, updated_at: new Date().toISOString() })
      .in('id', memberUserIds);
  }

  // 3. Delete org row (FK CASCADE handles members, invites, api_keys, embed_tokens, audit_log)
  // Reports.organization_id is ON DELETE SET NULL — reports survive
  const { error } = await client
    .from('organizations')
    .delete()
    .eq('id', orgId);

  if (error) {
    this.logger.error(`Failed to delete organization ${orgId}: ${error.message}`);
    throw new BadRequestException('Failed to delete organization');
  }

  this.logger.log(`Deleted organization ${orgId}, cleared ${memberUserIds.length} member profiles`);
}
```

- [ ] **Step 2: Add controller endpoint**

```typescript
@Delete('org/:orgId')
@UseGuards(JwtAuthGuard, AdminGuard)
async deleteOrg(@Param('orgId') orgId: string) {
  await this.usersService.deleteOrganization(orgId);
  return { success: true };
}
```

- [ ] **Step 3: Verify and commit**

```bash
git add packages/backend/src/admin/users/
git commit -m "feat: add DELETE /api/admin/org/:orgId endpoint for platform admins"
```

---

## Task 8: Delete Organization — Frontend

**Files:**

- Modify: `packages/frontend/app/admin/entitlements/users/page.tsx`

- [ ] **Step 1: Add delete org handler**

Add a `handleDeleteOrg` function that calls `fetchAPIRaw('/api/admin/org/${orgId}', { method: 'DELETE' })` with a confirmation dialog.

- [ ] **Step 2: Add delete button in user detail card**

When a user has an `organizationId`, show a "Delete Org" button that triggers the confirmation dialog. Dialog text: "This will remove all members, API keys, and embed tokens. Reports are preserved."

- [ ] **Step 3: Verify and commit**

```bash
git add packages/frontend/app/admin/entitlements/users/
git commit -m "feat: add delete org button in admin user detail card"
```

---

## Task 9: Rename Organization — DB Migration

**Files:**

- Create: `scripts/migrations/118-organization-slug-redirects.sql`

- [ ] **Step 1: Write migration**

```sql
-- Migration 118: Organization slug redirects for 30-day redirect after rename

BEGIN;

CREATE TABLE IF NOT EXISTS organization_slug_redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  old_slug TEXT NOT NULL,
  new_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Only one active redirect per old slug at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_slug_redirects_active
  ON organization_slug_redirects(old_slug)
  WHERE expires_at > now();

-- Fast lookup by old slug
CREATE INDEX IF NOT EXISTS idx_slug_redirects_lookup
  ON organization_slug_redirects(old_slug, expires_at DESC);

-- Grants
GRANT ALL ON organization_slug_redirects TO service_role;
GRANT SELECT ON organization_slug_redirects TO authenticated;

COMMIT;
```

- [ ] **Step 2: Run migration via Supabase MCP**

Execute the SQL via `mcp__plugin_supabase_supabase__execute_sql`.

- [ ] **Step 3: Commit migration file**

```bash
git add scripts/migrations/118-organization-slug-redirects.sql
git commit -m "feat: add organization_slug_redirects table for 30-day slug redirect"
```

---

## Task 10: Rename Organization — Backend

**Files:**

- Modify: `packages/backend/src/organizations/dto/update-organization.dto.ts`
- Modify: `packages/backend/src/organizations/organizations.service.ts:181-219` (update method)
- Modify: `packages/backend/src/organizations/organizations.controller.ts` (add resolve-slug endpoint)

- [ ] **Step 1: Add slug to UpdateOrganizationDto**

```typescript
@IsOptional()
@IsString()
@MaxLength(50)
@Matches(/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/, {
  message: 'Slug must start and end with alphanumeric, contain only lowercase letters, numbers, and hyphens',
})
slug?: string;
```

- [ ] **Step 2: Add slug change logic to update() method**

Before the existing update query at line 193, if `dto.slug` is provided and different from current:

1. Validate against reserved slugs list
2. Check uniqueness against `organizations` table
3. Check uniqueness against active `organization_slug_redirects`
4. Expire any existing active redirects for the old slug
5. Insert redirect row: `old_slug → new_slug`, expires in 30 days
6. Include `slug` in the update payload

- [ ] **Step 3: Add resolve-slug endpoint**

```typescript
@Get('resolve-slug/:slug')
async resolveSlug(@Param('slug') slug: string) {
  const { data } = await this.supabase
    .from('organization_slug_redirects')
    .select('new_slug')
    .eq('old_slug', slug)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!data) throw new NotFoundException();
  return { redirect: data.new_slug };
}
```

**Important:** This endpoint must be placed BEFORE the `:slug` param route to avoid route conflicts. Place it right after the `mine` route.

- [ ] **Step 4: Verify and commit**

```bash
git add packages/backend/src/organizations/
git commit -m "feat: support org slug rename with 30-day redirect"
```

---

## Task 11: Rename Organization — Frontend

**Files:**

- Modify: `packages/frontend/app/org/[slug]/admin/layout.tsx`
- Modify: `packages/frontend/app/org/[slug]/admin/page.tsx`
- Create: `packages/frontend/app/org/[slug]/admin/components/OrgSettingsSection.tsx`

- [ ] **Step 1: Add redirect check to layout**

In `layout.tsx`, before `OrgContextProvider`, add a server-side check:

```typescript
// Check if this slug has a redirect
const resolveRes = await fetch(
  `${process.env.NEXT_PUBLIC_API_URL}/api/org/resolve-slug/${slug}`,
);
if (resolveRes.ok) {
  const { redirect } = await resolveRes.json();
  redirect(`/org/${redirect}/admin`);
}
```

Since this is a Server Component layout, use Next.js `redirect()` from `next/navigation`.

- [ ] **Step 2: Create OrgSettingsSection component**

New component with name and slug editing:

- Name input (pre-filled)
- Slug input (pre-filled) with live URL preview
- Save button
- Confirmation dialog for slug changes warning about URL change
- Calls `updateOrganization(slug, { name, slug: newSlug })`

- [ ] **Step 3: Add settings section to dashboard**

In `page.tsx`, add `OrgSettingsSection` below the dashboard cards.

- [ ] **Step 4: Verify and commit**

```bash
git add packages/frontend/app/org/[slug]/admin/
git commit -m "feat: org rename UI with slug change, live preview, and 30-day redirect"
```

---

## Task 12: Enterprise Downgrade — Backend

**Files:**

- Modify: `packages/backend/src/org-billing/org-billing-webhook.service.ts:150-165`
- Create: `packages/backend/src/org-billing/org-downgrade-handler.service.ts`
- Modify: `packages/backend/src/org-billing/org-billing.module.ts`

- [ ] **Step 1: Create OrgDowngradeHandlerService**

Handles the full downgrade flow:

```typescript
@Injectable()
export class OrgDowngradeHandlerService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly auditService: OrgAuditService,
    private readonly emailService: EmailService, // existing Resend service
  ) {}

  async handleDowngrade(orgId: string, newTier: string): Promise<void> {
    // 1. Revoke enterprise features
    await this.supabase
      .from("organizations")
      .update({
        api_enabled: false,
        embed_enabled: false,
        billing_status: newTier === "free" ? "canceled" : "active",
      })
      .eq("id", orgId);

    // 2. Get org details + owner
    const { data: org } = await this.supabase
      .from("organizations")
      .select("id, name, owner_id")
      .eq("id", orgId)
      .single();

    // 3. Get all non-owner members
    const { data: members } = await this.supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .neq("user_id", org.owner_id);

    const memberIds = (members || []).map((m) => m.user_id);

    // 4. Downgrade all sub-users to free tier
    if (memberIds.length > 0) {
      await this.supabase
        .from("user_profiles")
        .update({
          subscription_tier: "free",
          organization_id: null,
          organization_role: null,
        })
        .in("id", memberIds);

      // 5. Remove members from org
      await this.supabase
        .from("organization_members")
        .delete()
        .eq("organization_id", orgId)
        .neq("user_id", org.owner_id);
    }

    // 6. Update owner tier
    await this.supabase
      .from("user_profiles")
      .update({ subscription_tier: newTier })
      .eq("id", org.owner_id);

    // 7. Audit log
    await this.auditService.log({
      organizationId: orgId,
      actorId: org.owner_id,
      action: "org_downgraded",
      targetType: "organization",
      targetId: orgId,
      details: { newTier, membersRemoved: memberIds.length },
    });

    // 8. Queue emails (fire-and-forget)
    this.sendDowngradeEmails(orgId, org.name, memberIds).catch((err) =>
      this.logger.warn(`Failed to send downgrade emails: ${err}`),
    );
  }

  private async sendDowngradeEmails(
    orgId: string,
    orgName: string,
    memberIds: string[],
  ) {
    // Fetch member emails
    const { data: profiles } = await this.supabase
      .from("user_profiles")
      .select("email, full_name")
      .in("id", memberIds);

    for (const profile of profiles || []) {
      await this.emailService.send({
        to: profile.email,
        subject: "Your enterprise team account has changed",
        // Use existing email template pattern
        html: this.buildDowngradeEmail(
          orgName,
          profile.full_name || profile.email,
        ),
      });
    }
  }

  private buildDowngradeEmail(orgName: string, userName: string): string {
    // Simple HTML email — can be replaced with React Email later
    return `<p>Hi ${userName},</p>
      <p>The enterprise account for <strong>${orgName}</strong> has been downgraded.
      Your account has been moved to the free tier.</p>
      <p>To continue with premium features:</p>
      <ul>
        <li><a href="https://www.propertyiq.app/pricing?plan=enterprise">Start your own Enterprise account</a></li>
        <li><a href="https://www.propertyiq.app/pricing?plan=pro">Upgrade to Pro</a></li>
      </ul>`;
  }
}
```

- [ ] **Step 2: Wire into webhook handler**

In `org-billing-webhook.service.ts`, in the `handleSubscriptionUpdated` method at line 150, detect tier downgrade:

```typescript
// After existing logic, check if enterprise plan was removed
const currentPlanId = subscription.items.data[0]?.price.id;
const enterprisePriceId = await this.billingService.getEnterprisePriceId();

if (currentPlanId !== enterprisePriceId && org.billing_status === "active") {
  // Downgrade detected
  const newTier = this.determineTierFromPriceId(currentPlanId);
  await this.downgradeHandler.handleDowngrade(org.id, newTier);
}
```

- [ ] **Step 3: Add org_downgraded to AuditAction type**

In `org-audit.service.ts`, add `'org_downgraded'` to the `AuditAction` type union.

- [ ] **Step 4: Register service in module and verify**

```bash
git add packages/backend/src/org-billing/ packages/backend/src/org-audit/
git commit -m "feat: enterprise downgrade handler — revoke features, free sub-users, email notifications"
```

---

## Task 13: Enterprise Downgrade — Improved Billing UI

**Files:**

- Modify: `packages/frontend/app/org/[slug]/admin/billing/page.tsx`

- [ ] **Step 1: Add plan display section**

Above the existing "Manage Billing" button, add a plan comparison section showing:

- Current plan name (highlighted)
- Other available plans with prices
- "Switch to X" buttons that open Stripe portal with `flow_data.type: 'subscription_update'`

- [ ] **Step 2: Add billing context**

Show above the portal button: current plan name, next billing date, amount per month, seat count.

- [ ] **Step 3: Update portal session call**

Modify `createOrgBillingPortal` to accept an optional `flowType` param. When `flowType === 'subscription_update'`, pass `flow_data: { type: 'subscription_update' }` to the Stripe portal session creation.

- [ ] **Step 4: Verify and commit**

```bash
git add packages/frontend/app/org/[slug]/admin/billing/ packages/backend/src/org-billing/
git commit -m "feat: improved billing page — plan display, switch buttons, Stripe portal integration"
```

---

## Task 14: SQL Migration — Report Quota Feature Definition

**Files:**

- SQL migration (run via Supabase MCP)

- [ ] **Step 1: Insert feature definition and tier values**

```sql
-- Add monthly_report_limit feature
INSERT INTO feature_definitions (slug, name, description, category, value_type)
VALUES ('monthly_report_limit', 'Monthly Report Limit', 'Maximum reports per month', 'usage', 'number')
ON CONFLICT (slug) DO NOTHING;

-- Set tier values
INSERT INTO tier_features (tier_id, feature_id, value)
SELECT st.id, fd.id,
  CASE st.slug
    WHEN 'free' THEN '3'
    WHEN 'pro' THEN '10'
    WHEN 'enterprise' THEN '-1'
    WHEN 'admin' THEN '-1'
  END
FROM subscription_tiers st
CROSS JOIN feature_definitions fd
WHERE fd.slug = 'monthly_report_limit'
  AND st.slug IN ('free', 'pro', 'enterprise', 'admin')
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Run via Supabase MCP and commit**

```bash
git add scripts/migrations/
git commit -m "feat: add monthly_report_limit feature definition with tier values"
```

---

## Summary

| Task  | Feature                | Scope                          |
| ----- | ---------------------- | ------------------------------ |
| 1     | Auto-enable flags      | Backend only (5 min)           |
| 2-3   | Audit log filters      | Backend + Frontend             |
| 4     | Admin org filter/sort  | Backend + Frontend             |
| 5-6   | Reports dashboard card | Backend + Frontend             |
| 7-8   | Delete org             | Backend + Frontend             |
| 9-11  | Rename org + redirect  | Migration + Backend + Frontend |
| 12-13 | Downgrade + billing UI | Backend + Frontend             |
| 14    | Report quota migration | SQL only                       |

**Total: 14 tasks, independently committable.**

After each commit, push to `develop`. After all tasks pass, push to `main` for production deploy.
