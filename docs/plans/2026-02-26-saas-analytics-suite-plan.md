# SaaS Analytics Suite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a first-party SaaS analytics system with full user journey tracking, retention, acquisition, and conversion analytics, surfaced in a 5-tab admin dashboard with AI insights.

**Architecture:** Unified event ingestion → session aggregation → 5 query services with Redis caching → tabbed admin dashboard. Extends existing `lib/analytics/tracker.ts` for client-side collection. New `UserAnalyticsModule` in NestJS backend. New `/admin/analytics` page replacing the existing `/admin/entitlements/analytics`.

**Tech Stack:** Next.js App Router, NestJS 11, Supabase (PostgreSQL), Redis (ioredis), React Query, d3-sankey, Recharts (already in use for charts), Tailwind CSS 4, Material Design 3.

**Design Doc:** `docs/plans/2026-02-26-saas-analytics-suite-design.md` — READ THIS FIRST. It contains the full schema, API contracts, UI wireframes, and all design decisions.

**Key Patterns (from codebase exploration):**

- Backend services inject `SupabaseService` and call `this.supabase.getClient()`
- Redis caching uses `RedisService` with `getByKey(key)` / `setByKey(key, value, ttl)`
- Admin routes protected by `@UseGuards(AdminGuard)` from `../../common/guards/admin-auth.guard`
- Public event ingestion has no guards (uses `x-session-id` header)
- Frontend fetchers use `fetchAPIRaw` from `@/lib/data/fetchers/base`
- All fetchers exported via `lib/data/fetchers/index.ts` → `lib/data/index.ts`
- `@nestjs/schedule` is already registered globally (`ScheduleModule.forRoot()` in `app.module.ts`)
- `@nestjs/throttler` is NOT installed — needs to be added
- Test pattern: Jest with `@nestjs/testing`, mock Supabase client, `__tests__/` subdirectory

---

## Phase 1: Foundation (Database + Client-Side Collection)

### Task 1: Database Migration — Create All Analytics Tables

**Files:**

- Create: `scripts/migrations/113-create-user-analytics-tables.sql`
- Create: `PropertyIQ/supabase/migrations/20260226120000_create_user_analytics_tables.sql` (same content)

**Step 1: Write the migration**

Create a single migration with all 7 tables, indexes, seed data, and RLS policies. Tables:

1. `user_events` — unified event store with dedup constraint
2. `user_sessions` — session aggregates
3. `visitor_identities` — anonymous-to-user stitching
4. `daily_analytics` — rolled-up aggregates
5. `funnel_definitions` — custom funnel definitions
6. `page_classifications` — page grouping lookup
7. `analytics_annotations` — timeline markers

Use exact schema from design doc Section 3. Include:

- All indexes from Section 3
- RLS: enable on all tables, grant SELECT/INSERT to `service_role` and `authenticated`
- Seed `page_classifications` with known routes:
  ```sql
  INSERT INTO page_classifications VALUES
    ('/', 'landing', 'Homepage', TRUE),
    ('/map', 'tool', 'Interactive Map', FALSE),
    ('/map/*', 'tool', 'Map View', FALSE),
    ('/markets/*', 'market_detail', 'Market Detail', FALSE),
    ('/reports/*', 'tool', 'Reports', FALSE),
    ('/pricing', 'conversion', 'Pricing', TRUE),
    ('/account/*', 'account', 'Account', FALSE),
    ('/login', 'conversion', 'Login', TRUE),
    ('/signup', 'conversion', 'Signup', TRUE),
    ('/blog/*', 'content', 'Blog', FALSE),
    ('/admin/*', 'admin', 'Admin', FALSE);
  ```
- Seed default funnel definitions:
  ```sql
  INSERT INTO funnel_definitions (name, steps, is_default) VALUES
    ('Signup Funnel', '[{"event_category":"pageview","event_action":"view"},{"event_category":"conversion","event_action":"signup_start"},{"event_category":"conversion","event_action":"signup_complete"}]', TRUE),
    ('Conversion Funnel', '[{"event_category":"conversion","event_action":"signup_complete"},{"event_category":"conversion","event_action":"trial_start"},{"event_category":"conversion","event_action":"upgrade_complete"}]', TRUE);
  ```

**Step 2: Apply migration to Supabase**

Use the Supabase MCP tool `apply_migration` with project ID. Migration name: `create_user_analytics_tables`.

**Step 3: Verify tables exist**

Run: `execute_sql` with `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('user_events', 'user_sessions', 'visitor_identities', 'daily_analytics', 'funnel_definitions', 'page_classifications', 'analytics_annotations') ORDER BY table_name;`

Expected: 7 rows returned.

**Step 4: Commit**

```bash
git add scripts/migrations/113-create-user-analytics-tables.sql
git commit -m "feat: create user analytics tables for SaaS analytics suite"
```

---

### Task 2: Enhanced Client-Side Tracker — Visitor Identity + Pageview Hook

**Files:**

- Create: `packages/frontend/lib/analytics/visitor-identity.ts`
- Create: `packages/frontend/lib/analytics/session-context.ts`
- Create: `packages/frontend/lib/analytics/pageview-tracker.ts`
- Modify: `packages/frontend/lib/analytics/tracker.ts`

**Step 1: Create visitor identity manager**

`packages/frontend/lib/analytics/visitor-identity.ts`:

```typescript
/**
 * Persistent visitor identity using localStorage.
 * Survives across browser sessions for cross-session attribution.
 * DATA LAYER EXEMPTION: Analytics identity, not data fetching.
 */
const VISITOR_KEY = "piq-visitor-id";

export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  let visitorId = localStorage.getItem(VISITOR_KEY);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, visitorId);
  }
  return visitorId;
}
```

**Step 2: Create session context collector**

`packages/frontend/lib/analytics/session-context.ts`:

- Captures on first call per session: UTM params from URL, referrer, entry_type classification, device_type/screen_width/browser/os
- Stores in sessionStorage so it's computed once per session
- Exports `getSessionContext(): SessionContext` with all acquisition + device fields
- Entry type logic: check `utm_source` → 'utm', check `referrer` contains known email domains → 'email', check `document.referrer` exists → 'organic', else → 'direct'
- Device detection: `screen.width < 768` → 'mobile', `< 1024` → 'tablet', else → 'desktop'
- Browser/OS from `navigator.userAgent` (simple regex, not a full parser)

**Step 3: Create automatic pageview tracker hook**

`packages/frontend/lib/analytics/pageview-tracker.ts`:

```typescript
/**
 * Automatic pageview tracking hook for Next.js App Router.
 * Fires on every route change. Tracks page path, previous page, and session context.
 * DATA LAYER EXEMPTION: Analytics emission, not data fetching.
 */
"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "./tracker";

export function usePageviewTracker() {
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return; // Don't track admin pages in user analytics

    trackEvent("pageview.view", {
      page_path: pathname,
      previous_page_path: previousPathRef.current,
    });

    previousPathRef.current = pathname;
  }, [pathname]);
}
```

**Note:** Whether to exclude `/admin` paths is a design choice. Including them pollutes user journey data with admin activity. Excluding means we can't track admin behavior. The design says this is for tracking _user_ behavior, so exclude admin paths. If admin tracking is needed later, it's a separate concern.

**Step 4: Enhance the existing tracker**

Modify `packages/frontend/lib/analytics/tracker.ts`:

