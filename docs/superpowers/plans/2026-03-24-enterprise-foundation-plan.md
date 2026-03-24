# Enterprise Foundation Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the enterprise org foundation — database tables, RLS policies, NestJS modules for org CRUD, member management, invite flow, Stripe per-seat billing, and the frontend admin portal (dashboard, members, billing pages).

**Architecture:** Monolith extension. New NestJS modules (`organizations`, `org-billing`, `org-audit`) added to the existing backend. New Next.js routes under `/org/[slug]/admin/*` for the enterprise admin portal. Stripe per-seat subscription with 10 included seats.

**Spec:** `docs/superpowers/specs/2026-03-24-enterprise-features-design.md`

**Tech Stack:** NestJS (guards, DTOs, DI), Supabase (Postgres, RLS, Storage), Stripe (Checkout, subscriptions, webhooks), Resend (invite emails), React Query, Tailwind CSS (M3 design tokens).

**Depends on:** Nothing (this is the foundation).

**Followed by:** Plan 2 (Branding & Embeds), Plan 3 (Platform API).

---

## File Structure

### Backend — New Files

| File                                                                | Responsibility                           |
| ------------------------------------------------------------------- | ---------------------------------------- |
| `packages/backend/src/organizations/organizations.module.ts`        | Module registration                      |
| `packages/backend/src/organizations/organizations.controller.ts`    | Org CRUD endpoints                       |
| `packages/backend/src/organizations/organizations.service.ts`       | Org business logic                       |
| `packages/backend/src/organizations/members.controller.ts`          | Member list, invite, role change, remove |
| `packages/backend/src/organizations/members.service.ts`             | Member business logic + Resend invite    |
| `packages/backend/src/organizations/invites.controller.ts`          | Invite acceptance endpoint               |
| `packages/backend/src/organizations/invites.service.ts`             | Invite validation + acceptance logic     |
| `packages/backend/src/organizations/org-context.middleware.ts`      | Resolves org from user's membership      |
| `packages/backend/src/organizations/guards/org-admin.guard.ts`      | Ensures user is org admin                |
| `packages/backend/src/organizations/guards/org-member.guard.ts`     | Ensures user is org member               |
| `packages/backend/src/organizations/dto/create-organization.dto.ts` | Org creation DTO                         |
| `packages/backend/src/organizations/dto/update-organization.dto.ts` | Org update DTO                           |
| `packages/backend/src/organizations/dto/invite-member.dto.ts`       | Invite DTO                               |
| `packages/backend/src/organizations/dto/update-member-role.dto.ts`  | Role change DTO                          |
| `packages/backend/src/org-billing/org-billing.module.ts`            | Billing module registration              |
| `packages/backend/src/org-billing/org-billing.controller.ts`        | Checkout, portal, seats endpoints        |
| `packages/backend/src/org-billing/org-billing.service.ts`           | Stripe subscription logic                |
| `packages/backend/src/org-billing/org-billing-webhook.service.ts`   | Org-specific Stripe webhook handler      |
| `packages/backend/src/org-audit/org-audit.module.ts`                | Audit module registration                |
| `packages/backend/src/org-audit/org-audit.service.ts`               | Write audit entries                      |
| `packages/backend/src/org-audit/org-audit.controller.ts`            | Query audit log (admin only)             |
| `scripts/migrations/117-enterprise-tables.sql`                      | All new tables, RLS, indexes, functions  |

### Backend — Modified Files

| File                                                      | Change                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| `packages/backend/src/app.module.ts`                      | Import OrganizationsModule, OrgBillingModule, OrgAuditModule |
| `packages/backend/src/billing/billing-webhook.service.ts` | Route org-specific events to OrgBillingWebhookService        |

### Frontend — New Files

| File                                                          | Responsibility                      |
| ------------------------------------------------------------- | ----------------------------------- |
| `packages/frontend/app/org/[slug]/admin/layout.tsx`           | Admin shell: sidebar + org context  |
| `packages/frontend/app/org/[slug]/admin/page.tsx`             | Dashboard overview                  |
| `packages/frontend/app/org/[slug]/admin/members/page.tsx`     | Member list + invite flow           |
| `packages/frontend/app/org/[slug]/admin/billing/page.tsx`     | Seat count, invoices, Stripe portal |
| `packages/frontend/app/org/invite/[token]/page.tsx`           | Invite acceptance page              |
| `packages/frontend/app/org/components/OrgAdminSidebar.tsx`    | M3 Navigation Drawer                |
| `packages/frontend/app/org/components/OrgContextProvider.tsx` | React context: org + role           |
| `packages/frontend/app/org/components/OrgGuard.tsx`           | Redirect non-admins                 |
| `packages/frontend/app/org/components/MemberTable.tsx`        | Sortable member list                |
| `packages/frontend/app/org/components/InviteMemberDialog.tsx` | Email + role picker dialog          |
| `packages/frontend/app/org/components/SeatUsageBar.tsx`       | Visual seat usage indicator         |
| `packages/frontend/app/org/components/OrgDashboardCards.tsx`  | Overview stats cards                |
| `packages/frontend/app/org/hooks/useOrg.ts`                   | Org context hook                    |
| `packages/frontend/app/org/hooks/useOrgMembers.ts`            | React Query: member list            |
| `packages/frontend/app/org/hooks/useOrgBilling.ts`            | React Query: billing state          |
| `packages/frontend/lib/data/fetchers/organizations.ts`        | Org API calls                       |
| `packages/frontend/lib/data/fetchers/org-billing.ts`          | Billing API calls                   |

### Frontend — Modified Files

| File                                  | Change              |
| ------------------------------------- | ------------------- |
| `packages/frontend/lib/data/index.ts` | Export org fetchers |

### Test Files

| File                                                             | What It Tests                              |
| ---------------------------------------------------------------- | ------------------------------------------ |
| `packages/backend/test/enterprise/setup/seed-test-org.ts`        | Creates test org, members, keys in real DB |
| `packages/backend/test/enterprise/setup/stripe-test-helpers.ts`  | Stripe test-mode helpers                   |
| `packages/backend/test/enterprise/setup/cleanup.ts`              | Tears down test data                       |
| `packages/backend/test/enterprise/organizations.e2e-spec.ts`     | Org CRUD lifecycle                         |
| `packages/backend/test/enterprise/members.e2e-spec.ts`           | Invite → accept → role → remove            |
| `packages/backend/test/enterprise/billing.e2e-spec.ts`           | Checkout → seats → webhooks                |
| `packages/backend/test/enterprise/rls-policies.e2e-spec.ts`      | RLS enforcement per role                   |
| `packages/frontend/test/enterprise/org-admin-portal.e2e-spec.ts` | Playwright: admin portal flows             |

---

## Task 1: Database Migration — Tables, RLS, Indexes, Functions

Create all enterprise database objects in a single migration file. This is the foundation everything else builds on.

**Files:**

- Create: `scripts/migrations/117-enterprise-tables.sql`

**Reference:** Spec Section 1 (Data Model) for complete SQL

