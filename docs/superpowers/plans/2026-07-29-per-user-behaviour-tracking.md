# Per-User Behaviour Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/admin/entitlements/users`, see what every individual user actually did — narrated session timelines, at-a-glance behaviour columns, an AI summary, and session replay.

**Architecture:** Add a `user` dimension alongside the existing `visitor` dimension in `packages/backend/src/user-analytics/`. New `analytics_user_*` Postgres RPCs do all aggregation server-side; new routes under `/api/admin/analytics/users/*`; the frontend reads through `@/lib/data` with React Query. Everything keys on `user_id`, never `visitor_id` (one user has many browser-scoped visitor ids).

**Tech Stack:** NestJS 11, Supabase Postgres RPCs (`language sql stable`), Next.js 16 App Router, React 19, TanStack Query 5, Tailwind 4 (M3 tokens), Jest (backend), Vitest (frontend), rrweb (Phase 8).

**Spec:** `docs/superpowers/specs/2026-07-29-per-user-activity-tracking-design.md`

## Global Constraints

- **Data layer:** ALL frontend fetching goes through `@/lib/data`. Never `fetch(${API_URL})` outside it. `lib/analytics/*` is the one documented exemption (fire-and-forget emission).
- **File size:** logic files <200 target / **300 hard**; React components <300 target / **400 hard**. 2+ exports = split.
- **No secret fallbacks:** never `process.env.X || 'default'`.
- **Every endpoint validates input** with `class-validator` DTOs.
- **Never derive a population statistic from an unpaginated PostgREST array.** Aggregate in SQL. `.select()` without `.range()` silently caps at 1,000 rows.
- **Colours:** semantic CSS variables only (`bg-surface`, `text-on-surface`, `bg-primary`). Never hardcode hex. M3 shapes: cards `rounded-xl shadow-sm`, chips `rounded-full`.
- **Score/label vocabulary:** never introduce quality words for momentum labels. Not applicable to engagement segments, which are their own vocabulary (`POWER`/`ACTIVE`/`AT_RISK`/`DORMANT`).
- **Naming:** descriptive and self-explanatory. No `utils2.ts`, no `handle()`.
- **AI prose:** no markdown, no em-dashes, no code identifiers in any prompt or generated narrative.
- **No underscores in user-facing text.** Hyphens or spaces.
- **Backend typecheck is `npx tsc --noEmit`**, not `nest build` (build config excludes specs).
- **Commits:** on `develop`, explicit pathspecs only (the tree has unrelated untracked WIP), no `Co-Authored-By`. Never push unless asked.
- **Bot filtering is unnecessary on `user_id`-scoped queries** — bots never carry a `user_id`. Do not add `is_bot` filters to the new RPCs; note it in a comment so a future reader does not "fix" it.

**Test commands:**

- Backend one file: `cd packages/backend && npx jest src/user-analytics/__tests__/<file>.spec.ts`
- Frontend one file: `cd packages/frontend && npx vitest run <path>`
- Backend typecheck: `cd packages/backend && npx tsc --noEmit`

**Migration note:** backdated migrations below the current max are silently skipped by Supabase. Always generate a timestamp with `date -u +%Y%m%d%H%M%S` at write time and verify with `mcp__supabase-db__list_migrations`.

---

# PHASE 1 — Data integrity and compliance

> Everything downstream under-reports by ~17% until Tasks 1-4 land. Tasks 1 and 4 are also **compliance requirements**: the Privacy Policy published in commit `8fdedae1` already promises both behaviours.

### Task 1: Honour Do Not Track and Global Privacy Control

The policy says users can "enable Do Not Track or Global Privacy Control in your browser" to limit first-party analytics and session recording. `tracker.ts` already has a `trackingExcluded` flag gating `trackEvent` (line 122), and `heartbeat.ts` already checks `isTrackingExcluded()` (line 38) — so one flag covers events, heartbeats, and later replay.

**Files:**

- Modify: `packages/frontend/lib/analytics/tracker.ts:49` (add signal check), `:189-198` (exclusion accessors)
- Test: `packages/frontend/lib/analytics/__tests__/tracker-privacy-signals.test.ts` (create)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `hasOptedOutOfTracking(): boolean` exported from `lib/analytics/tracker.ts`. `isTrackingExcluded()` keeps its existing signature and now returns `true` when a privacy signal is set.

- [ ] **Step 1: Write the failing test**

```typescript
// packages/frontend/lib/analytics/__tests__/tracker-privacy-signals.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Global Privacy Control and Do Not Track must suppress ALL first-party
 * collection, because the published Privacy Policy names them as the
 * self-service opt-out. A policy that promises a control the code ignores is
 * worse than no control at all.
 */
describe("tracker honours browser privacy signals", () => {
  beforeEach(() => {
    vi.resetModules();
    // @ts-expect-error test shim
    delete navigator.globalPrivacyControl;
    Object.defineProperty(navigator, "doNotTrack", {
      value: null,
      configurable: true,
    });
  });

  it("does not queue events when Global Privacy Control is set", async () => {
    Object.defineProperty(navigator, "globalPrivacyControl", {
      value: true,
      configurable: true,
    });
    const mod = await import("../tracker");
    expect(mod.hasOptedOutOfTracking()).toBe(true);
    expect(mod.isTrackingExcluded()).toBe(true);
  });

  it("does not queue events when Do Not Track is 1", async () => {
    Object.defineProperty(navigator, "doNotTrack", {
      value: "1",
      configurable: true,
    });
    const mod = await import("../tracker");
    expect(mod.hasOptedOutOfTracking()).toBe(true);
  });

  it("tracks normally when neither signal is set", async () => {
    const mod = await import("../tracker");
    expect(mod.hasOptedOutOfTracking()).toBe(false);
    expect(mod.isTrackingExcluded()).toBe(false);
  });

  it("keeps the admin exclusion working independently of the signals", async () => {
    const mod = await import("../tracker");
    mod.setTrackingExcluded(true);
    expect(mod.isTrackingExcluded()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run lib/analytics/__tests__/tracker-privacy-signals.test.ts`