- Import `getVisitorId` from `./visitor-identity`
- Import `getSessionContext` from `./session-context`
- Add `client_event_id` generation: `Date.now().toString(36) + Math.random().toString(36).slice(2, 8)`
- Add `visitor_id` to every event payload
- Add session context fields on first event of session
- Add heartbeat interception: if `eventName === 'engagement.heartbeat'`, send to a separate `/api/analytics/heartbeat` endpoint (lightweight PUT, not the batch endpoint)
- Keep existing batching, beacon, and flush logic unchanged

**Step 5: Commit**

```bash
git add packages/frontend/lib/analytics/
git commit -m "feat: add visitor identity, session context, and pageview tracking"
```

---

### Task 3: Integrate Pageview Tracker into App Layout

**Files:**

- Modify: `packages/frontend/app/layout.tsx` (or the appropriate root layout)
- Create: `packages/frontend/lib/analytics/AnalyticsProvider.tsx`

**Step 1: Create AnalyticsProvider wrapper component**

`packages/frontend/lib/analytics/AnalyticsProvider.tsx`:

```typescript
'use client';
import { usePageviewTracker } from './pageview-tracker';
import { useHeartbeat } from './heartbeat';

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  usePageviewTracker();
  useHeartbeat(); // Sends heartbeat every 30s while tab is visible
  return <>{children}</>;
}
```

**Step 2: Create heartbeat hook**

`packages/frontend/lib/analytics/heartbeat.ts`:

- Uses `document.visibilityState` to only send when tab is visible
- Sends lightweight PUT to `/api/analytics/heartbeat` every 30 seconds
- Payload: `{ session_id, visitor_id }`
- Uses `navigator.sendBeacon` — fire and forget, silent failure

**Step 3: Add AnalyticsProvider to the root layout**

Find the root layout that wraps all pages. Add `<AnalyticsProvider>` inside the existing provider tree (below auth, above children). This component is a client component so it must be in the `'use client'` boundary.

**Step 4: Verify pageview fires on navigation**

Start dev servers, open browser, navigate between pages, check Network tab for `POST /api/analytics/events` calls containing `event_category: 'pageview'`.

**Step 5: Commit**

```bash
git add packages/frontend/lib/analytics/ packages/frontend/app/layout.tsx
git commit -m "feat: integrate automatic pageview tracking into app layout"
```

---

### Task 4: Backend — Install Throttler + Create UserAnalytics Module Shell

**Files:**

- Modify: `packages/backend/package.json` (add `@nestjs/throttler`)
- Create: `packages/backend/src/user-analytics/user-analytics.module.ts`
- Create: `packages/backend/src/user-analytics/user-analytics.types.ts`
- Modify: `packages/backend/src/app.module.ts` (register new module)

**Step 1: Install throttler**

```bash
cd packages/backend && npm install @nestjs/throttler
```

**Step 2: Create types file**

`packages/backend/src/user-analytics/user-analytics.types.ts`:

- Define all interfaces from design doc Section 4.4: `OverviewData`, `JourneyData`, `RetentionData`, `AcquisitionData`, `ConversionData`
- Define `MetricWithTrend`, `FunnelStep`, `PageMetric`, `TimeSeriesPoint`, `NavigationFlow`, `PathSequence`, `CohortRow`, `ChurnRiskUser`, `SourceMetric`, `LandingPerf`, `AttributionRow`, `PaywallMetric`, `FeatureConvMetric`, `TierFlow`, `Annotation`
- Define `AnalyticsFilters`: `{ tier?: string; device?: string; source?: string; startDate?: string; endDate?: string }`
- Define `IngestableEvent` (the shape the client sends)

**Step 3: Create module shell**

`packages/backend/src/user-analytics/user-analytics.module.ts`:

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { SupabaseModule } from "../supabase/supabase.module";