- [ ] **Step 1: Create migration file with all enterprise tables**

Create `scripts/migrations/117-enterprise-tables.sql` with the full SQL from the spec:

- `ALTER TABLE organizations` — add enterprise columns (owner_id, accent_color, seat_limit, extra_seats, billing_status, stripe_customer_id, stripe_subscription_id, api_enabled, embed_enabled)
- `CREATE TABLE organization_members` — with unique constraint + single-org index
- `CREATE TABLE organization_invites` — with token unique constraint
- `CREATE TABLE organization_api_keys` — with key_hash index
- `CREATE TABLE organization_embed_tokens` — with token index
- `CREATE TABLE organization_audit_log` — with org+created_at index
- `ALTER TABLE reports ADD CONSTRAINT fk_reports_organization` — FK if missing
- All RLS policies from spec Section 1
- All GRANT statements for service_role and authenticated
- `invite_org_member()` Postgres function for atomic seat check

Copy the exact SQL from spec Section 1 — it has the complete migration.

- [ ] **Step 2: Run migration against Supabase**

Run the migration SQL against the Supabase project:

```bash
cd scripts && node -e "
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const sql = fs.readFileSync('migrations/117-enterprise-tables.sql', 'utf-8');
const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.rpc('exec_sql', { sql_text: sql }).then(r => console.log(r.error ? 'FAIL: ' + r.error.message : 'OK'));
"
```

If `exec_sql` is not available, run the SQL directly via the Supabase Dashboard SQL Editor or `psql`.

Expected: All tables created, RLS enabled, indexes created, no errors.

- [ ] **Step 3: Verify tables exist**

```bash
cd packages/backend && npx ts-node -e "
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
async function check() {
  for (const t of ['organization_members','organization_invites','organization_api_keys','organization_embed_tokens','organization_audit_log']) {
    const { error } = await sb.from(t).select('id').limit(0);
    console.log(t, error ? 'FAIL: '+error.message : 'OK');
  }
}
check();
"
```

Expected: All tables return OK.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrations/117-enterprise-tables.sql
git commit -m "feat: add enterprise database tables, RLS policies, and indexes"
```

---

## Task 2: Test Infrastructure — Seed, Helpers, Cleanup

Set up the live data test infrastructure before writing any business logic.

**Files:**

- Create: `packages/backend/test/enterprise/setup/seed-test-org.ts`
- Create: `packages/backend/test/enterprise/setup/stripe-test-helpers.ts`
- Create: `packages/backend/test/enterprise/setup/cleanup.ts`

- [ ] **Step 1: Create test seed utility**

```typescript
// packages/backend/test/enterprise/setup/seed-test-org.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export interface TestOrgFixture {
  org: { id: string; slug: string; name: string };
  adminUser: { id: string; email: string; accessToken: string };
  memberUser: { id: string; email: string; accessToken: string };
  outsiderUser: { id: string; email: string; accessToken: string };
  supabase: SupabaseClient;
}

const TEST_ORG_SLUG = "test-brokerage-e2e";
const TEST_PASSWORD = "TestPassword123!";

export async function seedTestOrg(): Promise<TestOrgFixture> {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey)
    throw new Error("Missing Supabase env vars");

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Clean up any previous test data
  await cleanupTestOrg(supabase);

  // Create test users in Supabase Auth
  const adminUser = await createTestUser(
    supabase,
    `admin-${randomUUID().slice(0, 8)}@test-brokerage.propertyiq-test.com`,
  );
  const memberUser = await createTestUser(
    supabase,
    `member-${randomUUID().slice(0, 8)}@test-brokerage.propertyiq-test.com`,
  );
  const outsiderUser = await createTestUser(
    supabase,
    `outsider-${randomUUID().slice(0, 8)}@other-company.propertyiq-test.com`,
  );

  // Create test org
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: "Test Brokerage LLC",
      slug: TEST_ORG_SLUG,
      owner_id: adminUser.id,
      accent_color: "#2563eb",
      seat_limit: 10,
      extra_seats: 0,
      billing_status: "active",
      api_enabled: true,
      embed_enabled: true,
    })
    .select("id, slug, name")
    .single();

  if (orgError)
    throw new Error(`Failed to create test org: ${orgError.message}`);

  // Add admin member
  await supabase.from("organization_members").insert({
    organization_id: org.id,
    user_id: adminUser.id,
    role: "admin",
    invited_by: adminUser.id,
    joined_at: new Date().toISOString(),
    status: "active",
  });

  // Add regular member
  await supabase.from("organization_members").insert({
    organization_id: org.id,
    user_id: memberUser.id,
    role: "member",
    invited_by: adminUser.id,
    joined_at: new Date().toISOString(),
    status: "active",
  });

  return { org, adminUser, memberUser, outsiderUser, supabase };
}

async function createTestUser(
  supabase: SupabaseClient,
  email: string,
): Promise<{ id: string; email: string; accessToken: string }> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error)
    throw new Error(`Failed to create test user ${email}: ${error.message}`);

  // Sign in to get access token
  const { data: session, error: signInError } =
    await supabase.auth.signInWithPassword({
      email,
      password: TEST_PASSWORD,
    });
  if (signInError)
    throw new Error(`Failed to sign in ${email}: ${signInError.message}`);

  return {
    id: data.user.id,
    email,
    accessToken: session.session!.access_token,
  };
}

async function cleanupTestOrg(supabase: SupabaseClient): Promise<void> {
  // Delete org by slug (cascades to members, invites, etc.)
  const { data: existingOrg } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", TEST_ORG_SLUG)
    .maybeSingle();

  if (existingOrg) {
    await supabase.from("organizations").delete().eq("id", existingOrg.id);
  }

  // Clean up test auth users
  const { data: users } = await supabase.auth.admin.listUsers();
  if (users?.users) {
    for (const user of users.users) {
      if (user.email?.endsWith(".propertyiq-test.com")) {
        await supabase.auth.admin.deleteUser(user.id);
      }
    }
  }
}

export { cleanupTestOrg, TEST_ORG_SLUG };
```

- [ ] **Step 2: Create Stripe test helpers**

```typescript
// packages/backend/test/enterprise/setup/stripe-test-helpers.ts
import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getTestStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || !key.startsWith("sk_test_")) {
      throw new Error("STRIPE_SECRET_KEY must be a test key (sk_test_...)");
    }
    stripe = new Stripe(key);
  }
  return stripe;
}

export async function createTestCustomer(
  email: string,
): Promise<Stripe.Customer> {
  const s = getTestStripe();
  return s.customers.create({ email, metadata: { test: "true" } });
}

export async function createTestSubscription(
  customerId: string,
  priceId: string,
): Promise<Stripe.Subscription> {
  const s = getTestStripe();
  return s.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: "default_incomplete",
  });
}