Expected: FAIL — `hasOptedOutOfTracking is not a function`.

- [ ] **Step 3: Write minimal implementation**

Replace `let trackingExcluded = false;` at `tracker.ts:49` with:

```typescript
let trackingExcluded = false;

/**
 * Global Privacy Control / Do Not Track.
 *
 * Read once and cached: both are static for the page lifetime, and re-reading
 * navigator on every event is pure overhead. GPC is the modern signal and is
 * legally binding in several US states; DNT is legacy but costs nothing to
 * honour. Our Privacy Policy names both as the user-facing opt-out, so this is
 * a compliance control, not a courtesy.
 *
 * Suppresses event batches, heartbeats (heartbeat.ts reads
 * isTrackingExcluded) and session replay alike — one flag, all three.
 */
let optedOutCache: boolean | undefined;
export function hasOptedOutOfTracking(): boolean {
  if (optedOutCache !== undefined) return optedOutCache;
  if (typeof navigator === "undefined") return false;
  const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean })
    .globalPrivacyControl;
  optedOutCache = gpc === true || navigator.doNotTrack === "1";
  return optedOutCache;
}
```

Then change `isTrackingExcluded` (line ~196) to:

```typescript
export function isTrackingExcluded(): boolean {
  return trackingExcluded || hasOptedOutOfTracking();
}
```

And change the guard in `trackEvent` (line 122) from `if (trackingExcluded) return;` to:

```typescript
if (isTrackingExcluded()) return;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run lib/analytics/__tests__/tracker-privacy-signals.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Verify nothing else regressed**

Run: `cd packages/frontend && npx vitest run lib/analytics/__tests__/ && npx eslint lib/analytics/tracker.ts`
Expected: all analytics tests pass; eslint clean.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/lib/analytics/tracker.ts \
        packages/frontend/lib/analytics/__tests__/tracker-privacy-signals.test.ts
git commit -m "feat(analytics): honour Global Privacy Control and Do Not Track

The Privacy Policy names both as the self-service way to limit first-party
analytics and session recording, so ignoring them would make the published
policy false. Routed through isTrackingExcluded, which trackEvent and
heartbeat already consult, so one flag suppresses events, keepalives and
replay together. Cached because both signals are static for the page
lifetime."
```

---

### Task 2: Promote `user_id` onto sessions after insert

`user_sessions.user_id` is written only at INSERT from `firstEvent?.user_id` (`session-manager.service.ts:79`). A session normally opens anonymous because `pageview.view` fires before auth hydrates, so 43 of 246 authenticated sessions (~17%) are orphaned. `buildSessionUpdatePlan` never writes `user_id`, and the `select` does not even fetch it — although lines 98-103 implement exactly the right one-way promotion for `is_internal`.

**Files:**