@Module({
  imports: [
    SupabaseModule,
    ConfigModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class UserAnalyticsModule {}
```

**Step 4: Register in app.module.ts**

Add `UserAnalyticsModule` to the imports array in `packages/backend/src/app.module.ts`.

**Step 5: Verify backend starts**

```bash
cd packages/backend && npm run start:dev
```

Expected: No errors, module loads.

**Step 6: Commit**

```bash
git add packages/backend/
git commit -m "feat: create UserAnalyticsModule shell with throttler"
```

---

### Task 5: Backend — Event Ingestion Service + Controller

**Files:**

- Create: `packages/backend/src/user-analytics/event-ingestion.controller.ts`
- Create: `packages/backend/src/user-analytics/event-ingestion.service.ts`
- Create: `packages/backend/src/user-analytics/session-manager.service.ts`
- Create: `packages/backend/src/user-analytics/__tests__/event-ingestion.service.spec.ts`
- Modify: `packages/backend/src/user-analytics/user-analytics.module.ts`

**Step 1: Write failing test for event ingestion**

`__tests__/event-ingestion.service.spec.ts`:

- Test `ingestBatch()` with valid events → verifies Supabase `.insert()` called with correct shape
- Test dedup: events with same `session_id + client_event_id` → should use `upsert` with `onConflict`
- Test validation: reject events missing `event_category` or `event_action`
- Test heartbeat interception: events with `event_category = 'heartbeat'` should NOT be inserted into `user_events`, should call `SessionManagerService.updateHeartbeat()`
- Test batch size enforcement: reject batches > 50 events
- Mock `SupabaseService` and `SessionManagerService`

**Step 2: Implement SessionManagerService**

`session-manager.service.ts`:

- `upsertSession(sessionId: string, events: IngestableEvent[])`:
  - Check if session exists (SELECT by session_id)
  - If not: INSERT new session row with landing_page, device context, acquisition context from first event's properties
  - If yes: UPDATE exit_page, page_count++, last_activity_at, duration_seconds, feature_events_count, unique_features_used
  - Set `is_bounce = FALSE` when page_count > 1
  - Set `had_frustration_event = TRUE` if any event has `event_category = 'frustration'`
- `updateHeartbeat(sessionId: string)`: UPDATE `last_activity_at = NOW()`, increment `heartbeat_count`
- `closeStaleSessionsxx()`: UPDATE sessions where `last_activity_at < NOW() - INTERVAL '30 minutes'`, compute final `duration_seconds`

**Step 3: Implement EventIngestionService**

`event-ingestion.service.ts`:

- `ingestBatch(events: IngestableEvent[])`:
  1. Validate each event (required fields, known categories)
  2. Separate heartbeat events from regular events
  3. For heartbeats: call `sessionManager.updateHeartbeat()` for each unique session_id
  4. For regular events: bulk INSERT into `user_events` with `ON CONFLICT (session_id, client_event_id) DO NOTHING`
  5. For each unique session_id: call `sessionManager.upsertSession()`
  6. Return `{ accepted: number, rejected: number }`

**Step 4: Implement EventIngestionController**

`event-ingestion.controller.ts`:

```typescript
import { Controller, Post, Body, HttpCode, Logger } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { EventIngestionService } from "./event-ingestion.service";

@Controller("api/analytics")
export class EventIngestionController {
  private readonly logger = new Logger(EventIngestionController.name);

  constructor(private readonly ingestion: EventIngestionService) {}

  @Post("events")
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @HttpCode(202)
  async ingestEvents(@Body() body: { events: unknown[] }) {
    if (!body.events || !Array.isArray(body.events)) {
      return { success: false, error: "events array required" };
    }
    if (body.events.length > 50) {
      return { success: false, error: "max 50 events per batch" };
    }
    const result = await this.ingestion.ingestBatch(body.events);
    return { success: true, ...result };
  }
}
```

**Step 5: Register in module**

Add controller and services to `user-analytics.module.ts`.

**Step 6: Run tests**

```bash
cd packages/backend && npx jest src/user-analytics/__tests__/event-ingestion.service.spec.ts --verbose
```

**Step 7: Commit**

```bash
git add packages/backend/src/user-analytics/
git commit -m "feat: implement event ingestion with dedup and session management"
```

---

### Task 6: Backend — Identity Stitching Service

**Files:**

- Create: `packages/backend/src/user-analytics/identity-stitching.service.ts`
- Create: `packages/backend/src/user-analytics/__tests__/identity-stitching.service.spec.ts`
- Modify: `packages/backend/src/user-analytics/user-analytics.module.ts`

**Step 1: Write failing test**

Test `linkVisitorToUser(visitorId, userId)`:

- Inserts into `visitor_identities` with computed `first_seen_at`, `signup_cohort`, `acquisition_source`, `sessions_before_identification`
- Backfills `user_id` on `user_sessions` where `visitor_id` matches and `user_id IS NULL`
- Backfills `user_id` on `user_events` where `visitor_id` matches and `user_id IS NULL`
- Processes backfill in batches (mock verifies multiple UPDATE calls for large datasets)

**Step 2: Implement the service**

- `linkVisitorToUser(visitorId: string, userId: string)`:
  1. Query earliest session for this visitor: `SELECT MIN(started_at), entry_type, utm_source FROM user_sessions WHERE visitor_id = $1`
  2. Count sessions: `SELECT COUNT(*) FROM user_sessions WHERE visitor_id = $1`
  3. Insert into `visitor_identities`: `{ visitor_id, user_id, first_seen_at, signup_cohort: date_trunc('week', NOW()), acquisition_source, sessions_before_identification }`
  4. Backfill sessions: `UPDATE user_sessions SET user_id = $2 WHERE visitor_id = $1 AND user_id IS NULL`
  5. Backfill events: `UPDATE user_events SET user_id = $2 WHERE visitor_id = $1 AND user_id IS NULL`
  6. Log if backfill affects > 10,000 rows

**Step 3: Wire up trigger**

The stitching should be called when a user signs up. Two options:

- Option A: Supabase auth webhook (if configured)
- Option B: Call from the `signup_complete` conversion event in the ingestion service

Implement Option B: In `EventIngestionService.ingestBatch()`, after inserting events, check if any event has `event_category = 'conversion'` and `event_action = 'signup_complete'`. If so, extract `visitor_id` and `user_id` from the event and call `identityStitching.linkVisitorToUser()`.

**Step 4: Run tests, commit**

```bash
cd packages/backend && npx jest src/user-analytics/__tests__/ --verbose
git add packages/backend/src/user-analytics/
git commit -m "feat: implement identity stitching for anonymous-to-user linking"
```

---

### Task 7: Backend — Paywall Events Migration Script

**Files:**

- Create: `scripts/migrate-paywall-events-to-user-events.ts`

**Step 1: Write migration script**

A one-time script that:

1. Reads all rows from `paywall_events`
2. Maps them to `user_events` schema:
   - `event_type: 'view'` → `event_category: 'conversion', event_action: 'paywall_view'`
   - `event_type: 'click_upgrade'` → `event_category: 'conversion', event_action: 'upgrade_click'`
   - `event_type: 'dismiss'` → `event_category: 'conversion', event_action: 'paywall_dismiss'`
   - `resource_type` + `resource_id` → `event_label`
   - `page_path` → `page_path`
   - `session_id` → `session_id`
   - `user_id` → `user_id`
   - `user_tier` → `user_tier`
3. Bulk inserts into `user_events` in batches of 500
4. Logs progress: "Migrated X/Y paywall events"

**Step 2: Run against Supabase**

```bash
cd scripts && npx tsx migrate-paywall-events-to-user-events.ts
```

**Step 3: Verify**

```sql
SELECT event_category, event_action, COUNT(*) FROM user_events GROUP BY 1, 2;
```

**Step 4: Commit**

```bash
git add scripts/migrate-paywall-events-to-user-events.ts
git commit -m "feat: add paywall events migration script to user_events table"
```

---

## Phase 2: Backend Query Services

### Task 8: Overview Analytics Service

**Files:**

- Create: `packages/backend/src/user-analytics/overview-analytics.service.ts`
- Create: `packages/backend/src/user-analytics/__tests__/overview-analytics.service.spec.ts`
- Modify: `packages/backend/src/user-analytics/user-analytics.module.ts`

**Step 1: Write failing tests**

Test `getOverview(days, filters)`:

- Returns all KPIs: uniqueVisitors, totalSessions, avgSessionDuration, bounceRate, pagesPerSession, conversionRate
- Each KPI has `current` and `previous` values (for comparison mode)
- Returns sparklines (array of daily values for each KPI)
- Returns quickFunnel with 4 stages
- Returns topPages with views, bounce rate, avg time, conversion rate
- Returns activeUsersChart (daily unique visitors)
- Returns goalProgress from `growth_goals` table
- Returns annotations from `analytics_annotations` table
- Respects filters (tier, device, source)
- Uses Redis cache (5 min TTL)

**Step 2: Implement the service**

Key queries:

- **KPIs**: `SELECT COUNT(DISTINCT visitor_id) FROM user_sessions WHERE started_at >= $start` (and similar for each KPI)
- **Previous period**: Same queries with `started_at BETWEEN $prev_start AND $prev_end`
- **Sparklines**: `SELECT DATE(started_at), COUNT(DISTINCT visitor_id) FROM user_sessions WHERE ... GROUP BY 1 ORDER BY 1`
- **Quick funnel**: Count distinct visitors at each stage (all visitors, those with signup_complete event, those with active sessions after signup, those with upgrade_complete event)
- **Top pages**: `SELECT page_path, COUNT(*), ... FROM user_events WHERE event_category = 'pageview' GROUP BY page_path ORDER BY count DESC LIMIT 10`

Cache pattern:

```typescript
const cacheKey = `analytics:overview:${days}:${JSON.stringify(filters)}`;
const cached = await this.redis.getByKey(cacheKey);
if (cached) return cached;
// ... compute ...
await this.redis.setByKey(cacheKey, result, 300); // 5 min
return result;
```

**Step 3: Run tests, commit**

---

### Task 9: Journey Analytics Service

**Files:**

- Create: `packages/backend/src/user-analytics/journey-analytics.service.ts`
- Create: `packages/backend/src/user-analytics/__tests__/journey-analytics.service.spec.ts`

**Key queries:**

- **Navigation flows** (no self-join, uses pre-computed `previous_page_path`):
  ```sql
  SELECT previous_page_path AS from_page, page_path AS to_page, COUNT(*) AS transitions
  FROM user_events
  WHERE event_category = 'pageview' AND previous_page_path IS NOT NULL AND created_at >= $start
  GROUP BY from_page, to_page ORDER BY transitions DESC LIMIT 50;
  ```
- **Landing pages**: `SELECT landing_page, COUNT(*), AVG(CASE WHEN is_bounce THEN 1 ELSE 0 END)::float AS bounce_rate, AVG(duration_seconds) FROM user_sessions GROUP BY 1 ORDER BY 2 DESC LIMIT 20`
- **Exit pages**: `SELECT exit_page, COUNT(*) FROM user_sessions GROUP BY 1 ORDER BY 2 DESC LIMIT 20`
- **Common paths**: This is the most complex query. Approach: for each session, get ordered pageviews as an array, then group by the first 3 pages:
  ```sql
  WITH session_paths AS (
    SELECT session_id,
      ARRAY_AGG(page_path ORDER BY created_at) AS path
    FROM user_events WHERE event_category = 'pageview' AND created_at >= $start
    GROUP BY session_id
  )
  SELECT path[1:3] AS path_prefix, COUNT(*) AS sessions
  FROM session_paths
  GROUP BY path_prefix ORDER BY sessions DESC LIMIT 20;
  ```
- **Session duration distribution**: `SELECT CASE WHEN duration_seconds < 30 THEN '<30s' WHEN ... END AS bucket, COUNT(*) FROM user_sessions GROUP BY 1`

Cache: 15 min TTL.

---

### Task 10: Retention Analytics Service

**Files:**

- Create: `packages/backend/src/user-analytics/retention-analytics.service.ts`
- Create: `packages/backend/src/user-analytics/__tests__/retention-analytics.service.spec.ts`

**Key queries:**

- **Cohort matrix**: Uses `visitor_identities.signup_cohort` joined to `user_sessions`:

  ```sql
  WITH cohorts AS (
    SELECT vi.user_id, vi.signup_cohort,
      DATE_PART('week', s.started_at - vi.signup_cohort::timestamp) AS week_number
    FROM visitor_identities vi
    JOIN user_sessions s ON vi.user_id = s.user_id
    WHERE vi.signup_cohort >= $start
  )
  SELECT signup_cohort, week_number,
    COUNT(DISTINCT user_id) AS retained_users
  FROM cohorts
  GROUP BY 1, 2 ORDER BY 1, 2;
  ```

  Then compute percentages (week 0 = 100%).

- **DAU/WAU/MAU**:
  - DAU: `COUNT(DISTINCT visitor_id) FROM user_sessions WHERE started_at >= NOW() - INTERVAL '1 day'`
  - WAU: same with `7 days`
  - MAU: same with `30 days`
  - Stickiness: DAU/MAU

- **Retention by tier**: Same cohort query but joined to `user_sessions.user_tier` and grouped by tier.

- **Churn signals**: `SELECT user_id, MAX(last_activity_at), COUNT(*), user_tier FROM user_sessions WHERE user_id IS NOT NULL GROUP BY user_id, user_tier HAVING MAX(last_activity_at) < NOW() - INTERVAL '14 days' AND COUNT(*) >= 3`

Cache: 15 min TTL.

---

### Task 11: Acquisition Analytics Service

**Files:**

- Create: `packages/backend/src/user-analytics/acquisition-analytics.service.ts`
- Create: `packages/backend/src/user-analytics/__tests__/acquisition-analytics.service.spec.ts`

**Key queries:**

- **Traffic sources**: `SELECT entry_type, COALESCE(utm_source, referrer_domain, 'direct') AS source, COUNT(*) FROM user_sessions GROUP BY 1, 2 ORDER BY 3 DESC`
- **Landing page performance**: `SELECT landing_page, COUNT(*) sessions, AVG(is_bounce::int) bounce_rate, AVG(duration_seconds) avg_time, COUNT(*) FILTER (WHERE converted) conversions FROM user_sessions GROUP BY 1`
- **Source-to-conversion attribution**: Join `visitor_identities` to earliest session's source, then join to conversion events. Group by source.
- **Channel trend**: `SELECT DATE(started_at), entry_type, COUNT(*) FROM user_sessions GROUP BY 1, 2 ORDER BY 1`

Cache: 15 min TTL.

---

### Task 12: Conversion Analytics Service

**Files:**

- Create: `packages/backend/src/user-analytics/conversion-analytics.service.ts`
- Create: `packages/backend/src/user-analytics/__tests__/conversion-analytics.service.spec.ts`

**Key queries:**

- **Full funnel**: Count distinct visitors at each stage (visit, signup, trial, paid) across the period
- **Paywall effectiveness**: Query `user_events` where `event_action IN ('paywall_view', 'upgrade_click', 'paywall_dismiss')`, group by `event_label` (resource)
- **Feature correlation** (first-session only, from design doc):
  ```sql
  WITH first_sessions AS (
    SELECT s.session_id, s.visitor_id, s.converted
    FROM user_sessions s
    INNER JOIN (
      SELECT visitor_id, MIN(started_at) AS first_start
      FROM user_sessions GROUP BY visitor_id
    ) f ON s.visitor_id = f.visitor_id AND s.started_at = f.first_start
    WHERE s.started_at >= $start
  )
  SELECT e.event_action AS feature,
    COUNT(DISTINCT CASE WHEN fs.converted THEN e.visitor_id END)::float /
      NULLIF(COUNT(DISTINCT e.visitor_id), 0) AS converter_rate,
    COUNT(DISTINCT CASE WHEN NOT fs.converted THEN e.visitor_id END)::float /
      NULLIF(COUNT(DISTINCT e.visitor_id), 0) AS non_converter_rate,
    COUNT(DISTINCT e.visitor_id) AS users
  FROM user_events e
  JOIN first_sessions fs ON e.session_id = fs.session_id
  WHERE e.event_category = 'feature'
  GROUP BY e.event_action HAVING COUNT(DISTINCT e.visitor_id) >= 10
  ORDER BY (converter_rate - non_converter_rate) DESC;
  ```
- **Tier migration**: `SELECT previous_tier, current_tier, COUNT(*) FROM tier_changes GROUP BY 1, 2` (or derive from user_events conversion events)
- **Revenue metrics**: Query Stripe data (already available via existing `AiInsightsService.gatherRevenueData()` pattern)

Cache: 10 min TTL.

---

### Task 13: Admin Analytics Controller

**Files:**

- Create: `packages/backend/src/user-analytics/user-analytics.controller.ts`
- Modify: `packages/backend/src/user-analytics/user-analytics.module.ts`

**Step 1: Create controller**

```typescript
@UseGuards(AdminGuard)
@Controller('api/admin/analytics')
export class UserAnalyticsController {
  constructor(
    private readonly overview: OverviewAnalyticsService,
    private readonly journeys: JourneyAnalyticsService,
    private readonly retention: RetentionAnalyticsService,
    private readonly acquisition: AcquisitionAnalyticsService,
    private readonly conversion: ConversionAnalyticsService,
  ) {}

  @Get('overview')
  async getOverview(@Query() query: AnalyticsQueryDto) { ... }

  @Get('journeys')
  async getJourneys(@Query() query: AnalyticsQueryDto) { ... }

  @Get('retention')
  async getRetention(@Query() query: AnalyticsQueryDto) { ... }

  @Get('acquisition')
  async getAcquisition(@Query() query: AnalyticsQueryDto) { ... }

  @Get('conversion')
  async getConversion(@Query() query: AnalyticsQueryDto) { ... }

  @Get('export')
  async exportCsv(@Query() query: ExportQueryDto, @Res() res: Response) { ... }

  @Post('annotations')
  async createAnnotation(@Body() body: CreateAnnotationDto) { ... }

  @Get('annotations')
  async getAnnotations(@Query('startDate') start: string, @Query('endDate') end: string) { ... }

  @Post('funnels')
  async createFunnel(@Body() body: CreateFunnelDto) { ... }

  @Get('funnels/:id')
  async evaluateFunnel(@Param('id') id: string, @Query('days') days: string) { ... }
}
```

**Step 2: Create DTOs**

Create `packages/backend/src/user-analytics/dto/` with:

- `analytics-query.dto.ts` — validates `days`, `tier`, `device`, `source`, `startDate`, `endDate`
- `create-annotation.dto.ts` — validates `annotation_date`, `label`, `description`
- `create-funnel.dto.ts` — validates `name`, `steps[]`
- `export-query.dto.ts` — validates `section`, `days`, `format`

Use `class-validator` decorators (`@IsOptional`, `@IsString`, `@IsNumber`, etc.).

**Step 3: Register everything in module**

Update `user-analytics.module.ts` with all controllers, services, exports.

**Step 4: Commit**

```bash
git add packages/backend/src/user-analytics/
git commit -m "feat: implement analytics query services and admin controller"
```

---

### Task 14: Scheduled Jobs — Daily Rollup + Session Cleanup

**Files:**

- Create: `packages/backend/src/user-analytics/daily-rollup.service.ts`
- Modify: `packages/backend/src/user-analytics/user-analytics.module.ts`

**Step 1: Implement DailyRollupService**

```typescript
@Injectable()
export class DailyRollupService {
  private readonly logger = new Logger(DailyRollupService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly redis: RedisService,
  ) {}

  @Cron("*/15 * * * *") // Every 15 minutes
  async closeStaleSessionsJob() {
    // UPDATE user_sessions SET duration_seconds = EXTRACT(EPOCH FROM last_activity_at - started_at)
    // WHERE last_activity_at < NOW() - INTERVAL '30 minutes' AND duration_seconds = 0
  }

  @Cron("0 2 * * *") // 2 AM daily
  async dailyRollupJob() {
    // 1. Compute yesterday's date
    // 2. For each metric (unique_visitors, sessions, pageviews, bounce_rate, avg_duration, conversion_rate):
    //    For each tier (all, anonymous, free, pro, premium):
    //      INSERT INTO daily_analytics (date, metric_name, dimension, user_tier, value)
    // 3. Purge user_events older than 90 days
    // 4. Clear Redis analytics caches: await this.redis.deleteByPrefix('analytics:')
  }
}
```

**Step 2: Commit**

```bash
git add packages/backend/src/user-analytics/
git commit -m "feat: add daily rollup and session cleanup scheduled jobs"
```

---

### Task 15: Funnel Engine + Page Classifier Services

**Files:**

- Create: `packages/backend/src/user-analytics/funnel-engine.service.ts`
- Create: `packages/backend/src/user-analytics/page-classifier.service.ts`

**Step 1: Implement FunnelEngineService**

- `evaluateFunnel(funnelId: string, days: number): Promise<FunnelStep[]>`
- Loads funnel definition from `funnel_definitions`
- For each step: counts distinct visitors who completed that step AND all previous steps within the time window
- Returns array of `{ name, count, rate_from_previous, rate_from_first }`

**Step 2: Implement PageClassifierService**

- `classifyPage(pagePath: string): Promise<{ page_group: string; page_name: string; is_conversion_page: boolean } | null>`
- Loads `page_classifications` table (cached in memory, refreshed hourly)
- Matches path against patterns using glob-style matching (e.g., `/markets/*` matches `/markets/31080`)
- Used by query services to enrich results with page group labels

**Step 3: Commit**

```bash
git add packages/backend/src/user-analytics/
git commit -m "feat: add funnel engine and page classifier services"
```

---

### Task 16: Enhanced AI Insights — Wire New Data Sources

**Files:**

- Modify: `packages/backend/src/admin/analytics/ai-insights.service.ts`
- Modify: `packages/backend/src/admin/analytics/analytics.module.ts`

**Step 1: Import new services**

In `analytics.module.ts`, import `UserAnalyticsModule` and add the query services to the module's imports.

**Step 2: Expand `gatherDataSnapshot()`**

In `ai-insights.service.ts`:

- Inject the 5 new query services
- Add them to the `Promise.all` in `gatherDataSnapshot()`
- Add new data sections to the system prompt builder:
  - `userJourneyIntelligence`: top landing pages, navigation flows, exit pages, common converting paths
  - `retentionHealth`: cohort retention rates, DAU/WAU/MAU, stickiness, churn risk count
  - `acquisitionPerformance`: traffic sources, best converting sources, landing page bounce rates
  - `conversionInsights`: full funnel rates, feature correlation highlights, paywall effectiveness

**Step 3: Add tab-aware persona**

Add an optional `focusArea` parameter to `streamInsights()`. When set:

- `overview` → General growth strategist persona
- `journeys` → UX/CRO specialist persona
- `retention` → Engagement & lifecycle marketer persona
- `acquisition` → Growth/channel marketer persona
- `conversion` → Revenue optimization specialist persona

The persona adjusts the system prompt's emphasis, not the data (all data is always included).

**Step 4: Commit**

```bash
git add packages/backend/src/admin/analytics/
git commit -m "feat: wire all analytics data into AI insights engine"
```

---

## Phase 3: Frontend Dashboard

### Task 17: Frontend Data Fetchers

**Files:**

- Create: `packages/frontend/lib/data/fetchers/admin-analytics.ts`
- Modify: `packages/frontend/lib/data/fetchers/index.ts`
- Modify: `packages/frontend/lib/data/index.ts`

**Step 1: Create the fetcher file**

`packages/frontend/lib/data/fetchers/admin-analytics.ts`:

```typescript
import { fetchAPIRaw } from "./base";
import { getAuthHeaders } from "./auth-headers";
import type {
  OverviewData,
  JourneyData,
  RetentionData,
  AcquisitionData,
  ConversionData,
  AnalyticsFilters,
} from "./admin-analytics.types";

function buildQueryString(days: number, filters?: AnalyticsFilters): string {
  const params = new URLSearchParams({ days: days.toString() });
  if (filters?.tier) params.set("tier", filters.tier);
  if (filters?.device) params.set("device", filters.device);
  if (filters?.source) params.set("source", filters.source);
  if (filters?.startDate) params.set("startDate", filters.startDate);
  if (filters?.endDate) params.set("endDate", filters.endDate);
  return params.toString();
}

async function fetchAnalytics<T>(
  endpoint: string,
  days: number,
  filters?: AnalyticsFilters,
): Promise<T> {
  const qs = buildQueryString(days, filters);
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw(`/api/admin/analytics/${endpoint}?${qs}`, {
    headers: authHeaders,
  });
  if (!res.ok) throw new Error(`Analytics fetch failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function fetchOverviewAnalytics(
  days: number,
  filters?: AnalyticsFilters,
): Promise<OverviewData> {
  return fetchAnalytics<OverviewData>("overview", days, filters);
}

export async function fetchJourneyAnalytics(
  days: number,
  filters?: AnalyticsFilters,
): Promise<JourneyData> {
  return fetchAnalytics<JourneyData>("journeys", days, filters);
}

export async function fetchRetentionAnalytics(
  days: number,
  filters?: AnalyticsFilters,
): Promise<RetentionData> {
  return fetchAnalytics<RetentionData>("retention", days, filters);
}

export async function fetchAcquisitionAnalytics(
  days: number,
  filters?: AnalyticsFilters,
): Promise<AcquisitionData> {
  return fetchAnalytics<AcquisitionData>("acquisition", days, filters);
}

export async function fetchConversionAnalytics(
  days: number,
  filters?: AnalyticsFilters,
): Promise<ConversionData> {
  return fetchAnalytics<ConversionData>("conversion", days, filters);
}

export async function exportAnalyticsCsv(
  section: string,
  days: number,
  filters?: AnalyticsFilters,
): Promise<Blob> {
  const qs = buildQueryString(days, filters) + `&section=${section}&format=csv`;
  const authHeaders = await getAuthHeaders();
  const res = await fetchAPIRaw(`/api/admin/analytics/export?${qs}`, {
    headers: authHeaders,
  });
  return res.blob();
}

export async function createAnnotation(
  date: string,
  label: string,
  description?: string,
): Promise<void> {
  const authHeaders = await getAuthHeaders();
  await fetchAPIRaw("/api/admin/analytics/annotations", {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ annotation_date: date, label, description }),
  });
}
```

**Step 2: Create types file**

`packages/frontend/lib/data/fetchers/admin-analytics.types.ts` — mirror the backend types from `user-analytics.types.ts`.

**Step 3: Export from barrels**

Add exports to `lib/data/fetchers/index.ts` and `lib/data/index.ts`.

**Step 4: Commit**

```bash
git add packages/frontend/lib/data/
git commit -m "feat: add admin analytics data fetchers to data layer"
```

---

### Task 18: Dashboard Page Shell + Shared Components

**Files:**

- Create: `packages/frontend/app/admin/analytics/page.tsx`
- Create: `packages/frontend/app/admin/analytics/components/AnalyticsDateRange.tsx`
- Create: `packages/frontend/app/admin/analytics/components/AnalyticsFilterBar.tsx`
- Create: `packages/frontend/app/admin/analytics/components/AnalyticsTabNav.tsx`
- Create: `packages/frontend/app/admin/analytics/components/DrillDownChips.tsx`
- Create: `packages/frontend/app/admin/analytics/components/shared/MetricCard.tsx`
- Create: `packages/frontend/app/admin/analytics/components/shared/DataTable.tsx`
- Create: `packages/frontend/app/admin/analytics/components/shared/FunnelChart.tsx`
- Create: `packages/frontend/app/admin/analytics/components/shared/TrendLineChart.tsx`
- Create: `packages/frontend/app/admin/analytics/components/shared/EmptyState.tsx`
- Create: `packages/frontend/app/admin/analytics/components/shared/SkeletonLoader.tsx`
- Modify: `packages/frontend/app/admin/components/AdminCommandSidebar.tsx`

**Step 1: Create page shell**

`packages/frontend/app/admin/analytics/page.tsx`:

```typescript
'use client';
import { useState } from 'react';
import { AnalyticsDateRange } from './components/AnalyticsDateRange';
import { AnalyticsFilterBar } from './components/AnalyticsFilterBar';
import { AnalyticsTabNav } from './components/AnalyticsTabNav';
import { DrillDownChips } from './components/DrillDownChips';
import { OverviewTab } from './components/overview/OverviewTab';
import { JourneysTab } from './components/journeys/JourneysTab';
import { RetentionTab } from './components/retention/RetentionTab';
import { AcquisitionTab } from './components/acquisition/AcquisitionTab';
import { ConversionTab } from './components/conversion/ConversionTab';
import { AiInsightsPanel } from './components/AiInsightsPanel';
import type { AnalyticsFilters } from '@/lib/data';

type TabId = 'overview' | 'journeys' | 'retention' | 'acquisition' | 'conversion';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [days, setDays] = useState(30);
  const [customRange, setCustomRange] = useState<{ start: string; end: string } | null>(null);
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [drillDownFilters, setDrillDownFilters] = useState<Record<string, string>>({});

  const effectiveFilters = { ...filters, ...drillDownFilters };

  const TAB_COMPONENTS: Record<TabId, React.ComponentType<TabProps>> = {
    overview: OverviewTab,
    journeys: JourneysTab,
    retention: RetentionTab,
    acquisition: AcquisitionTab,
    conversion: ConversionTab,
  };

  const ActiveTabComponent = TAB_COMPONENTS[activeTab];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium">Analytics</h1>
        <div className="flex items-center gap-4">
          <AnalyticsDateRange days={days} onDaysChange={setDays} customRange={customRange} onCustomRangeChange={setCustomRange} />
          <button onClick={() => setCompareEnabled(!compareEnabled)} className={...}>Compare</button>
        </div>
      </div>

      <AnalyticsFilterBar filters={filters} onChange={setFilters} />
      <DrillDownChips filters={drillDownFilters} onRemove={(key) => { ... }} onClearAll={() => setDrillDownFilters({})} />
      <AnalyticsTabNav activeTab={activeTab} onChange={setActiveTab} />

      <ActiveTabComponent days={days} filters={effectiveFilters} compare={compareEnabled} onDrillDown={(key, value) => setDrillDownFilters(prev => ({ ...prev, [key]: value }))} />

      <AiInsightsPanel days={days} filters={effectiveFilters} focusArea={activeTab} />
    </div>
  );
}
```

**Step 2: Create shared components**

Each shared component in `components/shared/`:

- `MetricCard.tsx` — KPI value with sparkline, trend arrow, optional comparison value. M3 elevated card style.
- `DataTable.tsx` — Sortable, paginated table with clickable rows. Takes `columns`, `data`, `onRowClick` props.
- `FunnelChart.tsx` — Horizontal bar funnel. Takes `steps: { name, count, rate }[]`.
- `TrendLineChart.tsx` — Line chart with optional annotation markers (vertical dashed lines). Uses Recharts (already a dependency). Takes `data`, `annotations`, `compareData`.
- `EmptyState.tsx` — Contextual empty state with message, progress indicator, and action suggestion.
- `SkeletonLoader.tsx` — Shimmer loader variants: `card`, `table`, `chart`.

**Step 3: Add Analytics to admin sidebar**

In `AdminCommandSidebar.tsx`, add to the Monitor group:

```typescript
{ label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
```

Import `BarChart3` from `lucide-react`. Place it after "Dashboard".

**Step 4: Commit**

```bash
git add packages/frontend/app/admin/analytics/ packages/frontend/app/admin/components/
git commit -m "feat: create analytics dashboard page shell with shared components"
```

---

### Task 19: Overview Tab

**Files:**

- Create: `packages/frontend/app/admin/analytics/components/overview/OverviewTab.tsx`
- Create: `packages/frontend/app/admin/analytics/components/overview/KpiCardRow.tsx`
- Create: `packages/frontend/app/admin/analytics/components/overview/GoalProgressBar.tsx`
- Create: `packages/frontend/app/admin/analytics/components/overview/QuickFunnel.tsx`
- Create: `packages/frontend/app/admin/analytics/components/overview/DauChart.tsx`
- Create: `packages/frontend/app/admin/analytics/components/overview/TopPagesTable.tsx`

**Step 1: Implement OverviewTab**

Fetches data via `fetchOverviewAnalytics(days, filters)`. Shows skeleton while loading. Renders:

1. KpiCardRow — 6 MetricCards in a grid
2. GoalProgressBar — compact progress bars for active goals
3. Row: QuickFunnel (left) + DauChart (right)
4. TopPagesTable — clickable rows that drill down

Each sub-component receives data as props from the tab wrapper.

**Step 2: Implement each sub-component**

Follow the wireframes from design doc Section 5.3. Use Recharts for sparklines and DAU chart. Use shared `MetricCard`, `FunnelChart`, `DataTable`, `TrendLineChart`.

**Step 3: Commit**

```bash
git add packages/frontend/app/admin/analytics/components/overview/
git commit -m "feat: implement overview tab with KPIs, funnel, DAU chart, and top pages"
```

---

### Task 20: Journeys Tab

**Files:**

- Create: `packages/frontend/app/admin/analytics/components/journeys/JourneysTab.tsx`
- Create: `packages/frontend/app/admin/analytics/components/journeys/ProgressiveFlow.tsx`
- Create: `packages/frontend/app/admin/analytics/components/journeys/LandingPagesTable.tsx`
- Create: `packages/frontend/app/admin/analytics/components/journeys/ExitPagesTable.tsx`
- Create: `packages/frontend/app/admin/analytics/components/journeys/CommonPathsTable.tsx`
- Create: `packages/frontend/app/admin/analytics/components/journeys/SessionDurationDist.tsx`

**Step 1: Install d3-sankey**

```bash
cd packages/frontend && npm install d3-sankey @types/d3-sankey
```

**Step 2: Implement ProgressiveFlow**

The hero visualization. Renders a 3-column Sankey-style flow:

- Column 1: Top 5 landing pages (sized by session count)
- Column 2: Top 5 second pages (linked from column 1)
- Column 3: Top 5 third pages + EXIT node
- Click a node to expand (show all destinations from that page)
- Toggle: Sankey view / Table view

Use `d3-sankey` for layout computation, render with SVG. Keep it under 400 lines — extract helpers as needed.

**Step 3: Implement table components**

Use shared `DataTable` for landing pages, exit pages, and common paths. Each row is clickable (triggers drill-down filter).

**Step 4: Commit**

```bash
git add packages/frontend/app/admin/analytics/components/journeys/
git commit -m "feat: implement journeys tab with navigation flow and path analysis"
```

---

### Task 21: Retention Tab

**Files:**

- Create: `packages/frontend/app/admin/analytics/components/retention/RetentionTab.tsx`
- Create: `packages/frontend/app/admin/analytics/components/retention/CohortMatrix.tsx`
- Create: `packages/frontend/app/admin/analytics/components/retention/EngagementHealth.tsx`
- Create: `packages/frontend/app/admin/analytics/components/retention/RetentionByCurve.tsx`
- Create: `packages/frontend/app/admin/analytics/components/retention/ChurnRiskTable.tsx`

**Step 1: Implement CohortMatrix**

The key visualization. Renders a grid where:

- Rows = signup cohort weeks
- Columns = weeks since signup (Wk1, Wk2, ...)
- Cells = retention percentage, heat-mapped (green → yellow → red)
- Click a cell to drill down (show users in that cohort+week)

Use a plain HTML table with Tailwind background color classes based on retention %. No charting library needed.

**Step 2: Implement other components**

- `EngagementHealth` — 4 stat cards (DAU, WAU, MAU, Stickiness ratio)
- `RetentionByCurve` — Recharts line chart with one line per tier
- `ChurnRiskTable` — DataTable with partially masked emails (e.g., `u***@email.com`)

**Step 3: Commit**

```bash
git add packages/frontend/app/admin/analytics/components/retention/
git commit -m "feat: implement retention tab with cohort matrix and churn signals"
```

---

### Task 22: Acquisition Tab

**Files:**

- Create: `packages/frontend/app/admin/analytics/components/acquisition/AcquisitionTab.tsx`
- Create: `packages/frontend/app/admin/analytics/components/acquisition/TrafficSourcesChart.tsx`
- Create: `packages/frontend/app/admin/analytics/components/acquisition/ChannelTrendChart.tsx`
- Create: `packages/frontend/app/admin/analytics/components/acquisition/AttributionTable.tsx`
- Create: `packages/frontend/app/admin/analytics/components/acquisition/LandingPerfTable.tsx`

**Step 1: Implement all components**

- `TrafficSourcesChart` — Recharts horizontal bar chart showing source breakdown
- `ChannelTrendChart` — Multi-line Recharts chart with annotation markers
- `AttributionTable` — Source → Visitors → Signups → Trials → Paid → Conv% → ARPU. Highlight best source with star.
- `LandingPerfTable` — Landing page with sessions, bounce rate, avg time, signups, conv%

**Step 2: Commit**

```bash
git add packages/frontend/app/admin/analytics/components/acquisition/
git commit -m "feat: implement acquisition tab with traffic sources and attribution"
```

---

### Task 23: Conversion Tab

**Files:**

- Create: `packages/frontend/app/admin/analytics/components/conversion/ConversionTab.tsx`
- Create: `packages/frontend/app/admin/analytics/components/conversion/FullFunnel.tsx`
- Create: `packages/frontend/app/admin/analytics/components/conversion/FeatureCorrelationChart.tsx`
- Create: `packages/frontend/app/admin/analytics/components/conversion/TierMigrationFlow.tsx`
- Create: `packages/frontend/app/admin/analytics/components/conversion/PaywallEffectiveness.tsx`
- Create: `packages/frontend/app/admin/analytics/components/conversion/RevenueMetrics.tsx`

**Step 1: Implement FeatureCorrelationChart**

The most important visualization on this tab. Horizontal bar chart showing:

- Each feature as a row
- Two bars per row: non-converter usage rate (gray) and converter usage rate (colored)
- Gap between bars = signal strength
- Sorted by gap (strongest signals first)

Use Recharts `BarChart` with grouped bars.

**Step 2: Implement other components**

- `FullFunnel` — Wide horizontal funnel using shared `FunnelChart`. Click a stage to drill down.
- `TierMigrationFlow` — Simple arrow diagram showing upgrade/downgrade flows with counts
- `PaywallEffectiveness` — DataTable migrated from existing dashboard (resource, views, clicks, CTR, conversions)
- `RevenueMetrics` — 3 stat cards (MRR, ARPU, LTV estimate) + tier distribution pie chart

**Step 3: Commit**

```bash
git add packages/frontend/app/admin/analytics/components/conversion/
git commit -m "feat: implement conversion tab with funnel, feature correlation, and revenue"
```

---

### Task 24: AI Insights Panel — Migrate and Enhance

**Files:**

- Create: `packages/frontend/app/admin/analytics/components/AiInsightsPanel.tsx`
- Move/adapt: Existing components from `app/admin/entitlements/analytics/components/` (AiInsightsPanel, InsightsPanelToolbar, InsightsChat, RecommendationItem, SavedInsightsList, InsightCategoryCard)
- Move/adapt: Existing hooks from `app/admin/entitlements/analytics/hooks/` (useAiInsights, useSavedInsights)
- Move/adapt: Existing utils from `app/admin/entitlements/analytics/utils/`

**Step 1: Copy and adapt existing AI panel**

The existing AiInsightsPanel is 307 lines with 6 supporting components. Copy the entire component tree to the new location. Changes needed:

- Update import paths
- Add `focusArea` prop that gets passed to the AI insights endpoint as a query param
- The endpoint call in `useAiInsights` should add `&focusArea=${focusArea}` to the SSE URL
- Keep all existing functionality: provider switching, save/load, recommendations, chat, copy-prompt

**Step 2: Verify AI panel renders and streams**

Start dev servers, navigate to `/admin/analytics`, click "Generate Insights". Should stream markdown analysis that now includes user journey, retention, acquisition, and conversion data in addition to the existing paywall/revenue data.

**Step 3: Commit**

```bash
git add packages/frontend/app/admin/analytics/components/
git commit -m "feat: migrate and enhance AI insights panel with full analytics data"
```

---

### Task 25: Export, Annotations, and Custom Date Picker

**Files:**

- Modify: `packages/frontend/app/admin/analytics/components/AnalyticsDateRange.tsx`
- Modify: `packages/frontend/app/admin/analytics/page.tsx`

**Step 1: Add export button**

In the page header, add an export icon button (Download icon from lucide-react) that calls `exportAnalyticsCsv(activeTab, days, filters)` and triggers a file download.

**Step 2: Add annotation creation**

Add a small "Add annotation" button that opens a popover with date picker + label input. Calls `createAnnotation()`. Annotations are fetched with each tab's data and passed to `TrendLineChart`.

**Step 3: Add custom date range picker**

Enhance `AnalyticsDateRange` to include a "Custom" option that shows two date inputs (start, end). When a custom range is set, `days` is ignored and `startDate`/`endDate` are passed to filters instead.

**Step 4: Commit**

```bash
git add packages/frontend/app/admin/analytics/
git commit -m "feat: add CSV export, annotations, and custom date range"
```

---

## Phase 4: Event Instrumentation + Polish

### Task 26: Instrument Curated Events Across Existing Components

**Files to modify** (add `trackEvent()` calls):

| Component           | File Path                                                                 | Events                                                                                  |
| ------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Map filter selector | `packages/frontend/app/map/components/MetricSelector.tsx` (or equivalent) | `feature.map_filter`                                                                    |
| Map region click    | `packages/frontend/app/map/components/MapView.tsx` (or equivalent)        | `feature.region_select`                                                                 |
| Search input        | `packages/frontend/app/components/search/` (or equivalent)                | `feature.search`, `feature.search_click`, `frustration.search_empty`                    |
| Score view          | `packages/frontend/app/components/scoring/ScoreWidget.tsx`                | `feature.score_view`                                                                    |
| Score breakdown     | `packages/frontend/app/components/scoring/ScoreCard.tsx`                  | `feature.score_expand`                                                                  |
| Report view         | `packages/frontend/app/reports/` (or equivalent)                          | `feature.report_view`                                                                   |
| Report export       | Same area                                                                 | `feature.report_export`                                                                 |
| Watchlist add       | `packages/frontend/app/` (find watchlist component)                       | `feature.watchlist_add`                                                                 |
| Alert create        | `packages/frontend/app/` (find alert component)                           | `feature.alert_create`                                                                  |
| Pricing page        | `packages/frontend/app/pricing/page.tsx`                                  | `conversion.pricing_view`, `conversion.pricing_tier_click`, `conversion.pricing_toggle` |
| Signup flow         | `packages/frontend/app/` (find auth components)                           | `conversion.signup_start`, `conversion.signup_complete`                                 |
| Scroll depth        | Create new hook `useScrollDepthTracker`                                   | `engagement.scroll_depth` on key pages                                                  |
| Error display       | Global error boundary or API error handler                                | `frustration.error_shown`                                                               |

**Approach:**

1. Use the Explore agent to find the exact file paths for each component
2. For each component: import `trackEvent` from `@/lib/analytics/tracker` and add the call at the appropriate interaction point
3. Keep the calls lightweight — one line each, fire and forget

**Step 1: Create scroll depth hook**

`packages/frontend/lib/analytics/scroll-depth-tracker.ts`:

- Observes scroll position via `IntersectionObserver` on sentinel elements at 25%, 50%, 75%, 100%
- Fires `trackEvent('engagement.scroll_depth', { depth: 25, page_path: pathname })` once per milestone per page load
- Used on pricing page, landing page, blog pages

**Step 2: Instrument components**

Work through the table above. Each is a 1-3 line change — import tracker, add `trackEvent()` call.

**Step 3: Commit**

```bash
git add packages/frontend/
git commit -m "feat: instrument 24 curated analytics events across existing components"
```

---

### Task 27: Redirect Old Analytics Route

**Files:**

- Create: `packages/frontend/app/admin/entitlements/analytics/page.tsx` (replace with redirect)

**Step 1: Replace old page with redirect**

```typescript
import { redirect } from "next/navigation";
export default function OldAnalyticsPage() {
  redirect("/admin/analytics");
}
```

This ensures any bookmarks or links to the old URL still work.

**Step 2: Commit**

```bash
git add packages/frontend/app/admin/entitlements/analytics/page.tsx
git commit -m "feat: redirect old analytics route to new /admin/analytics"
```

---

### Task 28: End-to-End Verification

**Step 1: Start dev servers**

```bash
# Terminal 1
cd packages/backend && npm run start:dev

# Terminal 2
cd packages/frontend && npm run dev
```

**Step 2: Verify event ingestion**

- Open the app in a browser
- Navigate between pages
- Check backend logs for event ingestion
- Query `user_events`: `SELECT event_category, event_action, COUNT(*) FROM user_events GROUP BY 1, 2 ORDER BY 3 DESC`
- Query `user_sessions`: `SELECT * FROM user_sessions ORDER BY started_at DESC LIMIT 5`

**Step 3: Verify dashboard**

- Navigate to `/admin/analytics`
- Check each tab loads (may show empty states if not enough data yet)
- Verify AI Insights panel generates and streams

**Step 4: Verify old route redirects**

- Navigate to `/admin/entitlements/analytics`
- Should redirect to `/admin/analytics`

**Step 5: Run backend tests**

```bash
cd packages/backend && npx jest src/user-analytics/ --verbose
```

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete SaaS analytics suite - verified end-to-end"
```

---

## Summary

| Phase                       | Tasks        | Estimated Files    |
| --------------------------- | ------------ | ------------------ |
| Phase 1: Foundation         | Tasks 1-7    | ~15 files          |
| Phase 2: Backend Services   | Tasks 8-16   | ~20 files          |
| Phase 3: Frontend Dashboard | Tasks 17-25  | ~40 files          |
| Phase 4: Instrumentation    | Tasks 26-28  | ~15 modified files |
| **Total**                   | **28 tasks** | **~90 files**      |

**Key dependencies:**

- Task 1 (migration) must complete before any backend service
- Tasks 2-3 (client tracker) can run in parallel with Tasks 4-7 (backend foundation)
- Phase 2 tasks are mostly independent of each other (can parallelize)
- Phase 3 depends on Phase 2 (needs API endpoints)
- Phase 4 depends on Phase 3 (needs the tracker enhanced)
- Task 16 (AI insights) depends on Tasks 8-12 (query services)
- Task 24 (AI panel) depends on Task 16 (backend AI enhancement)