export async function constructTestWebhookEvent(
  payload: Record<string, unknown>,
  eventType: string,
): Promise<Stripe.Event> {
  // For testing, construct a mock-like event with real structure
  return {
    id: `evt_test_${Date.now()}`,
    type: eventType,
    data: { object: payload },
    object: "event",
    api_version: "2024-06-20",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as unknown as Stripe.Event;
}

export async function cleanupTestStripeCustomers(): Promise<void> {
  const s = getTestStripe();
  const customers = await s.customers.list({ limit: 100 });
  for (const customer of customers.data) {
    if (customer.metadata?.test === "true") {
      await s.customers.del(customer.id);
    }
  }
}
```

- [ ] **Step 3: Create cleanup utility**

```typescript
// packages/backend/test/enterprise/setup/cleanup.ts
import { cleanupTestOrg, TEST_ORG_SLUG } from "./seed-test-org";
import { cleanupTestStripeCustomers } from "./stripe-test-helpers";
import { createClient } from "@supabase/supabase-js";

export async function cleanupAll(): Promise<void> {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await cleanupTestOrg(supabase);
  await cleanupTestStripeCustomers().catch(() => {});
}
```

- [ ] **Step 4: Verify seed runs against real Supabase**

```bash
cd packages/backend && npx ts-node -e "
const { seedTestOrg, cleanupTestOrg } = require('./test/enterprise/setup/seed-test-org');
seedTestOrg().then(f => {
  console.log('Org:', f.org.slug);
  console.log('Admin:', f.adminUser.email);
  console.log('Member:', f.memberUser.email);
  console.log('Outsider:', f.outsiderUser.email);
  return cleanupTestOrg(f.supabase);
}).then(() => console.log('Cleanup OK')).catch(e => console.error('FAIL:', e.message));
"
```

Expected: Org created, users created, cleanup succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/test/enterprise/
git commit -m "test: add enterprise test infrastructure — seed, stripe helpers, cleanup"
```

---

## Task 3: Org Audit Service

Build the audit logger first since every subsequent module will use it.

**Files:**

- Create: `packages/backend/src/org-audit/org-audit.module.ts`
- Create: `packages/backend/src/org-audit/org-audit.service.ts`
- Create: `packages/backend/src/org-audit/org-audit.controller.ts`

- [ ] **Step 1: Create audit service**

```typescript
// packages/backend/src/org-audit/org-audit.service.ts
import { Injectable, Logger, Inject } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase.service";

export type AuditAction =
  | "org_created"
  | "org_updated"
  | "member_invited"
  | "member_joined"
  | "member_removed"
  | "role_changed"
  | "seats_updated"
  | "billing_status_changed"
  | "api_key_created"
  | "api_key_revoked"
  | "embed_token_created"
  | "embed_token_revoked"
  | "branding_updated"
  | "logo_uploaded"
  | "logo_removed"
  | "ownership_transferred";

export type AuditTargetType =
  | "organization"
  | "member"
  | "invite"
  | "api_key"
  | "embed_token"
  | "branding"
  | "billing";

@Injectable()
export class OrgAuditService {
  private readonly logger = new Logger(OrgAuditService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async log(params: {
    organizationId: string;
    actorId: string;
    action: AuditAction;
    targetType: AuditTargetType;
    targetId?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    const { error } = await this.supabase
      .from("organization_audit_log")
      .insert({
        organization_id: params.organizationId,
        actor_id: params.actorId,
        action: params.action,
        target_type: params.targetType,
        target_id: params.targetId || null,
        details: params.details || null,
      });

    if (error) {
      this.logger.error(`Failed to write audit log: ${error.message}`, {
        ...params,
      });
      // Don't throw — audit logging should never break business operations
    }
  }

  async query(params: {
    organizationId: string;
    cursor?: string;
    limit?: number;
    action?: AuditAction;
    targetType?: AuditTargetType;
  }): Promise<{ entries: any[]; nextCursor: string | null }> {
    const limit = Math.min(params.limit || 50, 100);

    let query = this.supabase
      .from("organization_audit_log")
      .select("*")
      .eq("organization_id", params.organizationId)
      .order("created_at", { ascending: false })
      .limit(limit + 1); // Fetch one extra for cursor

    if (params.action) {
      query = query.eq("action", params.action);
    }
    if (params.targetType) {
      query = query.eq("target_type", params.targetType);
    }
    if (params.cursor) {
      query = query.lt("created_at", params.cursor);
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`Failed to query audit log: ${error.message}`);
      return { entries: [], nextCursor: null };
    }

    const hasMore = (data?.length || 0) > limit;
    const entries = data?.slice(0, limit) || [];
    const nextCursor = hasMore ? entries[entries.length - 1]?.created_at : null;

    return { entries, nextCursor };
  }
}
```

- [ ] **Step 2: Create audit controller**

```typescript
// packages/backend/src/org-audit/org-audit.controller.ts
import { Controller, Get, Query, UseGuards, Req } from "@nestjs/common";
import {
  OrgAuditService,
  AuditAction,
  AuditTargetType,
} from "./org-audit.service";

// NOTE: Guards will be added in Task 4 after they're created.
// For now, use JwtAuthGuard. OrgAdminGuard will be wired in Task 4.

@Controller("api/org/:slug/audit")
export class OrgAuditController {
  constructor(private readonly auditService: OrgAuditService) {}

  @Get()
  async getAuditLog(
    @Req() req: any,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
    @Query("action") action?: string,
    @Query("target_type") targetType?: string,
  ) {
    const orgId = req.org?.id;
    if (!orgId) {
      return { entries: [], nextCursor: null };
    }

    return this.auditService.query({
      organizationId: orgId,
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
      action: action as AuditAction,
      targetType: targetType as AuditTargetType,
    });
  }
}
```

- [ ] **Step 3: Create audit module**

```typescript
// packages/backend/src/org-audit/org-audit.module.ts
import { Module } from "@nestjs/common";
import { SupabaseModule } from "../supabase/supabase.module";
import { OrgAuditService } from "./org-audit.service";
import { OrgAuditController } from "./org-audit.controller";

@Module({
  imports: [SupabaseModule],
  providers: [OrgAuditService],
  controllers: [OrgAuditController],
  exports: [OrgAuditService],
})
export class OrgAuditModule {}
```

- [ ] **Step 4: Verify build**

```bash
cd packages/backend && npx nest build 2>&1 | tail -5
```

Expected: No compile errors.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/org-audit/
git commit -m "feat: add org audit service for enterprise action logging"
```

---

## Task 4: Org Guards (NOT Middleware — Guard Chain Pattern)

**CRITICAL ARCHITECTURE NOTE:** NestJS middleware runs BEFORE guards. A middleware CANNOT depend on `request.userId` set by `JwtAuthGuard`. The solution: make org context resolution a GUARD (not middleware) that runs in the guard chain AFTER `JwtAuthGuard`. Controllers use a 3-guard chain: `@UseGuards(JwtAuthGuard, OrgContextGuard, OrgAdminGuard)`.

Create the org context guard and role guards that all org endpoints depend on. **Do NOT create middleware** — create `OrgContextGuard` instead. The `OrgContextGuard` skips known non-slug paths (`billing`, `invite`) to avoid unnecessary DB queries on checkout and invite endpoints.

**Files:**

- Create: `packages/backend/src/organizations/guards/org-context.guard.ts`
- Create: `packages/backend/src/organizations/guards/org-admin.guard.ts`
- Create: `packages/backend/src/organizations/guards/org-member.guard.ts`

- [ ] **Step 1: Create org context middleware**

```typescript
// packages/backend/src/organizations/org-context.middleware.ts
import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { SupabaseService } from "../supabase/supabase.service";

/**
 * Resolves the org context for the authenticated user.
 * Runs on all /api/org/* routes AFTER JwtAuthGuard sets request.userId.
 * Attaches: request.org (org record), request.orgRole ('admin' | 'member')
 */
@Injectable()
export class OrgContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(OrgContextMiddleware.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async use(
    req: Request & { userId?: string; org?: any; orgRole?: string },
    _res: Response,
    next: NextFunction,
  ) {
    const userId = req.userId;
    if (!userId) {
      return next(); // No auth — guards will handle rejection
    }

    // Extract slug from URL: /api/org/:slug/...
    const slugMatch = req.path.match(/^\/api\/org\/([^/]+)/);
    if (!slugMatch) {
      return next();
    }
    const slug = slugMatch[1];

    try {
      const client = this.supabaseService.getClient();

      // Get org by slug
      const { data: org, error: orgError } = await client
        .from("organizations")
        .select(
          "id, name, slug, owner_id, seat_limit, extra_seats, billing_status, api_enabled, embed_enabled",
        )
        .eq("slug", slug)
        .single();

      if (orgError || !org) {
        return next(); // Org not found — controller will handle 404
      }

      // Get user's membership
      const { data: membership } = await client
        .from("organization_members")
        .select("role, status")
        .eq("organization_id", org.id)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();

      if (membership) {
        req.org = org;
        req.orgRole = membership.role;
      }
    } catch (err) {
      this.logger.error(`OrgContext error: ${err}`);
    }

    next();
  }
}
```

- [ ] **Step 2: Create org admin guard**

```typescript
// packages/backend/src/organizations/guards/org-admin.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "../../supabase/supabase.service";

@Injectable()
export class OrgAdminGuard implements CanActivate {
  private readonly jwtAuthGuard: JwtAuthGuard;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    this.jwtAuthGuard = new JwtAuthGuard(configService, supabaseService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Step 1: Validate JWT
    await this.jwtAuthGuard.canActivate(context);

    const request = context.switchToHttp().getRequest();

    if (!request.org) {
      throw new NotFoundException("Organization not found");
    }

    if (request.orgRole !== "admin") {
      throw new ForbiddenException("Organization admin access required");
    }

    return true;
  }
}
```

- [ ] **Step 3: Create org member guard**

```typescript
// packages/backend/src/organizations/guards/org-member.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "../../supabase/supabase.service";

@Injectable()
export class OrgMemberGuard implements CanActivate {
  private readonly jwtAuthGuard: JwtAuthGuard;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    this.jwtAuthGuard = new JwtAuthGuard(configService, supabaseService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.jwtAuthGuard.canActivate(context);

    const request = context.switchToHttp().getRequest();

    if (!request.org) {
      throw new NotFoundException("Organization not found");
    }

    if (!request.orgRole) {
      throw new ForbiddenException("Organization membership required");
    }

    return true;
  }
}
```

- [ ] **Step 4: Verify build**

```bash
cd packages/backend && npx nest build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/organizations/org-context.middleware.ts packages/backend/src/organizations/guards/
git commit -m "feat: add org context middleware and role guards"
```

---

## Task 5: Organizations Module — DTOs, Service, Controller

The core org CRUD: create, get, update, transfer ownership.

**Files:**

- Create: `packages/backend/src/organizations/dto/create-organization.dto.ts`
- Create: `packages/backend/src/organizations/dto/update-organization.dto.ts`
- Create: `packages/backend/src/organizations/organizations.service.ts`
- Create: `packages/backend/src/organizations/organizations.controller.ts`
- Create: `packages/backend/src/organizations/organizations.module.ts`
- Modify: `packages/backend/src/app.module.ts`

- [ ] **Step 1: Create DTOs**

```typescript
// packages/backend/src/organizations/dto/create-organization.dto.ts
import { IsString, IsNotEmpty, MaxLength, Matches } from "class-validator";

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: "Slug must be lowercase alphanumeric with hyphens",
  })
  slug: string;
}
```

```typescript
// packages/backend/src/organizations/dto/update-organization.dto.ts
import { IsString, IsOptional, MaxLength, IsUrl } from "class-validator";

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @IsUrl({}, { message: "Must be a valid URL" })
  website_url?: string;
}
```

- [ ] **Step 2: Create organizations service**

```typescript
// packages/backend/src/organizations/organizations.service.ts
import {
  Injectable,
  Logger,
  Inject,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase.service";
import { OrgAuditService } from "../org-audit/org-audit.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly auditService: OrgAuditService,
  ) {}

  async create(dto: CreateOrganizationDto, ownerId: string) {
    // Check slug uniqueness
    const { data: existing } = await this.supabase
      .from("organizations")
      .select("id")
      .eq("slug", dto.slug)
      .maybeSingle();

    if (existing) {
      throw new ConflictException("SLUG_TAKEN");
    }

    // Create org
    const { data: org, error } = await this.supabase
      .from("organizations")
      .insert({
        name: dto.name,
        slug: dto.slug,
        owner_id: ownerId,
        billing_status: "pending",
      })
      .select("id, name, slug, owner_id, billing_status, created_at")
      .single();

    if (error) {
      this.logger.error(`Failed to create org: ${error.message}`);
      throw new BadRequestException("Failed to create organization");
    }

    // Add owner as admin member
    await this.supabase.from("organization_members").insert({
      organization_id: org.id,
      user_id: ownerId,
      role: "admin",
      invited_by: ownerId,
      joined_at: new Date().toISOString(),
      status: "active",
    });

    await this.auditService.log({
      organizationId: org.id,
      actorId: ownerId,
      action: "org_created",
      targetType: "organization",
      targetId: org.id,
      details: { name: dto.name, slug: dto.slug },
    });

    return org;
  }

  async getBySlug(slug: string) {
    const { data, error } = await this.supabase
      .from("organizations")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error || !data) {
      throw new NotFoundException("Organization not found");
    }

    return data;
  }

  async update(orgId: string, dto: UpdateOrganizationDto, actorId: string) {
    const updates: Record<string, unknown> = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.website_url !== undefined) updates.website_url = dto.website_url;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from("organizations")
      .update(updates)
      .eq("id", orgId)
      .select("id, name, slug, website_url, updated_at")
      .single();

    if (error) {
      throw new BadRequestException("Failed to update organization");
    }

    await this.auditService.log({
      organizationId: orgId,
      actorId,
      action: "org_updated",
      targetType: "organization",
      targetId: orgId,
      details: updates,
    });

    return data;
  }

  async transferOwnership(
    orgId: string,
    newOwnerId: string,
    currentOwnerId: string,
  ) {
    // Verify new owner is an admin member
    const { data: membership } = await this.supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", newOwnerId)
      .eq("status", "active")
      .eq("role", "admin")
      .maybeSingle();

    if (!membership) {
      throw new BadRequestException("New owner must be an active admin member");
    }

    const { error } = await this.supabase
      .from("organizations")
      .update({ owner_id: newOwnerId, updated_at: new Date().toISOString() })
      .eq("id", orgId);

    if (error) {
      throw new BadRequestException("Failed to transfer ownership");
    }

    await this.auditService.log({
      organizationId: orgId,
      actorId: currentOwnerId,
      action: "ownership_transferred",
      targetType: "organization",
      targetId: newOwnerId,
      details: { from: currentOwnerId, to: newOwnerId },
    });
  }
}
```

- [ ] **Step 3: Create organizations controller**

```typescript
// packages/backend/src/organizations/organizations.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Req,
  UseGuards,
} from "@nestjs/common";
import { OrganizationsService } from "./organizations.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { OrgAdminGuard } from "./guards/org-admin.guard";
import { OrgMemberGuard } from "./guards/org-member.guard";
import { AuthUserId } from "../common/decorators/auth-user";