- Modify: `packages/backend/src/user-analytics/session-update-payload.ts:13-18` (interface), `:66-115` (payload)
- Modify: `packages/backend/src/user-analytics/session-manager.service.ts:31-33` (select)
- Test: `packages/backend/src/user-analytics/__tests__/session-update-payload.spec.ts` (append)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `ExistingSessionRow` gains `user_id: string | null`. `buildSessionUpdatePlan` returns a `payload` that may now contain `user_id`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/backend/src/user-analytics/__tests__/session-update-payload.spec.ts`:

```typescript
describe("buildSessionUpdatePlan user_id promotion", () => {
  /** Minimal row helper; only the fields the plan reads matter. */
  const row = (over: Partial<ExistingSessionRow> = {}): ExistingSessionRow => ({
    page_count: 1,
    feature_events_count: 0,
    is_bot: false,
    user_id: null,
    ...over,
  });

  const ev = (over: Partial<IngestableEvent> = {}): IngestableEvent =>
    ({
      event_category: "pageview",
      event_action: "view",
      session_id: "s1",
      visitor_id: "v1",
      ...over,
    }) as IngestableEvent;

  it("adopts a user_id from a later batch when the session row has none", () => {
    const { payload } = buildSessionUpdatePlan({
      existing: row({ user_id: null }),
      events: [ev(), ev({ user_id: "user-a" })],
      pageviewCount: 1,
      exitPage: "/map",
      props: {},
    });

    expect(payload["user_id"]).toBe("user-a");
  });

  it("leaves user_id untouched when no event in the batch carries one", () => {
    const { payload } = buildSessionUpdatePlan({
      existing: row({ user_id: null }),
      events: [ev()],
      pageviewCount: 1,
      exitPage: "/map",
      props: {},
    });

    expect(payload).not.toHaveProperty("user_id");
  });

  it("never reassigns a session that already has a user_id", () => {
    const { payload } = buildSessionUpdatePlan({
      existing: row({ user_id: "user-a" }),
      events: [ev({ user_id: "user-b" })],
      pageviewCount: 1,
      exitPage: "/map",
      props: {},
    });

    // A shared browser must not hand one person's session to another.
    expect(payload).not.toHaveProperty("user_id");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/backend && npx jest src/user-analytics/__tests__/session-update-payload.spec.ts`
Expected: the first test FAILS (`payload.user_id` is `undefined`). The other two pass vacuously — that is fine, they are regression guards.

- [ ] **Step 3: Write minimal implementation**

In `session-update-payload.ts`, add to `ExistingSessionRow`:

```typescript
export interface ExistingSessionRow {
  page_count: number | null;
  feature_events_count: number | null;
  is_bot: boolean | null;
  /** Null until some batch carries an authenticated event. */
  user_id: string | null;
  [column: string]: unknown;
}
```

Then insert immediately after the `is_internal` block (after line 103):

```typescript
// One-way, exactly like is_internal above and for the same reason: a session
// opens anonymous because pageview.view fires before auth hydrates, so the
// INSERT captures null and nothing ever revisited it. That left 43 of 246
// authenticated sessions orphaned from their own user, and every per-user
// count built on top of them low by roughly a sixth.
//
// Never REassigns. On a shared browser a second sign-in must not hand the
// first person's session to the second; the id that got there first wins, and
// identity-stitching remains the only thing allowed to rewrite history.
if (existing.user_id == null) {
  const identified = events.find((e) => e.user_id)?.user_id;
  if (identified) payload["user_id"] = identified;
}
```

In `session-manager.service.ts`, add `user_id` to the select at line 31-33:

```typescript
      .select(
        'session_id, user_id, page_count, feature_events_count, landing_page, entry_type, referrer, referrer_domain, utm_source, utm_medium, utm_campaign, is_bot',
      )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/backend && npx jest src/user-analytics/__tests__/session-update-payload.spec.ts src/user-analytics/__tests__/session-manager.service.spec.ts`
Expected: PASS. If `session-manager.service.spec.ts` fixtures fail on the widened select, add `user_id: null` to the mocked row — cast fixtures, never loosen production types.

- [ ] **Step 5: Typecheck**

Run: `cd packages/backend && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/user-analytics/session-update-payload.ts \
        packages/backend/src/user-analytics/session-manager.service.ts \
        packages/backend/src/user-analytics/__tests__/session-update-payload.spec.ts
git commit -m "fix(analytics): adopt user_id onto sessions that start anonymous

user_sessions.user_id was written only at INSERT, from the first event of the
first batch. That event is normally anonymous because pageview.view fires
before auth hydrates, and the update path never wrote the column at all, so
the session stayed orphaned for its whole life. 43 of 246 authenticated
sessions were affected, making every per-user count low by about a sixth.

Promotes one-way, mirroring the is_internal rule directly above it, which
already carried a comment describing this exact situation. Never reassigns:
on a shared browser the id that arrives first keeps the session."
```

---

### Task 3: Backfill the orphaned sessions

**Files:**

- Create: `supabase/migrations/<TS>_backfill_session_user_id_from_events.sql`

**Interfaces:**

- Consumes: Task 2's forward fix (do this after, so the leak is closed before the backfill runs).
- Produces: no code surface. Post-condition: zero `user_sessions` rows with `user_id is null` that have an identified event.

- [ ] **Step 1: Record the pre-state**

Run via the Supabase MCP `execute_sql`:

```sql
select count(*) as orphaned
from public.user_sessions s
where s.user_id is null
  and exists (select 1 from public.user_events e
              where e.session_id = s.session_id and e.user_id is not null);
```

Expected: a non-zero count near 43. Write the number down — Step 4 asserts against it.

- [ ] **Step 2: Write the migration**

Generate the timestamp first: `date -u +%Y%m%d%H%M%S`.

```sql
-- Backfill user_sessions.user_id from the events that already carry it.
--
-- The write path only ever set this column at INSERT, from the first event of
-- the first batch, which is normally anonymous because pageview.view fires
-- before auth hydrates. The update path never wrote it. So a session that
-- clearly belongs to a signed-in user could sit at null forever, and 43 of the
-- 246 authenticated sessions did.
--
-- Runs AFTER the forward fix, otherwise it would be repairing a leak that is
-- still open. Adopts from user_events rather than visitor_identities because
-- the event is direct first-hand evidence of who was in that session, whereas
-- the visitor mapping is many-to-one and would guess on a shared browser.
--
-- Deliberately does NOT touch rows that already have a user_id.

update public.user_sessions s
set user_id = adopted.user_id
from (
  select distinct on (e.session_id) e.session_id, e.user_id
  from public.user_events e
  where e.user_id is not null
  order by e.session_id, e.created_at asc
) adopted
where s.session_id = adopted.session_id
  and s.user_id is null;
```

- [ ] **Step 3: Apply it**

Apply with the Supabase MCP `apply_migration`, then confirm it registered:
`mcp__supabase-db__list_migrations` — the new version must appear as the max. A backdated version below the current max is skipped silently.

- [ ] **Step 4: Verify the post-state**

Re-run the Step 1 query. Expected: **0**. Then confirm the recovery:

```sql
select count(*) as sessions_with_user from public.user_sessions where user_id is not null;
```

Expected: roughly the Step 1 pre-count higher than the 230 recorded in the spec.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/<TS>_backfill_session_user_id_from_events.sql
git commit -m "fix(analytics): backfill user_id onto orphaned sessions

Recovers the sessions the INSERT-only write path stranded. Adopts from
user_events, the first-hand evidence of who was in the session, rather than
from visitor_identities, which is many-to-one and would guess on a shared
browser. Only touches rows where user_id is null."
```

---

### Task 4: Per-account analytics exclusion

The policy says "contact us … and we will exclude your account". Today `AnalyticsProvider.tsx:10` has `const EXCLUDED_EMAILS = new Set<string>()` — hardcoded, empty, client-side, and unshippable as a real control. This needs a persisted flag the ingest path honours.

**Files:**

- Create: `supabase/migrations/<TS>_analytics_excluded_users.sql`
- Create: `packages/backend/src/user-analytics/analytics-exclusion.service.ts`
- Create: `packages/backend/src/user-analytics/__tests__/analytics-exclusion.service.spec.ts`
- Modify: `packages/backend/src/user-analytics/event-ingestion.service.ts` (drop excluded rows)
- Modify: `packages/backend/src/user-analytics/user-analytics.module.ts` (provide the service)

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:

  ```typescript
  class AnalyticsExclusionService {
    isExcluded(userId: string | null | undefined): Promise<boolean>;
    filterExcluded<T extends { user_id?: string | null }>(
      events: T[],
    ): Promise<T[]>;
  }
  ```

- [ ] **Step 1: Write the migration**

```sql
-- Accounts excluded from analytics collection at the user's request.
--
-- The Privacy Policy commits to honouring an exclusion request, so this has to
-- be durable and enforced server-side. The previous mechanism was a hardcoded,
-- empty Set in AnalyticsProvider.tsx: client-side, unshippable, and trivially
-- bypassed by a stale bundle.
--
-- Distinct from is_internal, which marks OUR OWN browsing and is a filtering
-- convenience — those rows are still written. Exclusion means the rows are
-- never written at all.

create table if not exists public.analytics_excluded_users (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  reason      text,
  excluded_at timestamptz not null default now(),
  excluded_by uuid references auth.users(id) on delete set null
);

alter table public.analytics_excluded_users enable row level security;

-- Service role only. No client ever reads or writes this directly; the admin
-- API is the single door. Without explicit grants a new table is unreachable
-- even to the service key.
grant select, insert, delete on public.analytics_excluded_users to service_role;

comment on table public.analytics_excluded_users is
  'Accounts that asked not to be tracked. Ingest drops their events entirely.';
```

- [ ] **Step 2: Write the failing test**

```typescript
// packages/backend/src/user-analytics/__tests__/analytics-exclusion.service.spec.ts
import { AnalyticsExclusionService } from "../analytics-exclusion.service";

describe("AnalyticsExclusionService", () => {
  const rows = [{ user_id: "excluded-user" }];

  const supabase = {
    getClient: () => ({
      from: () => ({
        select: () => Promise.resolve({ data: rows, error: null }),
      }),
    }),
  };

  const build = () => new AnalyticsExclusionService(supabase as never);

  it("reports an excluded user as excluded", async () => {
    await expect(build().isExcluded("excluded-user")).resolves.toBe(true);
  });

  it("reports an ordinary user as not excluded", async () => {
    await expect(build().isExcluded("someone-else")).resolves.toBe(false);
  });

  it("treats an anonymous event as not excluded", async () => {
    // Exclusion is per account. An event with no user_id cannot be matched to
    // one, so it must pass through rather than be dropped.
    await expect(build().isExcluded(null)).resolves.toBe(false);
  });

  it("drops only the excluded rows from a mixed batch", async () => {
    const batch = [
      { user_id: "excluded-user" },
      { user_id: "someone-else" },
      { user_id: null },
    ];
    await expect(build().filterExcluded(batch)).resolves.toEqual([
      { user_id: "someone-else" },
      { user_id: null },
    ]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/user-analytics/__tests__/analytics-exclusion.service.spec.ts`
Expected: FAIL — cannot find module `../analytics-exclusion.service`.

- [ ] **Step 4: Write the implementation**

```typescript
// packages/backend/src/user-analytics/analytics-exclusion.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

const CACHE_TTL_MS = 60_000;

/**
 * Accounts that asked not to be tracked.
 *
 * The Privacy Policy commits to honouring an exclusion request, so this is
 * enforced at ingest: the rows are never written, rather than written and
 * filtered later. That is the difference between this and `is_internal`, which
 * marks our own browsing and keeps the data.
 *
 * Cached for 60s because ingest runs on every batch and the list changes about
 * never. Fails OPEN on a query error — dropping every event because one
 * lookup failed would silently blind the whole product, and the excluded set
 * is small enough that a 60s window of over-collection is the lesser fault.
 * Mirrors InternalUserRegistryService, which resolves its ids the same way.
 */
@Injectable()
export class AnalyticsExclusionService {
  private readonly logger = new Logger(AnalyticsExclusionService.name);
  private cache: Set<string> | null = null;
  private cachedAt = 0;

  constructor(private readonly supabase: SupabaseService) {}

  private async load(): Promise<Set<string>> {
    const fresh = this.cache && Date.now() - this.cachedAt < CACHE_TTL_MS;
    if (fresh) return this.cache as Set<string>;

    const { data, error } = await this.supabase
      .getClient()
      .from("analytics_excluded_users")
      .select("user_id");

    if (error) {
      this.logger.error(`Exclusion list unavailable: ${error.message}`);
      // Fail open, and do NOT cache the failure.
      return this.cache ?? new Set<string>();
    }

    const rows = (data ?? []) as { user_id: string }[];
    this.cache = new Set(rows.map((r) => r.user_id));
    this.cachedAt = Date.now();
    return this.cache;
  }

  async isExcluded(userId: string | null | undefined): Promise<boolean> {
    if (!userId) return false;
    return (await this.load()).has(userId);
  }

  async filterExcluded<T extends { user_id?: string | null }>(
    events: T[],
  ): Promise<T[]> {
    const excluded = await this.load();
    if (excluded.size === 0) return events;
    return events.filter((e) => !e.user_id || !excluded.has(e.user_id));
  }

  /** Called by the admin write path so a new exclusion takes effect at once. */
  invalidate(): void {
    this.cache = null;
    this.cachedAt = 0;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/backend && npx jest src/user-analytics/__tests__/analytics-exclusion.service.spec.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Wire it into ingest**

In `event-ingestion.service.ts`, inject `AnalyticsExclusionService` and apply it immediately after `validateEvents()` returns, before any write:

```typescript
// Honour account-level exclusion before anything is persisted. Filtering
// here rather than at read time is what makes the Privacy Policy accurate:
// the rows are never written.
const permitted = await this.exclusion.filterExcluded(validEvents);
if (permitted.length === 0) return;
```

Then use `permitted` for the `user_events` upsert and the `upsertSession` call. Register `AnalyticsExclusionService` in `user-analytics.module.ts` providers.

- [ ] **Step 7: Verify the whole module still passes**

Run: `cd packages/backend && npx jest src/user-analytics && npx tsc --noEmit`
Expected: all green. Fix any ingest spec that now needs the new provider mocked.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/<TS>_analytics_excluded_users.sql \
        packages/backend/src/user-analytics/analytics-exclusion.service.ts \
        packages/backend/src/user-analytics/__tests__/analytics-exclusion.service.spec.ts \
        packages/backend/src/user-analytics/event-ingestion.service.ts \
        packages/backend/src/user-analytics/user-analytics.module.ts
git commit -m "feat(analytics): enforce per-account tracking exclusion at ingest

The Privacy Policy commits to excluding an account on request. The only
existing mechanism was a hardcoded empty Set in AnalyticsProvider: client
side, so a stale bundle bypassed it, and never populated anyway.

Excluded events are dropped before any write, which is what makes the policy
true rather than approximately true. Distinct from is_internal, which marks
our own browsing and keeps the rows. Fails open on a lookup error, because
dropping all telemetry over one failed query would blind the product for a
smaller wrong than 60 seconds of over-collection."
```

---

### Task 5: Track admin pageviews

`pageview-tracker.ts:56` returns early on any path starting with `/admin`, so the heaviest users are invisible in their own timeline. Internal traffic is already `is_internal`-flagged and filterable at read time, so a capture hole is the wrong mechanism.

**Files:**

- Modify: `packages/frontend/lib/analytics/pageview-tracker.ts:56`
- Test: `packages/frontend/lib/analytics/__tests__/pageview-tracker-admin-paths.test.ts` (create)

**Interfaces:**

- Consumes: `hasOptedOutOfTracking` from Task 1 (indirectly, via `trackEvent`).
- Produces: no new exports.

- [ ] **Step 1: Read the current guard**

Read `packages/frontend/lib/analytics/pageview-tracker.ts` in full (it is short) and locate the exact early-return line and the surrounding hook, so the test mocks match reality.

- [ ] **Step 2: Write the failing test**

```typescript
// packages/frontend/lib/analytics/__tests__/pageview-tracker-admin-paths.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const trackEvent = vi.fn();
vi.mock("../tracker", () => ({
  trackEvent,
  isTrackingExcluded: () => false,
}));

/**
 * Admin paths were skipped entirely, which blanked the timeline for exactly
 * the users who use the product most. is_internal already lets a reader
 * exclude our own browsing at query time, so suppressing capture was solving
 * a read-side problem with a write-side hole.
 */
describe("pageview tracker covers admin paths", () => {
  beforeEach(() => trackEvent.mockClear());

  it("emits a pageview for an admin path", async () => {
    const { shouldTrackPageview } = await import("../pageview-tracker");
    expect(shouldTrackPageview("/admin/entitlements/users")).toBe(true);
  });

  it("still emits for ordinary paths", async () => {
    const { shouldTrackPageview } = await import("../pageview-tracker");
    expect(shouldTrackPageview("/map")).toBe(true);
  });

  it("skips an empty path", async () => {
    const { shouldTrackPageview } = await import("../pageview-tracker");
    expect(shouldTrackPageview("")).toBe(false);
    expect(shouldTrackPageview(null)).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/frontend && npx vitest run lib/analytics/__tests__/pageview-tracker-admin-paths.test.ts`
Expected: FAIL — `shouldTrackPageview` is not exported.

- [ ] **Step 4: Extract and change the predicate**

In `pageview-tracker.ts`, replace the inline guard with an exported, testable predicate:

```typescript
/**
 * Whether a path should emit a pageview.
 *
 * Admin paths used to be excluded here. They are not any more: `is_internal`
 * already lets a reader filter our own browsing at query time, and skipping
 * capture instead left the per-user timeline blank for the heaviest users.
 * Exported so the rule is unit-testable rather than buried in an effect.
 */
export function shouldTrackPageview(pathname: string | null): boolean {
  return Boolean(pathname);
}
```

Then in the hook, replace `if (!pathname || pathname.startsWith("/admin")) return;` with `if (!shouldTrackPageview(pathname)) return;`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/frontend && npx vitest run lib/analytics/__tests__/ && npx eslint lib/analytics/pageview-tracker.ts`
Expected: PASS; eslint clean.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/lib/analytics/pageview-tracker.ts \
        packages/frontend/lib/analytics/__tests__/pageview-tracker-admin-paths.test.ts
git commit -m "feat(analytics): stop skipping admin paths in pageview tracking

The early return on /admin blanked the timeline for exactly the users who use
the product most. is_internal already lets a reader exclude our own browsing
at query time, so this was solving a read-side concern with a write-side hole.
Predicate extracted and exported so the rule is testable."
```

---

**Phase 1 gate:** re-run the orphan query (0 rows), and confirm with GPC set in a browser that `/api/usage/events` receives nothing.

---

# PHASE 2 — Read layer (Postgres RPCs)

> All aggregation happens in SQL. The `/admin/analytics` rebuild exists because six panels derived population statistics from a silently-capped 1,000-row PostgREST array. Do not reintroduce that.

### Task 6: `analytics_user_activity_rollup` RPC

One call returns behaviour summaries for a whole set of users, so the list page never fans out N+1.

**Files:**

- Create: `supabase/migrations/<TS>_analytics_user_activity_rollup.sql`

**Interfaces:**

- Consumes: Task 3's backfilled `user_sessions.user_id`.
- Produces: RPC `analytics_user_activity_rollup(p_user_ids uuid[], p_days int)` returning columns `user_id uuid, last_seen_at timestamptz, session_count bigint, sessions_last_7d bigint, event_count bigint, unique_features bigint, top_feature text, frustration_count bigint, paywall_count bigint, device_mix jsonb, daily_counts bigint[]`. Task 10 maps these; Task 14 consumes `sessions_last_7d` and `unique_features`.

- [ ] **Step 1: Write the migration**

Timestamp via `date -u +%Y%m%d%H%M%S`.

```sql
-- Per-user behaviour rollup for the entitlements users list and detail header.
--
-- Takes an ARRAY of user ids so the list page makes one round trip for every
-- row on screen rather than one per user. Returns a row for every id passed,
-- including users with no activity at all: a left join from the requested set
-- means "no sessions" comes back as 0 rather than as a missing row the caller
-- has to reconcile.
--
-- No is_bot filter anywhere. Crawlers never carry a user_id, so scoping on one
-- already excludes them; adding the filter would be noise that implies a
-- contamination risk that does not exist here.

create or replace function public.analytics_user_activity_rollup(
  p_user_ids uuid[],
  p_days int default 30
)
returns table (
  user_id           uuid,
  last_seen_at      timestamptz,
  session_count     bigint,
  sessions_last_7d  bigint,
  event_count       bigint,
  unique_features   bigint,
  top_feature       text,
  frustration_count bigint,
  paywall_count     bigint,
  device_mix        jsonb,
  daily_counts      bigint[]
)
language sql
stable
as $$
  with bounds as (
    select now() - make_interval(days => p_days) as win_start,
           now() - interval '7 days'             as week_start,
           current_date - (p_days - 1)           as first_day
  ),
  target as (
    select distinct unnest(p_user_ids) as user_id
  ),
  sess as (
    select s.user_id,
           s.session_id,
           s.started_at,
           s.last_activity_at,
           coalesce(s.device_type, 'unknown') as device_type
    from public.user_sessions s
    join target t on t.user_id = s.user_id
    cross join bounds b
    where s.started_at >= b.win_start
  ),
  ev as (
    select e.user_id, e.event_category, e.event_action, e.created_at
    from public.user_events e
    join target t on t.user_id = e.user_id
    cross join bounds b
    where e.created_at >= b.win_start
  ),
  sess_agg as (
    select s.user_id,
           max(s.last_activity_at) as last_seen_at,
           count(*)                as session_count,
           count(*) filter (
             where s.started_at >= (select week_start from bounds)
           )                       as sessions_last_7d
    from sess s
    group by s.user_id
  ),
  device_agg as (
    select d.user_id, jsonb_object_agg(d.device_type, d.n) as device_mix
    from (
      select user_id, device_type, count(*) as n
      from sess group by 1, 2
    ) d
    group by d.user_id
  ),
  ev_agg as (
    select e.user_id,
           count(*) as event_count,
           -- Distinct feature ACTIONS, not raw events: "used 7 features" means
           -- seven different things, not seven clicks on one.
           count(distinct e.event_action)
             filter (where e.event_category = 'feature') as unique_features,
           count(*) filter (where e.event_category = 'frustration')
             as frustration_count,
           -- Every way the product told this user no. paywall.view is the
           -- canonical one; the two conversion actions are the limit and prompt
           -- variants, and all three mean the same thing to a reader.
           count(*) filter (
             where e.event_category = 'paywall'
                or e.event_action in ('market_limit_hit', 'upgrade_prompt_shown')
           ) as paywall_count
    from ev e
    group by e.user_id
  ),
  top_feat as (
    select distinct on (f.user_id) f.user_id, f.event_action
    from (
      select user_id, event_action, count(*) as n
      from ev where event_category = 'feature'
      group by 1, 2
    ) f
    -- event_action as the tiebreak keeps the result deterministic; without it
    -- a user with two equally-used features gets a different answer per call.
    order by f.user_id, f.n desc, f.event_action asc
  ),
  day_series as (
    select t.user_id, gs.d::date as d
    from target t
    cross join bounds b
    cross join generate_series(b.first_day, current_date, interval '1 day') gs(d)
  ),
  daily as (
    select ds.user_id, ds.d, count(e.created_at) as n
    from day_series ds
    left join ev e
      on e.user_id = ds.user_id
     and e.created_at >= ds.d
     and e.created_at <  ds.d + interval '1 day'
    group by 1, 2
  ),
  daily_agg as (
    -- Dense array, one slot per day in the window, ordered oldest to newest.
    -- The sparkline needs the zero days present; a sparse series would compress
    -- a fortnight of silence into a flat line that looks like steady use.
    select user_id, array_agg(n order by d) as daily_counts
    from daily group by user_id
  )
  select t.user_id,
         sa.last_seen_at,
         coalesce(sa.session_count, 0),
         coalesce(sa.sessions_last_7d, 0),
         coalesce(ea.event_count, 0),
         coalesce(ea.unique_features, 0),
         tf.event_action::text,
         coalesce(ea.frustration_count, 0),
         coalesce(ea.paywall_count, 0),
         coalesce(da.device_mix, '{}'::jsonb),
         coalesce(dg.daily_counts, array[]::bigint[])
  from target t
  left join sess_agg   sa on sa.user_id = t.user_id
  left join device_agg da on da.user_id = t.user_id
  left join ev_agg     ea on ea.user_id = t.user_id
  left join top_feat   tf on tf.user_id = t.user_id
  left join daily_agg  dg on dg.user_id = t.user_id;
$$;

grant execute on function public.analytics_user_activity_rollup(uuid[], int)
  to service_role;
```

- [ ] **Step 2: Apply the migration**

Apply via `mcp__supabase-db__apply_migration`, then `mcp__supabase-db__list_migrations` to confirm it is the max version.

- [ ] **Step 3: Verify against direct SQL — this is the real test**

An RPC that returns plausible numbers is the exact failure mode this project already paid for. Reconcile, do not eyeball.

```sql
-- Pick the most active identified user.
with top as (
  select user_id from public.user_events
  where user_id is not null group by 1 order by count(*) desc limit 1
)
select r.user_id, r.session_count, r.event_count, r.unique_features,
       r.top_feature, r.frustration_count, r.paywall_count,
       array_length(r.daily_counts, 1) as sparkline_len,
       -- Independent recount, same window, no RPC involved.
       (select count(*) from public.user_events e
        where e.user_id = r.user_id
          and e.created_at >= now() - interval '30 days') as direct_event_count,
       (select count(*) from public.user_sessions s
        where s.user_id = r.user_id
          and s.started_at >= now() - interval '30 days') as direct_session_count
from public.analytics_user_activity_rollup(
       array(select user_id from top), 30) r;
```

Expected: `event_count = direct_event_count`, `session_count = direct_session_count`, `sparkline_len = 30`.

- [ ] **Step 4: Verify the zero-activity case**

```sql
select * from public.analytics_user_activity_rollup(
  array['00000000-0000-0000-0000-000000000000'::uuid], 30);
```

Expected: exactly **one** row, `session_count = 0`, `event_count = 0`, `last_seen_at` null, `device_mix = {}`, `daily_counts` a 30-element array of zeros. A missing row here is a bug — the list page needs a row per user it asked about.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/<TS>_analytics_user_activity_rollup.sql
git commit -m "feat(analytics): add per-user activity rollup RPC

Aggregates in SQL and takes an array of user ids, so the users list makes one
round trip for the whole page instead of one per row. Returns a row for every
id requested, including users with no activity, so the caller reads a 0 rather
than reconciling a missing row.

Sparkline is a dense array with a slot per day: a sparse series would compress
a fortnight of silence into a flat line indistinguishable from steady use.
No is_bot filter, because crawlers never carry a user_id and scoping on one
already excludes them."
```

---

### Task 7: `analytics_user_timeline` RPC

**Files:**

- Create: `supabase/migrations/<TS>_analytics_user_timeline.sql`

**Interfaces:**

- Consumes: Task 3's backfill.
- Produces: RPC `analytics_user_timeline(p_user_id uuid, p_days int, p_limit int, p_before timestamptz)` returning `session_id text, started_at timestamptz, duration_seconds int, page_count int, device_type text, browser text, os text, landing_page text, exit_page text, had_frustration boolean, converted boolean, events jsonb`. Each `events` element has keys `occurred_at, event_category, event_action, page_path, previous_page_path, label, properties`. Task 10 maps these to `UserTimelineSession`; Task 12 narrates each element.

- [ ] **Step 1: Write the migration**

```sql
-- One user's sessions, newest first, each with its events nested.
--
-- Sessions are the unit of pagination, not events. Paginating events would cut
-- a session in half across a page boundary and make "what did they do in that
-- visit" unanswerable without stitching pages back together in the client.
--
-- Keyset pagination on started_at via p_before rather than OFFSET: offsets
-- drift when new sessions arrive mid-scroll, silently repeating or skipping a
-- session.
--
-- The nested events subquery scopes on session_id ALONE, deliberately. A
-- session that began anonymous and acquired a user_id partway through holds
-- pre-auth events with user_id null, and those are the most interesting part of
-- a first visit. Filtering them on user_id would delete the beginning of every
-- signup story.

create or replace function public.analytics_user_timeline(
  p_user_id uuid,
  p_days int default 90,
  p_limit int default 25,
  p_before timestamptz default null
)
returns table (
  session_id       text,
  started_at       timestamptz,
  duration_seconds int,
  page_count       int,
  device_type      text,
  browser          text,
  os               text,
  landing_page     text,
  exit_page        text,
  had_frustration  boolean,
  converted        boolean,
  events           jsonb
)
language sql
stable
as $$
  with picked as (
    select s.session_id, s.started_at, s.duration_seconds, s.page_count,
           s.device_type, s.browser, s.os, s.landing_page, s.exit_page,
           coalesce(s.had_frustration_event, false) as had_frustration,
           coalesce(s.converted, false)             as converted
    from public.user_sessions s
    where s.user_id = p_user_id
      and s.started_at >= now() - make_interval(days => p_days)
      and (p_before is null or s.started_at < p_before)
    order by s.started_at desc
    limit p_limit
  )
  select p.session_id::text,
         p.started_at,
         p.duration_seconds,
         p.page_count,
         p.device_type::text,
         p.browser::text,
         p.os::text,
         p.landing_page::text,
         p.exit_page::text,
         p.had_frustration,
         p.converted,
         coalesce((
           select jsonb_agg(
                    jsonb_build_object(
                      'occurred_at',        e.created_at,
                      'event_category',     e.event_category,
                      'event_action',       e.event_action,
                      'page_path',          e.page_path,
                      'previous_page_path', e.previous_page_path,
                      'label',              e.event_label,
                      'properties',         e.properties
                    ) order by e.created_at asc)
           from public.user_events e
           where e.session_id = p.session_id
         ), '[]'::jsonb)
  from picked p
  order by p.started_at desc;
$$;

grant execute on function
  public.analytics_user_timeline(uuid, int, int, timestamptz) to service_role;
```

- [ ] **Step 2: Apply and confirm**

Apply via MCP; confirm with `list_migrations`.

- [ ] **Step 3: Verify shape and content against a real user**

```sql
with top as (
  select user_id from public.user_events
  where user_id is not null group by 1 order by count(*) desc limit 1
)
select session_id, started_at, duration_seconds, had_frustration,
       jsonb_array_length(events) as event_count,
       events -> 0 -> 'event_action'  as first_action,
       events -> 0 -> 'properties'    as first_props
from public.analytics_user_timeline(
       (select user_id from top), 120, 5, null);
```

Expected: up to 5 rows, newest first. `event_count > 0` on at least one. `first_props` must be a populated object, not null — the narration in Task 12 depends on it.

- [ ] **Step 4: Verify keyset pagination does not repeat or skip**

```sql
with top as (
  select user_id from public.user_events
  where user_id is not null group by 1 order by count(*) desc limit 1
),
page1 as (
  select session_id, started_at
  from public.analytics_user_timeline((select user_id from top), 365, 2, null)
),
page2 as (
  select session_id
  from public.analytics_user_timeline(
    (select user_id from top), 365, 2,
    (select min(started_at) from page1))
)
select (select count(*) from page1) as page1_rows,
       (select count(*) from page2) as page2_rows,
       (select count(*) from page1 p1 join page2 p2 using (session_id))
         as overlap;
```

Expected: `overlap = 0`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/<TS>_analytics_user_timeline.sql
git commit -m "feat(analytics): add per-user session timeline RPC

Sessions are the pagination unit, not events: paging events would split a
session across a boundary and make what happened in one visit unanswerable
without restitching in the client. Keyset on started_at rather than OFFSET,
which drifts and silently repeats or skips rows when sessions arrive
mid-scroll.

The nested events subquery scopes on session_id alone, on purpose. A session
that starts anonymous and acquires a user_id partway through holds pre-auth
events with a null user_id, and those are the opening of every first visit.
Filtering on user_id there would delete the start of the story."
```

---

### Task 8: Feature adoption and friction leaderboard RPCs

**Refinement against the spec:** §12 describes one RPC returning the matrix, the segment counts and the friction leaderboard. A single `returns table` cannot carry three different shapes cleanly, and segment counts are derived from the rollup the client already holds. So: two RPCs, and segments are computed client-side from Task 6's output via Task 14's classifier.

**Files:**

- Create: `supabase/migrations/<TS>_analytics_user_feature_adoption.sql`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `analytics_user_feature_adoption(p_days int)` → `event_action text, user_tier text, users bigint, events bigint`; `analytics_user_friction_leaderboard(p_days int, p_limit int)` → `kind text, detail text, users bigint, occurrences bigint`.

- [ ] **Step 1: Write the migration**

```sql
-- Cross-user behaviour, derived from the same rows as the per-user views so the
-- two can never disagree.
--
-- Denominators are the caller's job to display, and the API returns raw counts
-- rather than percentages for that reason: at 26 external users a percentage
-- reads as a statistic when it is really "2 of 26", and presenting it as the
-- former is how the previous dashboard ended up confidently wrong.

create or replace function public.analytics_user_feature_adoption(
  p_days int default 30
)
returns table (
  event_action text,
  user_tier    text,
  users        bigint,
  events       bigint
)
language sql
stable
as $$
  select e.event_action::text,
         coalesce(e.user_tier, 'unknown')::text,
         count(distinct e.user_id),
         count(*)
  from public.user_events e
  where e.user_id is not null
    and e.event_category = 'feature'
    and e.created_at >= now() - make_interval(days => p_days)
  group by 1, 2
  order by 3 desc, 1 asc;
$$;

-- Where the product tells people no, or breaks.
--
-- Ranked by DISTINCT USERS, not occurrences. One user in a retry loop can
-- generate hundreds of identical errors — 552 of the frustration events in the
-- live data come from two users — so ranking by volume would put a single
-- person's bad afternoon above something hitting everybody.
create or replace function public.analytics_user_friction_leaderboard(
  p_days int default 30,
  p_limit int default 20
)
returns table (
  kind        text,
  detail      text,
  users       bigint,
  occurrences bigint
)
language sql
stable
as $$
  with scoped as (
    select e.user_id, e.event_category, e.event_action, e.page_path, e.properties
    from public.user_events e
    where e.user_id is not null
      and e.created_at >= now() - make_interval(days => p_days)
      and (e.event_category in ('frustration', 'paywall')
        or e.event_action in ('market_limit_hit', 'upgrade_prompt_shown'))
  )
  select case when s.event_category = 'frustration' then 'error' else 'paywall' end,
         -- Errors are identified by their message, paywalls by where they fired.
         -- Grouping errors by page would merge unrelated bugs on a busy route.
         coalesce(
           case when s.event_category = 'frustration'
                then s.properties ->> 'error_message'
                else s.page_path end,
           s.event_action)::text,
         count(distinct s.user_id),
         count(*)
  from scoped s
  group by 1, 2
  order by 3 desc, 4 desc
  limit p_limit;
$$;

grant execute on function public.analytics_user_feature_adoption(int)
  to service_role;
grant execute on function public.analytics_user_friction_leaderboard(int, int)
  to service_role;
```

- [ ] **Step 2: Apply and confirm**

Apply via MCP; confirm with `list_migrations`.

- [ ] **Step 3: Verify both return real rows**

```sql
select * from public.analytics_user_feature_adoption(120) limit 10;
select * from public.analytics_user_friction_leaderboard(120, 10);
```

Expected: adoption shows `region_select`, `report_view`, `search`, `score_view` among others. Friction shows at least one `error` row carrying a real message string and at least one `paywall` row. If `detail` is null anywhere, the coalesce chain is wrong — fix before moving on.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/<TS>_analytics_user_feature_adoption.sql
git commit -m "feat(analytics): add feature adoption and friction leaderboard RPCs

Two functions rather than the one the spec described, because a single returns
table cannot carry a matrix, segment counts and a leaderboard cleanly, and the
segment counts are derivable from the rollup the client already holds.

Returns raw counts, never percentages. At 26 external users a percentage reads
as a statistic when it actually means 2 of 26, and dressing it up as the former
is how the previous dashboard became confidently wrong.

Friction ranks by distinct users, not occurrences: 552 of the live frustration
events come from two people, so ranking by volume would put one bad afternoon
above something affecting everyone."
```

---

**Phase 2 gate:** every RPC reconciled against an independent direct-SQL recount, and the zero-activity case returns a row rather than nothing.

---

Phases 3-8 continue in this file below.