@Controller("api/org")
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Body() dto: CreateOrganizationDto,
    @AuthUserId() userId: string,
  ) {
    return this.orgsService.create(dto, userId);
  }

  @UseGuards(OrgMemberGuard)
  @Get(":slug")
  async getOrg(@Param("slug") slug: string) {
    return this.orgsService.getBySlug(slug);
  }

  @UseGuards(OrgAdminGuard)
  @Put(":slug")
  async updateOrg(
    @Req() req: any,
    @Body() dto: UpdateOrganizationDto,
    @AuthUserId() userId: string,
  ) {
    return this.orgsService.update(req.org.id, dto, userId);
  }

  @UseGuards(OrgAdminGuard)
  @Put(":slug/transfer-ownership")
  async transferOwnership(
    @Req() req: any,
    @Body() body: { newOwnerId: string },
    @AuthUserId() userId: string,
  ) {
    await this.orgsService.transferOwnership(
      req.org.id,
      body.newOwnerId,
      userId,
    );
    return { success: true };
  }
}
```

- [ ] **Step 4: Create organizations module with middleware**

```typescript
// packages/backend/src/organizations/organizations.module.ts
import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { SupabaseModule } from "../supabase/supabase.module";
import { OrgAuditModule } from "../org-audit/org-audit.module";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";
import { OrgContextMiddleware } from "./org-context.middleware";
import { OrgAdminGuard } from "./guards/org-admin.guard";
import { OrgMemberGuard } from "./guards/org-member.guard";

@Module({
  imports: [SupabaseModule, OrgAuditModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrgAdminGuard, OrgMemberGuard],
  exports: [OrganizationsService, OrgAdminGuard, OrgMemberGuard],
})
export class OrganizationsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(OrgContextMiddleware).forRoutes("api/org/*");
  }
}
```

- [ ] **Step 5: Register in app.module.ts**

Add to the imports array in `packages/backend/src/app.module.ts`:

```typescript
import { OrganizationsModule } from './organizations/organizations.module';
import { OrgAuditModule } from './org-audit/org-audit.module';

@Module({
  imports: [
    // ... existing imports
    OrganizationsModule,
    OrgAuditModule,
  ],
})
```

- [ ] **Step 6: Verify build**

```bash
cd packages/backend && npx nest build 2>&1 | tail -5
```

- [ ] **Step 7: Write org CRUD e2e tests**

Create `packages/backend/test/enterprise/organizations.e2e-spec.ts` with tests covering:

- Create org with valid data → returns org with slug
- Create org with duplicate slug → 409 SLUG_TAKEN
- Get org as admin → full details returned
- Get org as member → details returned
- Get org as outsider → 403
- Update org as admin → name/website updated
- Update org as member (not admin) → 403
- Transfer ownership to another admin → owner_id updated
- Transfer ownership to non-admin → 400

Each test uses the real seeded test data from `seed-test-org.ts` and makes real HTTP requests to the running backend.

- [ ] **Step 8: Run tests**

```bash
cd packages/backend && npm run test:e2e -- --testPathPattern=enterprise/organizations
```

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add packages/backend/src/organizations/ packages/backend/src/org-audit/ packages/backend/src/app.module.ts packages/backend/test/enterprise/
git commit -m "feat: add organization CRUD with guards, middleware, and audit logging"
```

---

## Task 6: Member Management — Invite, Accept, Role Change, Remove

**Files:**

- Create: `packages/backend/src/organizations/dto/invite-member.dto.ts`
- Create: `packages/backend/src/organizations/dto/update-member-role.dto.ts`
- Create: `packages/backend/src/organizations/members.service.ts`
- Create: `packages/backend/src/organizations/members.controller.ts`
- Create: `packages/backend/src/organizations/invites.service.ts`
- Create: `packages/backend/src/organizations/invites.controller.ts`

**Reference:** Spec Section 2 — Member Management endpoints, Section 1 — `invite_org_member()` Postgres function for atomic seat check.

- [ ] **Step 1: Create DTOs**

`invite-member.dto.ts`: email (IsEmail), role (IsIn ['admin', 'member'])
`update-member-role.dto.ts`: role (IsIn ['admin', 'member'])

- [ ] **Step 2: Create members service**

Key methods:

- `listMembers(orgId)` — query organization_members with user profile join
- `inviteMember(orgId, email, role, invitedBy)` — calls `invite_org_member()` Postgres function for atomic seat check, generates crypto token, stores invite, sends email via Resend
- `removeMember(orgId, userId, actorId)` — hard DELETE from organization_members, verify not removing last admin, clear user_profiles.organization_id, audit log
- `changeRole(orgId, userId, newRole, actorId)` — update role, verify not removing last admin if demoting, audit log
- `getMemberCount(orgId)` — count active members (used by billing)

Uses Resend SDK for invite emails — follow the pattern from `app/api/admin/testers/send-invite-email.ts`.

- [ ] **Step 3: Create invites service**

Key methods:

- `acceptInvite(token, userId)` — validate token (not expired, not accepted), check user not already in an org (single-org constraint), create organization_members row, update invite status, update user_profiles.organization_id, audit log
- `getInviteByToken(token)` — public lookup for invite acceptance page

- [ ] **Step 4: Create members controller**

Endpoints:

- `GET /api/org/:slug/members` — `@UseGuards(OrgMemberGuard)` — list members
- `POST /api/org/:slug/members/invite` — `@UseGuards(OrgAdminGuard)` — invite
- `PUT /api/org/:slug/members/:userId/role` — `@UseGuards(OrgAdminGuard)` — change role
- `DELETE /api/org/:slug/members/:userId` — `@UseGuards(OrgAdminGuard)` — remove

- [ ] **Step 5: Create invites controller**

Endpoints:

- `POST /api/org/invite/:token/accept` — `@UseGuards(JwtAuthGuard)` — accept invite
- `GET /api/org/invite/:token` — public, no guard — get invite details for acceptance page

- [ ] **Step 6: Register controllers in organizations.module.ts**

Add `MembersController`, `InvitesController` to controllers array. Add `MembersService`, `InvitesService` to providers.

- [ ] **Step 7: Verify build**

```bash
cd packages/backend && npx nest build 2>&1 | tail -5
```

- [ ] **Step 8: Write members e2e tests**

Create `packages/backend/test/enterprise/members.e2e-spec.ts` — tests from spec Section 8:

- Invite member by email → invite record created
- Invite with invalid email → 400
- Invite when at seat limit → 400 SEAT_LIMIT_REACHED
- Accept invite (existing user) → member record created, status active
- Accept expired invite → 400
- Change member role → role updated, audit entry
- Change role as non-admin → 403
- Remove member → row deleted, audit entry
- Remove last admin → 400 LAST_ADMIN

- [ ] **Step 9: Run tests**

```bash
cd packages/backend && npm run test:e2e -- --testPathPattern=enterprise/members
```

- [ ] **Step 10: Commit**

```bash
git add packages/backend/src/organizations/
git commit -m "feat: add member management — invite, accept, role change, remove with seat enforcement"
```

---

## Task 7: Org Billing — Stripe Per-Seat Subscription

**Files:**

- Create: `packages/backend/src/org-billing/org-billing.module.ts`
- Create: `packages/backend/src/org-billing/org-billing.controller.ts`
- Create: `packages/backend/src/org-billing/org-billing.service.ts`
- Create: `packages/backend/src/org-billing/org-billing-webhook.service.ts`
- Modify: `packages/backend/src/billing/billing-webhook.service.ts` — route org events
- Modify: `packages/backend/src/app.module.ts` — import OrgBillingModule

**Reference:** Spec Section 7 — Billing

- [ ] **Step 1: Create org billing service**

Key methods:

- `createCheckoutSession(orgName, orgSlug, ownerEmail)` — creates Stripe Checkout with enterprise base price + metadata `{ org_slug }`, returns checkout URL. Org creation happens in the webhook after payment succeeds.
- `createBillingPortalSession(orgId)` — creates Stripe billing portal, returns URL
- `updateSeats(orgId, additionalSeats, actorId)` — validates member count ≤ new limit, updates Stripe subscription quantity, updates org.extra_seats, audit log
- `getUsage(orgId)` — returns seat count, extra seats, upcoming invoice from Stripe API

- [ ] **Step 2: Create org billing webhook service**

Key methods — handle Stripe events when metadata contains `org_slug`:

- `handleCheckoutComplete(session)` — create org record, set billing_status: 'active', store stripe_customer_id + stripe_subscription_id
- `handleInvoicePaid(invoice)` — confirm billing_status: 'active'
- `handlePaymentFailed(invoice)` — set billing_status: 'past_due'
- `handleSubscriptionDeleted(subscription)` — set billing_status: 'canceled'
- `handleSubscriptionUpdated(subscription)` — sync seat count

- [ ] **Step 3: Create org billing controller**

Endpoints:

- `POST /api/org/billing/checkout` — `@UseGuards(JwtAuthGuard)` — create checkout (pre-org-creation)
- `POST /api/org/:slug/billing/portal` — `@UseGuards(OrgAdminGuard)` — Stripe portal
- `PUT /api/org/:slug/billing/seats` — `@UseGuards(OrgAdminGuard)` — add/remove seats
- `GET /api/org/:slug/billing/usage` — `@UseGuards(OrgAdminGuard)` — current usage

- [ ] **Step 4: Create org billing module**

```typescript
// packages/backend/src/org-billing/org-billing.module.ts
import { Module } from "@nestjs/common";
import { SupabaseModule } from "../supabase/supabase.module";
import { OrgAuditModule } from "../org-audit/org-audit.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { OrgBillingController } from "./org-billing.controller";
import { OrgBillingService } from "./org-billing.service";
import { OrgBillingWebhookService } from "./org-billing-webhook.service";

@Module({
  imports: [SupabaseModule, OrgAuditModule, OrganizationsModule],
  controllers: [OrgBillingController],
  providers: [OrgBillingService, OrgBillingWebhookService],
  exports: [OrgBillingService, OrgBillingWebhookService],
})
export class OrgBillingModule {}
```

- [ ] **Step 5: Modify existing billing webhook to route org events**

In `packages/backend/src/billing/billing-webhook.service.ts`, add routing logic at the top of `handleWebhookEvent()`:

```typescript
async handleWebhookEvent(event: Stripe.Event): Promise<void> {
  // Route org-specific events to OrgBillingWebhookService
  const session = event.data.object as any;
  if (session?.metadata?.org_slug) {
    return this.orgBillingWebhookService.handleWebhookEvent(event);
  }

  // Existing user-level webhook handling below...
  switch (event.type) { ... }
}
```

Inject `OrgBillingWebhookService` into the constructor. **NOTE:** The existing Stripe webhook endpoint is at `/api/billing/webhook` (NOT `/api/webhooks/stripe` as the spec says). Use the existing endpoint — do NOT create a second webhook URL. `BillingModule` must import `OrgBillingModule` to inject the service (or use `forwardRef()` if circular).

- [ ] **Step 6: Register in app.module.ts**

```typescript
import { OrgBillingModule } from "./org-billing/org-billing.module";
// Add to imports array
```

- [ ] **Step 7: Verify build**

```bash
cd packages/backend && npx nest build 2>&1 | tail -5
```

- [ ] **Step 8: Write billing e2e tests**

Create `packages/backend/test/enterprise/billing.e2e-spec.ts` — tests from spec Section 8:

- Create checkout session → Stripe session created with correct metadata
- Simulate checkout.session.completed → org billing_status = 'active'
- Add extra seats → Stripe subscription updated, org.extra_seats incremented
- Remove seats (allowed) → quantity reduced
- Remove seats (over limit) → 400 SEATS_IN_USE
- Simulate invoice.payment_failed → billing_status = 'past_due'
- Simulate customer.subscription.deleted → billing_status = 'canceled'
- Create billing portal → URL returned
- Fetch upcoming invoice → amount returned from Stripe

- [ ] **Step 9: Run tests**

```bash
cd packages/backend && npm run test:e2e -- --testPathPattern=enterprise/billing
```

- [ ] **Step 10: Commit**

```bash
git add packages/backend/src/org-billing/ packages/backend/src/billing/ packages/backend/src/app.module.ts
git commit -m "feat: add Stripe per-seat billing for enterprise orgs"
```

---

## Task 8: RLS Policy Tests

Verify that RLS policies actually work at the database level with real Supabase JWTs.

**Files:**

- Create: `packages/backend/test/enterprise/rls-policies.e2e-spec.ts`

- [ ] **Step 1: Write RLS tests**

Each test creates a Supabase client with a specific user's JWT and tries to query/mutate data:

- Org admin can read own org's members → SELECT returns rows
- Org member can read own org's members → SELECT returns rows
- Outsider cannot read org's members → SELECT returns empty
- Org admin can read audit log → SELECT returns rows
- Org member cannot read audit log → SELECT returns empty
- Cross-org query returns empty for all tables
- Service role bypasses RLS → all operations work

- [ ] **Step 2: Run tests**

```bash
cd packages/backend && npm run test:e2e -- --testPathPattern=enterprise/rls-policies
```

- [ ] **Step 3: Commit**

```bash
git add packages/backend/test/enterprise/rls-policies.e2e-spec.ts
git commit -m "test: add RLS policy verification for enterprise tables"
```

---

## Task 9: Frontend Data Layer — Org Fetchers

**Files:**

- Create: `packages/frontend/lib/data/fetchers/organizations.ts`
- Create: `packages/frontend/lib/data/fetchers/org-billing.ts`
- Modify: `packages/frontend/lib/data/index.ts`

- [ ] **Step 1: Create org fetchers**

Follow the pattern from `lib/data/fetchers/base.ts` — use `fetchAPI`, `fetchAPIRaw`, `getAuthHeaders`.

```typescript
// packages/frontend/lib/data/fetchers/organizations.ts
import { fetchAPI, fetchAPIRaw } from "./base";

export async function fetchOrg(slug: string) {
  return fetchAPI(`/api/org/${slug}`);
}

export async function fetchOrgMembers(slug: string) {
  return fetchAPI(`/api/org/${slug}/members`);
}

export async function inviteOrgMember(
  slug: string,
  email: string,
  role: string,
) {
  const res = await fetchAPIRaw(`/api/org/${slug}/members/invite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Invite failed: ${res.status}`);
  }
  return res.json();
}

export async function changeOrgMemberRole(
  slug: string,
  userId: string,
  role: string,
) {
  const res = await fetchAPIRaw(`/api/org/${slug}/members/${userId}/role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error(`Role change failed: ${res.status}`);
  return res.json();
}

export async function removeOrgMember(slug: string, userId: string) {
  const res = await fetchAPIRaw(`/api/org/${slug}/members/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Remove failed: ${res.status}`);
  return res.json();
}

export async function fetchOrgAuditLog(
  slug: string,
  params?: { cursor?: string; limit?: number },
) {
  const query = new URLSearchParams();
  if (params?.cursor) query.set("cursor", params.cursor);
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return fetchAPI(`/api/org/${slug}/audit${qs ? "?" + qs : ""}`);
}

export async function acceptOrgInvite(token: string) {
  const res = await fetchAPIRaw(`/api/org/invite/${token}/accept`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Accept failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchInviteDetails(token: string) {
  return fetchAPI(`/api/org/invite/${token}`);
}
```

- [ ] **Step 2: Create billing fetchers**

```typescript
// packages/frontend/lib/data/fetchers/org-billing.ts
import { fetchAPI, fetchAPIRaw } from "./base";

export async function fetchOrgBilling(slug: string) {
  return fetchAPI(`/api/org/${slug}/billing/usage`);
}

export async function createOrgCheckout(name: string, slug: string) {
  const res = await fetchAPIRaw("/api/org/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, slug }),
  });
  if (!res.ok) throw new Error(`Checkout failed: ${res.status}`);
  return res.json();
}

export async function createOrgBillingPortal(slug: string) {
  const res = await fetchAPIRaw(`/api/org/${slug}/billing/portal`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Portal failed: ${res.status}`);
  return res.json();
}

export async function updateOrgSeats(slug: string, additionalSeats: number) {
  const res = await fetchAPIRaw(`/api/org/${slug}/billing/seats`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ additional_seats: additionalSeats }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Seats update failed: ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 3: Export from data layer index**

Add to `packages/frontend/lib/data/index.ts`:

```typescript
export {
  fetchOrg,
  fetchOrgMembers,
  inviteOrgMember,
  changeOrgMemberRole,
  removeOrgMember,
  fetchOrgAuditLog,
  acceptOrgInvite,
  fetchInviteDetails,
} from "./fetchers/organizations";
export {
  fetchOrgBilling,
  createOrgCheckout,
  createOrgBillingPortal,
  updateOrgSeats,
} from "./fetchers/org-billing";
```

- [ ] **Step 4: Verify build**

```bash
cd packages/frontend && npx next build --no-lint 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/lib/data/
git commit -m "feat: add org and billing fetchers to data layer"
```

---

## Task 10: Frontend — Org Context, Guard, Sidebar

The shared layout components that all admin pages depend on.

**Files:**

- Create: `packages/frontend/app/org/components/OrgContextProvider.tsx`
- Create: `packages/frontend/app/org/components/OrgGuard.tsx`
- Create: `packages/frontend/app/org/components/OrgAdminSidebar.tsx`
- Create: `packages/frontend/app/org/[slug]/admin/layout.tsx`
- Create: `packages/frontend/app/org/hooks/useOrg.ts`

**Reference:** Spec Section 3 — admin layout pattern. Follow existing `app/admin/layout.tsx` and `AdminCommandSidebar.tsx` patterns.

- [ ] **Step 1: Create OrgContextProvider**

React context providing org data + user's role. Fetches on mount via `fetchOrg(slug)`. Exposes `org`, `role`, `loading`, `error`, `refresh()`.

- [ ] **Step 2: Create useOrg hook**

Simple `useContext(OrgContext)` wrapper with a helpful error message if used outside the provider.

- [ ] **Step 3: Create OrgGuard**

Client component that checks `useOrg()`. If `role !== 'admin'`, redirects to `/` with `router.replace()`. Shows loading skeleton while checking.

- [ ] **Step 4: Create OrgAdminSidebar**

M3 Navigation Drawer matching existing admin sidebar pattern:

- Links: Dashboard, Members, Billing, Audit (remaining pages — Branding, API Keys, Embeds — added in Plans 2 & 3)
- Audit controller guard: After creating guards in Task 4, go back and add `@UseGuards(JwtAuthGuard, OrgContextGuard, OrgAdminGuard)` to `OrgAuditController`
- Uses `usePathname()` for active state
- Uses M3 tokens: `bg-surface-container-low`, `text-on-surface`, `border-outline-variant`

- [ ] **Step 5: Create admin layout**

**IMPORTANT: Next.js 16 async params.** All params in Next.js 16 are `Promise<{...}>`. In Server Components, use `const { slug } = await params`. In Client Components, use React 19's `use()` hook. This applies to ALL pages and layouts under `[slug]/`.

```typescript
// packages/frontend/app/org/[slug]/admin/layout.tsx
// This must be a SERVER component that awaits params, then passes slug to client children.
import { OrgContextProvider } from '../../components/OrgContextProvider';
import { OrgGuard } from '../../components/OrgGuard';
import { OrgAdminSidebar } from '../../components/OrgAdminSidebar';

export default async function OrgAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <OrgContextProvider slug={slug}>
      <OrgGuard>
        <div className="flex min-h-screen bg-surface">
          <OrgAdminSidebar slug={slug} />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </OrgGuard>
    </OrgContextProvider>
  );
}
```

- [ ] **Step 6: Verify build**

```bash
cd packages/frontend && npx next build --no-lint 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/app/org/
git commit -m "feat: add org admin layout with context provider, guard, and sidebar"
```

---

## Task 11: Frontend — Dashboard, Members, Billing Pages

The three admin pages for Plan 1.

**Files:**

- Create: `packages/frontend/app/org/[slug]/admin/page.tsx` — Dashboard
- Create: `packages/frontend/app/org/[slug]/admin/members/page.tsx` — Members
- Create: `packages/frontend/app/org/[slug]/admin/billing/page.tsx` — Billing
- Create: `packages/frontend/app/org/components/MemberTable.tsx`
- Create: `packages/frontend/app/org/components/InviteMemberDialog.tsx`
- Create: `packages/frontend/app/org/components/SeatUsageBar.tsx`
- Create: `packages/frontend/app/org/components/OrgDashboardCards.tsx`

**Reference:** Spec Section 3 page designs. Follow existing admin page patterns from `app/admin/entitlements/users/page.tsx`.

- [ ] **Step 1: Create SeatUsageBar component**

Visual bar showing `7/10 seats used` with colored fill. Props: `used`, `total`, `extra`. Tailwind with M3 tokens.

- [ ] **Step 2: Create OrgDashboardCards component**

Grid of stat cards: Members (with SeatUsageBar), Reports this month, Recent activity. Uses `useOrg()` context + `fetchOrgMembers()`.

- [ ] **Step 3: Create Dashboard page**

`/org/[slug]/admin/page.tsx` — renders OrgDashboardCards + last 5 audit log entries.

- [ ] **Step 4: Create MemberTable component**

Sortable table: Name+email, Role badge (Admin green / Member blue), Status, Joined date, Actions (role toggle, remove confirm). Props: `members`, `onChangeRole`, `onRemove`, `currentUserId`.

- [ ] **Step 5: Create InviteMemberDialog component**

M3 dialog (rounded-[28px]): email input, role radio (Admin/Member), Send button. Validates email format client-side. Shows seat limit warning when at capacity. Props: `isOpen`, `onClose`, `onInvite`, `seatInfo`.

- [ ] **Step 6: Create Members page**

`/org/[slug]/admin/members/page.tsx` — header with "Invite" button, MemberTable, InviteMemberDialog. Uses `fetchOrgMembers()` via React Query, mutation handlers call `inviteOrgMember()`, `changeOrgMemberRole()`, `removeOrgMember()`.

- [ ] **Step 7: Create Billing page**

`/org/[slug]/admin/billing/page.tsx` — plan summary card, SeatUsageBar, Add/Remove seats buttons, "Manage Billing" → Stripe Portal redirect, upcoming invoice. Uses `fetchOrgBilling()`, `updateOrgSeats()`, `createOrgBillingPortal()`.

- [ ] **Step 8: Verify build**

```bash
cd packages/frontend && npx next build --no-lint 2>&1 | tail -10
```

- [ ] **Step 9: Commit**

```bash
git add packages/frontend/app/org/
git commit -m "feat: add enterprise admin portal — dashboard, members, and billing pages"
```

---

## Task 12: Frontend — Invite Acceptance Page

The public page where invited users accept their org invite.

**Files:**

- Create: `packages/frontend/app/org/invite/[token]/page.tsx`

- [ ] **Step 1: Create invite acceptance page**

`/org/invite/[token]/page.tsx` — outside the admin layout (no OrgGuard wrapping).

Flow:

1. Fetch invite details via `fetchInviteDetails(token)` — shows org name, role, inviter
2. If user is logged in: show "Accept Invite" button → calls `acceptOrgInvite(token)`
3. If user is not logged in: show "Sign in to accept" → redirect to auth with return URL
4. On success: redirect to `/org/[slug]/admin` (if admin) or `/` (if member)
5. Handle errors: expired invite, already accepted, already in another org

- [ ] **Step 2: Verify build + test manually**

```bash
cd packages/frontend && npx next build --no-lint 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/org/invite/
git commit -m "feat: add org invite acceptance page"
```

---

## Task 13: Frontend E2E Tests (Playwright)

**Files:**

- Create: `packages/frontend/test/enterprise/org-admin-portal.e2e-spec.ts`

- [ ] **Step 1: Write Playwright tests**

Tests against running dev servers (frontend + backend) with seeded test data:

- Login as org admin → navigate to `/org/test-brokerage-e2e/admin` → dashboard loads
- Dashboard shows member count and seat usage
- Members page → invite dialog opens, validates email
- Members page → role change updates badge
- Billing page → seat bar renders with correct counts
- Login as org member → `/org/.../admin` → redirected away
- Login as outsider → `/org/.../admin` → redirected away
- Invite page → shows org name and accept button

- [ ] **Step 2: Run tests**

```bash
cd packages/frontend && npx playwright test test/enterprise/
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/test/enterprise/
git commit -m "test: add Playwright E2E tests for enterprise admin portal"
```

---

## Task 14: Final Verification & Cleanup

- [ ] **Step 1: Run full backend type check**

```bash
cd packages/backend && npx nest build 2>&1 | tail -10
```

- [ ] **Step 2: Run full frontend type check**

```bash
cd packages/frontend && npx tsc --noEmit 2>&1 | tail -20
```

- [ ] **Step 3: Run all enterprise backend tests**

```bash
cd packages/backend && npm run test:e2e -- --testPathPattern=enterprise
```

- [ ] **Step 4: Run all enterprise frontend tests**

```bash
cd packages/frontend && npx playwright test test/enterprise/
```

- [ ] **Step 5: Verify no regressions in existing tests**

```bash
cd packages/backend && npm run test 2>&1 | tail -10
```

- [ ] **Step 6: Commit any final fixes**

```bash
git add -A && git commit -m "fix: address any issues found in final verification"
```

---

## Summary

| Task | Scope               | New Files | Modified Files          |
| ---- | ------------------- | --------- | ----------------------- |
| 1    | Database migration  | 1         | 0                       |
| 2    | Test infrastructure | 3         | 0                       |
| 3    | Audit service       | 3         | 0                       |
| 4    | Guards & middleware | 3         | 0                       |
| 5    | Org CRUD            | 6+        | 1 (app.module)          |
| 6    | Member management   | 6         | 1 (org.module)          |
| 7    | Stripe billing      | 4+        | 2 (webhook, app.module) |
| 8    | RLS tests           | 1         | 0                       |
| 9    | Frontend fetchers   | 2         | 1 (data/index)          |
| 10   | Frontend layout     | 5         | 0                       |
| 11   | Frontend pages      | 7         | 0                       |
| 12   | Invite page         | 1         | 0                       |
| 13   | Frontend E2E tests  | 1         | 0                       |
| 14   | Final verification  | 0         | 0                       |

**Next:** Plan 2 (Branding & Embeds) and Plan 3 (Platform API) build on this foundation.
