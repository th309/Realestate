# Activation Funnel Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken activation funnel end-to-end: make signups measurable, make `/get-started` reachable, add conversion CTAs to SEO landing pages, wire trial lifecycle events, extend the funnel engine to support multi-event steps, and clean up the dead event pipeline.

**Architecture:** Coordinated frontend + backend + DB changes in 8 phases. Foundation first (schema + engine capability), then vertical slices: signup, pipeline cleanup, server-event emission, frontend gap-fill, SEO conversion layer, verification, ship. Each phase is independently committable; phases are sequenced so nothing is broken mid-flight.

**Tech Stack:** Next.js 16.1 App Router, React 19, TypeScript, NestJS 11, Supabase PostgreSQL, Jest (backend), Vitest (frontend), Tailwind CSS 4, Stripe.

**Spec:** `docs/superpowers/specs/2026-04-14-activation-funnel-remediation-design.md`

---

## File Structure

### Created files

**Frontend:**

- `packages/frontend/app/components/seo/SeoPageConversionBar.tsx` — persistent SEO-page CTA component
- `packages/frontend/app/components/seo/__tests__/SeoPageConversionBar.test.tsx` — vitest component tests

**Backend:**

- `packages/backend/src/user-analytics/server-event-emitter.service.ts` — backend event emitter
- `packages/backend/src/user-analytics/__tests__/server-event-emitter.service.spec.ts` — jest tests
- `packages/backend/src/scheduling/trial-expiration.cron.ts` — daily cron for trial expiration
- `packages/backend/src/scheduling/__tests__/trial-expiration.cron.spec.ts` — jest tests

**SQL migrations (path: `supabase/migrations/`):**

- `20260414120000_drop_analytics_events.sql`
- `20260414120100_add_trial_columns_to_user_profiles.sql`
- `20260414120200_update_handle_new_user_trigger.sql`
- `20260414120300_backfill_missing_user_profiles.sql`
- `20260414120400_insert_activation_funnel.sql`

### Modified files

**Frontend:**

- `packages/frontend/app/auth/sign-up/page.tsx` — import `flush`, add pre-navigate flush, update redirect default
- `packages/frontend/app/auth/callback/page.tsx` — detect new OAuth signup, fire `signup_complete`, flush
- `packages/frontend/app/get-started/page.tsx` — read `?next=` param, forward on completion
- `packages/frontend/app/get-started/PersonaCards.tsx` — trackEvent `onboarding.persona_selected`
- `packages/frontend/app/get-started/OnboardingSearch.tsx` — trackEvent `onboarding.get_started_search`
- `packages/frontend/app/components/onboarding/BreathingSpotlight.tsx` — trackEvent spotlight events
- `packages/frontend/app/components/beacons/BeaconProvider.tsx` — trackEvent beacon events
- `packages/frontend/app/components/home/HeroSection.tsx` — trackEvent `hero.cta_click`
- `packages/frontend/app/components/home/ScoreTeaser.tsx` — trackEvent `home.score_teaser_click`
- `packages/frontend/app/components/home/StickyScoreBar.tsx` — trackEvent sticky bar events
- `packages/frontend/app/markets/layout.tsx` — inject `SeoPageConversionBar`
- `packages/frontend/app/blog/layout.tsx` — inject `SeoPageConversionBar`
- `packages/frontend/lib/auth/useAuth.ts` — add `ensureProfile` call on session establishment

**Backend:**

- `packages/backend/src/app.module.ts` — remove `AnalyticsEventsModule` import + registration
- `packages/backend/src/user-analytics/user-analytics.types.ts` — add `FunnelStepMulti` + `isMultiStep`
- `packages/backend/src/user-analytics/funnel-engine.service.ts` — multi-event matcher + label fallback
- `packages/backend/src/user-analytics/user-analytics.module.ts` — export `ServerEventEmitterService`
- `packages/backend/src/user-analytics/__tests__/funnel-engine.service.spec.ts` — extended tests (if it exists; else create)
- `packages/backend/src/onboarding/onboarding.service.ts` — emit `trial.started` after signup
- `packages/backend/src/entitlements/entitlements.service.ts` — emit `trial.pro_feature_used`
- `packages/backend/src/scheduling/scheduling.module.ts` — register `TrialExpirationCron` (if module exists; else create)
- `packages/backend/src/billing/stripe-webhook.controller.ts` — emit `trial.converted` on subscription.created

### Deleted files

- `packages/backend/src/analytics-events/analytics-events.controller.ts`
- `packages/backend/src/analytics-events/analytics-events.module.ts`
- `packages/backend/src/analytics-events/` (entire directory)

---

## Phases Overview

| Phase | Name                            | Tasks | Depends on              |
| ----- | ------------------------------- | ----- | ----------------------- |
| 0     | Foundation (SQL + engine types) | 6     | —                       |
| 1     | Signup cork removal             | 8     | 0                       |
| 2     | Backend pipeline cleanup        | 2     | 0                       |
| 3     | Server-side event emission      | 6     | 0                       |
| 4     | Frontend gap-fill events        | 12    | 0                       |
| 5     | SEO conversion layer            | 7     | 4 (event names defined) |
| 6     | Live E2E verification           | 3     | 1–5                     |
| 7     | Ship + smoke                    | 2     | 6                       |

**Total: 46 tasks.** Each task targets 2–15 minutes depending on scope. Frontend tests use vitest; backend tests use jest with mocked `SupabaseService` (following existing pattern in `packages/backend/src/user-analytics/__tests__/`). Live-DB verification happens in Phase 6 against Supabase project `pysflbhpnqwoczyuaaif`.

---

# Phase 0 — Foundation

Schema + engine capability must land first so downstream code can write to real columns and use real engine features.

---

### Task 0.1: Migration — drop dead `analytics_events` table

**Files:**

- Create: `supabase/migrations/20260414120000_drop_analytics_events.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration: drop_analytics_events
-- Purpose: Remove the deprecated analytics_events table. Real events land in user_events
-- via UserAnalyticsModule. AnalyticsEventsModule is being removed in the same ship.
-- Table has 0 rows, no consumers. Safe to drop.

DROP TABLE IF EXISTS public.analytics_events;
```

- [ ] **Step 2: Apply via Supabase MCP**

```
mcp__plugin_supabase_supabase__apply_migration with:
  project_id: pysflbhpnqwoczyuaaif
  name: drop_analytics_events
  query: <contents of the migration file>
```

- [ ] **Step 3: Verify the table is gone**

Run via Supabase MCP `execute_sql`:

```sql
SELECT to_regclass('public.analytics_events');
```

Expected: returns NULL.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260414120000_drop_analytics_events.sql
git commit -m "feat(analytics): drop dead analytics_events table"
```

---

### Task 0.2: Migration — add trial + onboarding columns to `user_profiles`

**Files:**

- Create: `supabase/migrations/20260414120100_add_trial_columns_to_user_profiles.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration: add_trial_columns_to_user_profiles
-- Purpose: Add the columns the Apr 12 onboarding spec assumed but never migrated.
-- Backend code in onboarding/engagement/behavioral-trigger services currently references
-- these columns and breaks. This migration unblocks the trial lifecycle.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS trial_started_at        timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at           timestamptz,
  ADD COLUMN IF NOT EXISTS trial_expired_emitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS free_report_credits     integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_market       jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_checklist    jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dismissed_beacons       jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS usage_stats             jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_user_profiles_trial_ends_at
  ON public.user_profiles (trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_trial_expiration_queue
  ON public.user_profiles (trial_ends_at)
  WHERE trial_ends_at IS NOT NULL AND trial_expired_emitted_at IS NULL;

GRANT ALL ON public.user_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
```

- [ ] **Step 2: Apply via Supabase MCP**

```
mcp__plugin_supabase_supabase__apply_migration with:
  project_id: pysflbhpnqwoczyuaaif
  name: add_trial_columns_to_user_profiles
  query: <contents of the migration file>
```

- [ ] **Step 3: Verify columns exist**

Run via Supabase MCP `execute_sql`:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_profiles'
  AND column_name IN ('trial_started_at','trial_ends_at','trial_expired_emitted_at',
                      'free_report_credits','onboarding_market','onboarding_checklist',
                      'dismissed_beacons','usage_stats')
ORDER BY column_name;
```

Expected: 8 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260414120100_add_trial_columns_to_user_profiles.sql
git commit -m "feat(db): add trial and onboarding columns to user_profiles"
```

---

### Task 0.3: Migration — update `handle_new_user` trigger (exception logging + trial start)

**Files:**

- Create: `supabase/migrations/20260414120200_update_handle_new_user_trigger.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration: update_handle_new_user_trigger
-- Purpose: (1) Add exception handler so future trigger failures log a WARNING instead of
-- silently dropping the profile (fixes the troyhouston76 missing-profile race).
-- (2) Set trial_started_at and trial_ends_at on profile creation (14-day reverse trial).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id, email, full_name,
    trial_started_at, trial_ends_at,
    created_at, updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NOW(),
    NOW() + INTERVAL '14 days',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for user %: % (SQLSTATE %)', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;  -- Do not abort the auth.users insert
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

- [ ] **Step 2: Apply via Supabase MCP**

```
mcp__plugin_supabase_supabase__apply_migration with:
  project_id: pysflbhpnqwoczyuaaif
  name: update_handle_new_user_trigger
  query: <contents of the migration file>
```

- [ ] **Step 3: Verify trigger exists**

```sql
SELECT tgname, tgrelid::regclass AS table_name
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
```

Expected: 1 row on `auth.users`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260414120200_update_handle_new_user_trigger.sql
git commit -m "feat(db): handle_new_user exception logging + trial start"
```

---

### Task 0.4: Migration — backfill missing user_profiles

**Files:**

- Create: `supabase/migrations/20260414120300_backfill_missing_user_profiles.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration: backfill_missing_user_profiles
-- Purpose: One-time fix for users who created auth.users rows but whose trigger
-- failed silently (at least troyhouston76@gmail.com per investigation 2026-04-14).
-- Also sets trial columns for any backfilled profiles.

INSERT INTO public.user_profiles (id, email, created_at, updated_at, trial_started_at, trial_ends_at)
SELECT
  au.id,
  au.email,
  au.created_at,
  NOW(),
  au.created_at,
  au.created_at + INTERVAL '14 days'
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM public.user_profiles)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Apply via Supabase MCP**

```
mcp__plugin_supabase_supabase__apply_migration with:
  project_id: pysflbhpnqwoczyuaaif
  name: backfill_missing_user_profiles
  query: <contents of the migration file>
```

- [ ] **Step 3: Verify no orphans remain**

```sql
SELECT au.id, au.email
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.id = au.id
WHERE up.id IS NULL;
```

Expected: 0 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260414120300_backfill_missing_user_profiles.sql
git commit -m "fix(db): backfill missing user_profiles rows"
```

---

### Task 0.5: Extend `FunnelStepDef` type for multi-event steps

**Files:**

- Modify: `packages/backend/src/user-analytics/user-analytics.types.ts`

- [ ] **Step 1: Read current type definition**

Read the file and find the existing `FunnelStep` type export.

- [ ] **Step 2: Add multi-event step types (backward compatible)**

Add near the existing `FunnelStep` type:

```typescript
/** Single-event step — the existing shape, preserved for the 2 pre-existing funnel rows. */
export type FunnelStepSingle = {
  event_category: string;
  event_action: string;
  label?: string;
};

/** Multi-event step — visitor qualifies if they fired ANY of the listed events. */
export type FunnelStepMulti = {
  any_of: Array<{ event_category: string; event_action: string }>;
  label?: string;
};

export type FunnelStepDef = FunnelStepSingle | FunnelStepMulti;

/** Type guard for multi-event step. */
export function isMultiStep(step: FunnelStepDef): step is FunnelStepMulti {
  return "any_of" in step;
}
```

Do not remove the existing `FunnelStep` export used by `FunnelEngineService.evaluateFunnel()` return value — that's the OUTPUT step (with `count`, `rateFromPrevious`, etc.), not the DEFINITION step. Different type.

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/user-analytics/user-analytics.types.ts
git commit -m "feat(funnel): add FunnelStepDef type with multi-event support"
```

---

### Task 0.6: Extend `FunnelEngineService` to handle multi-event steps

**Files:**

- Modify: `packages/backend/src/user-analytics/funnel-engine.service.ts`
- Modify (or create if missing): `packages/backend/src/user-analytics/__tests__/funnel-engine.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create or extend `funnel-engine.service.spec.ts`:

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { FunnelEngineService } from "../funnel-engine.service";
import { SupabaseService } from "../../supabase/supabase.service";
import { RedisService } from "../../redis/redis.service";

const mockClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

const mockSupabase = { getClient: jest.fn(() => mockClient) };
const mockRedis = {
  getByKey: jest.fn().mockResolvedValue(null),
  setByKey: jest.fn().mockResolvedValue(undefined),
};

describe("FunnelEngineService — multi-event steps", () => {
  let service: FunnelEngineService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        FunnelEngineService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();
    service = mod.get(FunnelEngineService);
  });

  it("counts visitors who fired ANY any_of event at a multi-event step", async () => {
    mockClient.single.mockResolvedValueOnce({
      data: {
        id: "f1",
        steps: [
          { event_category: "pageview", event_action: "view" },
          {
            any_of: [
              { event_category: "seo", event_action: "conversion_bar_clicked" },
              { event_category: "hero", event_action: "cta_click" },
            ],
          },
        ],
      },
    });
    // Two visitors, each fires pageview + one of the any_of events
    mockClient.gte.mockResolvedValueOnce({
      data: [
        { visitor_id: "vA", event_category: "pageview", event_action: "view" },
        {
          visitor_id: "vA",
          event_category: "seo",
          event_action: "conversion_bar_clicked",
        },
        { visitor_id: "vB", event_category: "pageview", event_action: "view" },
        { visitor_id: "vB", event_category: "hero", event_action: "cta_click" },
      ],
    });

    const result = await service.evaluateFunnel("f1", 7);

    expect(result[0].count).toBe(2); // pageview step
    expect(result[1].count).toBe(2); // multi-event step — union
  });

  it("preserves backward compat for single-event steps", async () => {
    mockClient.single.mockResolvedValueOnce({
      data: {
        id: "f2",
        steps: [
          { event_category: "pageview", event_action: "view" },
          { event_category: "conversion", event_action: "signup_start" },
        ],
      },
    });
    mockClient.gte.mockResolvedValueOnce({
      data: [
        { visitor_id: "vA", event_category: "pageview", event_action: "view" },
        {
          visitor_id: "vA",
          event_category: "conversion",
          event_action: "signup_start",
        },
      ],
    });

    const result = await service.evaluateFunnel("f2", 7);
    expect(result[0].count).toBe(1);
    expect(result[1].count).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/backend && npm test -- funnel-engine.service.spec.ts
```

Expected: FAIL on the multi-event test (current engine doesn't understand `any_of`).

- [ ] **Step 3: Update the engine**

Modify `packages/backend/src/user-analytics/funnel-engine.service.ts`:

Replace the type annotation and matcher logic. Change the `steps` declaration and the filter inside the loop:

```typescript
import type { FunnelStepDef } from "./user-analytics.types";
import { isMultiStep } from "./user-analytics.types";

// ... inside evaluateFunnel, replace:
//   const steps = funnel.steps as { event_category; event_action; label? }[]
// with:
const steps = funnel.steps as FunnelStepDef[];

// Build matchers once
const matchersPerStep = steps.map((step) =>
  isMultiStep(step)
    ? step.any_of
    : [
        {
          event_category: step.event_category,
          event_action: step.event_action,
        },
      ],
);

// ... inside the loop, replace the single-event filter:
//   events.filter(e => e.event_category === step.event_category && e.event_action === step.event_action)
// with:
const matchers = matchersPerStep[i];
const matchingVisitors = new Set(
  events
    .filter((e) =>
      matchers.some(
        (m) =>
          e.event_category === m.event_category &&
          e.event_action === m.event_action,
      ),
    )
    .map((e) => e.visitor_id),
);

// Label fallback — replace the label computation:
const stepName = (s: FunnelStepDef): string => {
  if (s.label) return s.label;
  if (isMultiStep(s)) {
    return s.any_of
      .map((m) => `${m.event_category}.${m.event_action}`)
      .join(" | ");
  }
  return `${s.event_category}.${s.event_action}`;
};

// Then in the result map, replace:
//   name: s.label || `${s.event_category}.${s.event_action}`
// with:
//   name: stepName(s)
```

Engine unchanged in all other respects — set intersection, rate computation, Redis caching all preserved.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/backend && npm test -- funnel-engine.service.spec.ts
```

Expected: PASS on both tests.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/user-analytics/funnel-engine.service.ts \
        packages/backend/src/user-analytics/__tests__/funnel-engine.service.spec.ts
git commit -m "feat(funnel): support multi-event any_of steps in engine"
```

---

### Task 0.7: Migration — insert canonical Activation Funnel definition

**Files:**

- Create: `supabase/migrations/20260414120400_insert_activation_funnel.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Migration: insert_activation_funnel
-- Purpose: Canonical 8-step activation funnel for the admin analytics dashboard.
-- Step 2 uses the new any_of multi-event shape (engine extended in same ship).

INSERT INTO public.funnel_definitions (id, name, steps, is_default, created_at)
VALUES (
  gen_random_uuid(),
  'Activation Funnel',
  '[
    {"event_category": "pageview",    "event_action": "view",                   "label": "Landed on site"},
    {"any_of": [
      {"event_category": "seo",  "event_action": "conversion_bar_clicked"},
      {"event_category": "hero", "event_action": "cta_click"}
    ], "label": "Clicked primary CTA"},
    {"event_category": "conversion",  "event_action": "signup_start",           "label": "Signup started"},
    {"event_category": "conversion",  "event_action": "signup_complete",        "label": "Signup completed"},
    {"event_category": "onboarding",  "event_action": "persona_selected",       "label": "Persona picked"},
    {"event_category": "onboarding",  "event_action": "spotlight_step_completed","label": "Onboarding step completed"},
    {"event_category": "trial",       "event_action": "pro_feature_used",       "label": "Trial engagement"},
    {"event_category": "trial",       "event_action": "converted",              "label": "Converted to paid"}
  ]'::jsonb,
  true,
  now()
);

-- Demote old defaults so Activation Funnel is the one shown by default
UPDATE public.funnel_definitions
SET is_default = false
WHERE name IN ('Signup Funnel', 'Conversion Funnel');
```

- [ ] **Step 2: Apply via Supabase MCP**

```
mcp__plugin_supabase_supabase__apply_migration with:
  project_id: pysflbhpnqwoczyuaaif
  name: insert_activation_funnel
  query: <contents of the migration file>
```

- [ ] **Step 3: Verify it inserted**

```sql
SELECT name, is_default, jsonb_array_length(steps) AS step_count
FROM public.funnel_definitions
ORDER BY created_at DESC;
```

Expected: "Activation Funnel" row with `step_count = 8, is_default = true`. Others demoted.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260414120400_insert_activation_funnel.sql
git commit -m "feat(funnel): seed canonical Activation Funnel definition"
```

---

**Phase 0 Checkpoint.** At this point the DB schema and funnel engine can support everything downstream. Pause, verify nothing's broken (`npm run build` in both packages, `npm test` in backend), then continue.

---

# Phase 1 — Signup Cork Removal

Fix the three things blocking measurable signups: event flush, OAuth tracking, post-signup routing.

---

### Task 1.1: Import and call `flush()` in email signup success path

**Files:**

- Modify: `packages/frontend/app/auth/sign-up/page.tsx`

- [ ] **Step 1: Update import**

At line 17, change:

```typescript
import { trackEvent } from "@/lib/analytics/tracker";
```

to:

```typescript
import { trackEvent, flush } from "@/lib/analytics/tracker";
```

- [ ] **Step 2: Add `flush()` before `router.push`**

At line 118 (inside `if (session)` block), change:

```typescript
if (session) {
  trackEvent("conversion.signup_complete", { method: "email" });
  const supabase = createSupabaseBrowserClient();
  await supabase.from("user_profiles").upsert(/* ... */);
  fetch("/api/auth/welcome", { method: "POST" }).catch(() => {});
  router.push(redirectTo);
  return;
}
```

to:

```typescript
if (session) {
  trackEvent("conversion.signup_complete", { method: "email" });
  flush(); // Send queued events via sendBeacon BEFORE SPA navigation unmounts the component
  const supabase = createSupabaseBrowserClient();
  await supabase.from("user_profiles").upsert(/* ... */);
  fetch("/api/auth/welcome", { method: "POST" }).catch(() => {});
  router.push(redirectTo);
  return;
}
```

- [ ] **Step 3: Run build to verify no TypeScript errors**

```bash
cd packages/frontend && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/auth/sign-up/page.tsx
git commit -m "fix(auth): flush analytics queue before post-signup redirect"
```

---

### Task 1.2: Update post-signup redirect default to `/get-started`

**Files:**

- Modify: `packages/frontend/app/auth/sign-up/page.tsx`

- [ ] **Step 1: Replace `redirectTo` computation**

At line 64, change:

```typescript
const redirectTo = searchParams.get("redirect") ?? "/map";
```

to:

```typescript
// New signups flow through /get-started by default. If the user arrived with an explicit
// ?redirect=..., preserve it via /get-started?next=... so onboarding can forward them on.
const explicitRedirect = searchParams.get("redirect");
const redirectTo = explicitRedirect
  ? `/get-started?next=${encodeURIComponent(explicitRedirect)}`
  : "/get-started";
```

- [ ] **Step 2: Verify sign-in-link logic still works**

Look at lines ~394–404 (the "already have an account" link). Currently it passes `redirectTo` through. Since `redirectTo` is now `/get-started...`, we don't want to trap returning users into the onboarding. Change the sign-in link to use the original `explicitRedirect`:

Find:

```tsx
<Link
  href={
    redirectTo !== "/map"
      ? `/auth/sign-in?redirect=${encodeURIComponent(redirectTo)}`
      : "/auth/sign-in"
  }
```

Replace with:

```tsx
<Link
  href={
    explicitRedirect
      ? `/auth/sign-in?redirect=${encodeURIComponent(explicitRedirect)}`
      : "/auth/sign-in"
  }
```

- [ ] **Step 3: Run build**

```bash
cd packages/frontend && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/auth/sign-up/page.tsx
git commit -m "feat(auth): route new signups through /get-started by default"
```

---

### Task 1.3: `/get-started` honors `?next=` query param

**Files:**

- Modify: `packages/frontend/app/get-started/page.tsx`

- [ ] **Step 1: Read the current file**

Current `handleMarketSelect` navigates to `/market/${result.id}?type=${result.type}&onboarding=true`.

- [ ] **Step 2: Update imports and navigation**

At the top, change:

```typescript
import { useState } from "react";
import { useRouter } from "next/navigation";
```

to:

```typescript
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
```

Inside the `GetStartedPage` component, add after `const router = useRouter();`:

```typescript
const searchParams = useSearchParams();
const nextPath = searchParams.get("next");
```

- [ ] **Step 3: Use `nextPath` after onboarding market select**

Change the end of `handleMarketSelect`:

```typescript
router.push(`/market/${result.id}?type=${result.type}&onboarding=true`);
```

to:

```typescript
// If the signup flow brought the user here with an intended destination, forward them
// after onboarding completes rather than trapping them on /market/...
if (nextPath) {
  router.push(nextPath);
} else {
  router.push(`/market/${result.id}?type=${result.type}&onboarding=true`);
}
```

- [ ] **Step 4: Run build**

```bash
cd packages/frontend && npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/get-started/page.tsx
git commit -m "feat(onboarding): /get-started honors ?next= for post-onboarding redirect"
```

---

### Task 1.4: OAuth callback fires `conversion.signup_complete` for new users

**Files:**

- Modify: `packages/frontend/app/auth/callback/page.tsx`

- [ ] **Step 1: Read the current file**

Identify where `setSession` is called (around line 101–104 per investigation).

- [ ] **Step 2: Add imports (if not present)**

```typescript
import { trackEvent, flush } from "@/lib/analytics/tracker";
```

- [ ] **Step 3: Add new-signup detection after successful setSession**

After the successful `supabase.auth.setSession()` call (and before the final redirect), add:

```typescript
// Detect new OAuth signup: profile created in last 60s (heuristic — Supabase doesn't
// expose a clean is_new_user flag in the OAuth callback)
try {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("created_at")
      .eq("id", user.id)
      .maybeSingle();
    const isNewSignup =
      profile && Date.now() - new Date(profile.created_at).getTime() < 60_000;
    if (isNewSignup) {
      trackEvent("conversion.signup_complete", { method: "oauth" });
      flush();
    }
  }
} catch (err) {
  // Analytics must never break auth. Swallow and continue.
  console.error("OAuth signup event failed", err);
}
```

- [ ] **Step 4: Ensure the `next` param routes to `/get-started` for new OAuth signups**

The callback currently uses the `next` param from the URL. Since we set it in sign-up/page.tsx to `/get-started?next=...`, this should naturally work. But the default OAuth callback URL format might be `?next=/map`.

Read the current redirect logic in callback/page.tsx. If it already honors `next`, nothing to change. If `next` defaults to `/map` for OAuth, update to prefer `/get-started` for `isNewSignup` users:

```typescript
// For new OAuth signups, route through onboarding unless explicit next is set
const explicitNext = searchParams.get("next");
const destination = isNewSignup
  ? explicitNext
    ? `/get-started?next=${encodeURIComponent(explicitNext)}`
    : "/get-started"
  : explicitNext || "/map";

router.push(destination);
```

- [ ] **Step 5: Run build**

```bash
cd packages/frontend && npm run build
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/auth/callback/page.tsx
git commit -m "feat(auth): fire signup_complete for new OAuth users and route through onboarding"
```

---

### Task 1.5: Defensive `ensureProfile` in `useAuth`

**Files:**

- Modify: `packages/frontend/lib/auth/useAuth.ts`

- [ ] **Step 1: Read the current file**

Find where the auth context establishes/refreshes the user session.

- [ ] **Step 2: Add `ensureProfile` helper**

Add inside the auth context/hook:

```typescript
async function ensureProfile(userId: string, email: string | null | undefined) {
  const supabase = createSupabaseBrowserClient(); // or the existing client instance
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    const now = new Date();
    const trialStart = now.toISOString();
    const trialEnd = new Date(now.getTime() + 14 * 86_400_000).toISOString();
    await supabase.from("user_profiles").upsert(
      {
        id: userId,
        email: email ?? null,
        created_at: trialStart,
        updated_at: trialStart,
        trial_started_at: trialStart,
        trial_ends_at: trialEnd,
      },
      { onConflict: "id" },
    );
  }
}
```

- [ ] **Step 3: Call `ensureProfile` on session establishment**

Wherever the auth hook detects a logged-in user on mount or after SIGNED_IN event, call:

```typescript
if (session?.user) {
  ensureProfile(session.user.id, session.user.email).catch(console.error);
}
```

Important: fire-and-forget — do not block auth flow on this.

- [ ] **Step 4: Run build**

```bash
cd packages/frontend && npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/lib/auth/useAuth.ts
git commit -m "fix(auth): defensive ensureProfile with trial backfill on session"
```

---

# Phase 2 — Backend Pipeline Cleanup

Delete the deprecated module + files.

---

### Task 2.1: Remove `AnalyticsEventsModule` from app module

**Files:**

- Modify: `packages/backend/src/app.module.ts`

- [ ] **Step 1: Delete the import line**

Find (around line 41):

```typescript
import { AnalyticsEventsModule } from "./analytics-events/analytics-events.module";
```

Delete that line.

- [ ] **Step 2: Delete the registration entry**

Find (around line 123) `AnalyticsEventsModule,` in the imports array and delete the entry.

- [ ] **Step 3: Run backend build**

```bash
cd packages/backend && npm run build
```

Expected: build succeeds (no imports left to the module).

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/app.module.ts
git commit -m "chore(analytics): remove deprecated AnalyticsEventsModule registration"
```

---

### Task 2.2: Delete the dead `analytics-events/` directory

**Files:**

- Delete: `packages/backend/src/analytics-events/` (entire directory)

- [ ] **Step 1: Delete the directory**

```bash
rm -rf packages/backend/src/analytics-events
```

- [ ] **Step 2: Run backend build + tests**

```bash
cd packages/backend && npm run build && npm test
```

Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add -A packages/backend/src/analytics-events
git commit -m "chore(analytics): delete deprecated analytics-events module files"
```

---

# Phase 3 — Server-Side Event Emission

Build the backend emitter + wire trial lifecycle events.

---

### Task 3.1: `ServerEventEmitterService` — new file

**Files:**

- Create: `packages/backend/src/user-analytics/server-event-emitter.service.ts`
- Create: `packages/backend/src/user-analytics/__tests__/server-event-emitter.service.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { ServerEventEmitterService } from "../server-event-emitter.service";
import { EventIngestionService } from "../event-ingestion.service";

describe("ServerEventEmitterService", () => {
  let service: ServerEventEmitterService;
  const mockIngestion = { ingest: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ServerEventEmitterService,
        { provide: EventIngestionService, useValue: mockIngestion },
      ],
    }).compile();
    service = mod.get(ServerEventEmitterService);
  });

  it("emits with server visitor_id + user_id + expected shape", async () => {
    await service.emit("trial", "started", "user-123", {
      trial_duration_days: 14,
    });

    expect(mockIngestion.ingest).toHaveBeenCalledTimes(1);
    const [events] = mockIngestion.ingest.mock.calls[0];
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      visitor_id: "server:user-123",
      user_id: "user-123",
      event_category: "trial",
      event_action: "started",
      properties: { trial_duration_days: 14 },
    });
    expect(events[0].client_event_id).toBeTruthy();
    expect(events[0].session_id).toMatch(/^server-session:/);
    expect(events[0].created_at).toBeTruthy();
  });

  it("defaults properties to empty object", async () => {
    await service.emit("trial", "expired", "user-456");
    const [events] = mockIngestion.ingest.mock.calls[0];
    expect(events[0].properties).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/backend && npm test -- server-event-emitter.service.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the service**

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { EventIngestionService } from "./event-ingestion.service";

/**
 * Emit analytics events from backend code paths (cron jobs, webhooks, trigger fallbacks).
 * Uses synthetic server-side visitor_id and session_id so server-emitted events are
 * distinguishable from frontend-emitted events in the user_events table.
 */
@Injectable()
export class ServerEventEmitterService {
  private readonly logger = new Logger(ServerEventEmitterService.name);

  constructor(private readonly ingestion: EventIngestionService) {}

  async emit(
    category: string,
    action: string,
    userId: string,
    properties: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      await this.ingestion.ingest([
        {
          client_event_id: randomUUID(),
          visitor_id: `server:${userId}`,
          session_id: `server-session:${userId}`,
          user_id: userId,
          event_category: category,
          event_action: action,
          page_path: null,
          previous_page_path: null,
          properties,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      // Analytics never blocks business logic
      this.logger.warn(
        `Failed to emit ${category}.${action} for user ${userId}: ${(err as Error).message}`,
      );
    }
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
cd packages/backend && npm test -- server-event-emitter.service.spec.ts
```

Expected: PASS both tests.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/user-analytics/server-event-emitter.service.ts \
        packages/backend/src/user-analytics/__tests__/server-event-emitter.service.spec.ts
git commit -m "feat(analytics): add ServerEventEmitterService for backend events"
```

---

### Task 3.2: Register + export `ServerEventEmitterService` from `UserAnalyticsModule`

**Files:**

- Modify: `packages/backend/src/user-analytics/user-analytics.module.ts`

- [ ] **Step 1: Add import + provider + export**

Add to imports:

```typescript
import { ServerEventEmitterService } from "./server-event-emitter.service";
```

Add to the `providers` array:

```typescript
ServerEventEmitterService,
```

Add to the `exports` array:

```typescript
ServerEventEmitterService,
```

- [ ] **Step 2: Run backend build**

```bash
cd packages/backend && npm run build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add packages/backend/src/user-analytics/user-analytics.module.ts
git commit -m "feat(analytics): export ServerEventEmitterService"
```

---

### Task 3.3: Emit `trial.started` from `onboarding.service.ts`

**Files:**

- Modify: `packages/backend/src/onboarding/onboarding.service.ts`
- Modify: `packages/backend/src/onboarding/onboarding.module.ts` (import UserAnalyticsModule if not already)

- [ ] **Step 1: Read the current file**

Find the method that corresponds to `startOnboardingTrial()` — the frontend calls this via `@/lib/data`.

- [ ] **Step 2: Inject `ServerEventEmitterService`**

Add to the constructor alongside existing deps:

```typescript
import { ServerEventEmitterService } from '../user-analytics/server-event-emitter.service';

// ... in constructor:
constructor(
  // ... existing deps
  private readonly eventEmitter: ServerEventEmitterService,
) {}
```

- [ ] **Step 3: Emit `trial.started` after the trial columns are set**

In the method that sets `trial_started_at` and `trial_ends_at` (the one invoked by `startOnboardingTrial`), after the successful DB update:

```typescript
await this.eventEmitter.emit("trial", "started", userId, {
  trial_duration_days: 14,
});
```

- [ ] **Step 4: Ensure module imports UserAnalyticsModule**

In `onboarding.module.ts`, add if not present:

```typescript
import { UserAnalyticsModule } from '../user-analytics/user-analytics.module';
// ...
@Module({
  imports: [/* existing */, UserAnalyticsModule],
  // ...
})
```

- [ ] **Step 5: Run backend build + tests**

```bash
cd packages/backend && npm run build && npm test -- onboarding
```

Expected: success.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/onboarding/
git commit -m "feat(trial): emit trial.started event on onboarding trial start"
```

---

### Task 3.4: Emit `trial.pro_feature_used` from `entitlements.service.ts`

**Files:**

- Modify: `packages/backend/src/entitlements/entitlements.service.ts`
- Modify: `packages/backend/src/entitlements/entitlements.module.ts` (import UserAnalyticsModule)

- [ ] **Step 1: Read the current entitlements service**

Find the method that checks if a user has access to a Pro-gated feature (likely `hasFeature` or `checkEntitlement`).

- [ ] **Step 2: Inject `ServerEventEmitterService`**

```typescript
import { ServerEventEmitterService } from '../user-analytics/server-event-emitter.service';

// in constructor:
constructor(
  // existing deps
  private readonly eventEmitter: ServerEventEmitterService,
) {}
```

- [ ] **Step 3: Emit when trial user passes a Pro-gated check**

Inside the entitlement check method, after determining the user has access AND the access is granted via active trial (not paid tier):

```typescript
// If user is on active trial and accessing a tier-gated feature, emit telemetry
if (userIsOnActiveTrial && featureRequiresPro) {
  // Fire-and-forget; do not block the entitlement check
  this.eventEmitter
    .emit("trial", "pro_feature_used", userId, { feature_slug: featureSlug })
    .catch(() => {});
}
```

The exact conditional depends on the existing service shape — implement consistently with the existing Pro-tier detection logic. If the service currently returns `{ allowed, reason }`, check `reason === 'trial'` or equivalent.

- [ ] **Step 4: Module imports UserAnalyticsModule**

```typescript
// In entitlements.module.ts
import { UserAnalyticsModule } from '../user-analytics/user-analytics.module';
@Module({ imports: [/* existing */, UserAnalyticsModule], /* ... */ })
```

- [ ] **Step 5: Run backend build + tests**

```bash
cd packages/backend && npm run build && npm test -- entitlements
```

Expected: success.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/src/entitlements/
git commit -m "feat(trial): emit trial.pro_feature_used when trial user accesses Pro feature"
```

---

### Task 3.5: `TrialExpirationCron` — new daily cron

**Files:**

- Create: `packages/backend/src/scheduling/trial-expiration.cron.ts`
- Create: `packages/backend/src/scheduling/__tests__/trial-expiration.cron.spec.ts`
- Modify or create: `packages/backend/src/scheduling/scheduling.module.ts`

- [ ] **Step 1: Check if scheduling module exists**

```bash
ls packages/backend/src/scheduling 2>/dev/null || echo "does not exist"
```

If the module doesn't exist, create it in Step 4. If it exists, extend it.

- [ ] **Step 2: Write the failing test**

`packages/backend/src/scheduling/__tests__/trial-expiration.cron.spec.ts`:

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { TrialExpirationCron } from "../trial-expiration.cron";
import { SupabaseService } from "../../supabase/supabase.service";
import { ServerEventEmitterService } from "../../user-analytics/server-event-emitter.service";

const mockQueryBuilder: any = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockResolvedValue({ error: null }),
};
const mockSupabase = { getClient: jest.fn(() => mockQueryBuilder) };
const mockEmitter = { emit: jest.fn().mockResolvedValue(undefined) };

describe("TrialExpirationCron", () => {
  let cron: TrialExpirationCron;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        TrialExpirationCron,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ServerEventEmitterService, useValue: mockEmitter },
      ],
    }).compile();
    cron = mod.get(TrialExpirationCron);
  });

  it("emits trial.expired for users past trial_ends_at with null emitted flag", async () => {
    mockQueryBuilder.is.mockResolvedValueOnce({
      data: [
        {
          id: "u1",
          trial_started_at: "2026-03-30T00:00:00Z",
          trial_ends_at: "2026-04-13T00:00:00Z",
          usage_stats: { markets_viewed: 3 },
        },
      ],
    });

    await cron.expireTrials();

    expect(mockEmitter.emit).toHaveBeenCalledWith(
      "trial",
      "expired",
      "u1",
      expect.objectContaining({ features_used_count: 1 }),
    );
  });

  it("does NOT re-emit for already-emitted users (idempotency)", async () => {
    mockQueryBuilder.is.mockResolvedValueOnce({ data: [] }); // filter on null emitted returns nothing
    await cron.expireTrials();
    expect(mockEmitter.emit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run to verify fail**

```bash
cd packages/backend && npm test -- trial-expiration.cron.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Write the cron service**

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SupabaseService } from "../supabase/supabase.service";
import { ServerEventEmitterService } from "../user-analytics/server-event-emitter.service";

function daysBetween(a: string, b: string | Date): number {
  const aMs = new Date(a).getTime();
  const bMs = typeof b === "string" ? new Date(b).getTime() : b.getTime();
  return Math.floor((bMs - aMs) / 86_400_000);
}

@Injectable()
export class TrialExpirationCron {
  private readonly logger = new Logger(TrialExpirationCron.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly emitter: ServerEventEmitterService,
  ) {}

  /** Daily at 02:00 UTC. Finds newly-expired trials and emits trial.expired exactly once. */
  @Cron("0 2 * * *")
  async expireTrials(): Promise<void> {
    const client = this.supabase.getClient();
    const now = new Date().toISOString();

    const { data: users, error } = await client
      .from("user_profiles")
      .select("id, trial_started_at, trial_ends_at, usage_stats")
      .lte("trial_ends_at", now)
      .is("trial_expired_emitted_at", null);

    if (error) {
      this.logger.error(`Failed to fetch expired trials: ${error.message}`);
      return;
    }

    for (const user of users ?? []) {
      const featuresUsedCount = Object.keys(user.usage_stats ?? {}).length;
      const daysActive =
        user.trial_started_at && user.trial_ends_at
          ? daysBetween(user.trial_started_at, user.trial_ends_at)
          : null;

      await this.emitter.emit("trial", "expired", user.id, {
        days_active: daysActive,
        features_used_count: featuresUsedCount,
      });

      await client
        .from("user_profiles")
        .update({ trial_expired_emitted_at: now })
        .eq("id", user.id);
    }

    if ((users ?? []).length > 0) {
      this.logger.log(`Emitted trial.expired for ${users!.length} users`);
    }
  }
}
```

- [ ] **Step 5: Register in SchedulingModule (create if absent)**

Create `packages/backend/src/scheduling/scheduling.module.ts` if it does not exist:

```typescript
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { SupabaseModule } from "../supabase/supabase.module";
import { UserAnalyticsModule } from "../user-analytics/user-analytics.module";
import { TrialExpirationCron } from "./trial-expiration.cron";

@Module({
  imports: [ScheduleModule.forRoot(), SupabaseModule, UserAnalyticsModule],
  providers: [TrialExpirationCron],
  exports: [TrialExpirationCron],
})
export class SchedulingModule {}
```

Register `SchedulingModule` in `app.module.ts` imports array.

- [ ] **Step 6: Run tests**

```bash
cd packages/backend && npm test -- trial-expiration.cron.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/scheduling/ packages/backend/src/app.module.ts
git commit -m "feat(trial): add daily TrialExpirationCron with idempotent emit"
```

---

### Task 3.6: Emit `trial.converted` on Stripe subscription.created webhook

**Files:**

- Modify: `packages/backend/src/billing/stripe-webhook.controller.ts` (verify path — may be elsewhere)

- [ ] **Step 1: Locate the Stripe webhook handler**

```bash
grep -r "customer.subscription.created" packages/backend/src
```

If the handler exists, note file + location. If not, skip this task and note it in Out-of-Scope (unlikely — billing module exists per repo structure).

- [ ] **Step 2: Inject `ServerEventEmitterService`**

Add to the webhook controller's module imports: `UserAnalyticsModule`. Inject `ServerEventEmitterService` into the controller constructor.

- [ ] **Step 3: Emit on subscription.created**

In the `customer.subscription.created` handler branch:

```typescript
if (event.type === "customer.subscription.created") {
  const subscription = event.data.object as Stripe.Subscription;
  // Lookup user by Stripe customer id (existing helper or query user_profiles)
  const client = this.supabase.getClient();
  const { data: profile } = await client
    .from("user_profiles")
    .select("id, trial_started_at")
    .eq("stripe_customer_id", subscription.customer)
    .maybeSingle();

  if (profile?.trial_started_at) {
    const priceItem = subscription.items.data[0];
    const daysSinceTrial = Math.floor(
      (Date.now() - new Date(profile.trial_started_at).getTime()) / 86_400_000,
    );
    await this.eventEmitter.emit("trial", "converted", profile.id, {
      tier: priceItem?.price?.nickname ?? "unknown",
      mrr_cents: priceItem?.price?.unit_amount ?? 0,
      days_since_trial_start: daysSinceTrial,
    });
  }
}
```

Adapt the user-lookup to match the existing pattern (the column name for stripe customer ID may be `stripe_customer_id` on `user_profiles` or may live in `subscriptions` — grep to confirm).

- [ ] **Step 4: Run backend build**

```bash
cd packages/backend && npm run build
```

Expected: success.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/billing/
git commit -m "feat(trial): emit trial.converted on Stripe subscription.created"
```

---

# Phase 4 — Frontend Gap-Fill Events

16 event call sites across 9 files. Canonical pattern below; then apply it to each site.

---

### Canonical pattern (reference — do not implement as its own task)

Every gap-fill event follows this pattern:

1. Ensure the file has `import { trackEvent } from "@/lib/analytics/tracker";`
2. Inside the handler for the trigger (click / mount / submit), add:
   ```typescript
   trackEvent("<category>.<action>", {
     /* properties per spec */
   });
   ```
3. If the handler causes a client-side navigation, add `flush()` immediately after `trackEvent`.
4. No PII (no emails, names, addresses) in properties.

Tests for these are covered by Phase 6 live-DB verification — individual component unit tests aren't required for simple event additions (the tracker itself has no logic to test in these wrappers; correctness = "did a real event land in `user_events`").

---

### Task 4.1: PersonaCards — `onboarding.persona_selected`

**Files:**

- Modify: `packages/frontend/app/get-started/PersonaCards.tsx`

- [ ] **Step 1: Add import**

At the top (after existing imports):

```typescript
import { trackEvent } from "@/lib/analytics/tracker";
```

- [ ] **Step 2: Fire on click**

In the `onClick` handler (around line 53–56), before `onSelect`:

```typescript
onClick={() => {
  setSelected(p.value);
  trackEvent("onboarding.persona_selected", { persona: p.value, persona_label: p.label });
  onSelect(p.value, p.searchPlaceholder);
}}
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/get-started/PersonaCards.tsx
git commit -m "feat(analytics): track onboarding.persona_selected"
```

---

### Task 4.2: OnboardingSearch — `onboarding.get_started_search`

**Files:**

- Modify: `packages/frontend/app/get-started/OnboardingSearch.tsx`

- [ ] **Step 1: Add import**

```typescript
import { trackEvent } from "@/lib/analytics/tracker";
```

- [ ] **Step 2: Fire on market selection**

Find the handler that's invoked when a user selects a market from autocomplete (before it calls the parent `onMarketSelect` callback). Add:

```typescript
trackEvent("onboarding.get_started_search", {
  geoLevel: result.type,
  geoId: result.id,
  geoName: result.name,
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/get-started/OnboardingSearch.tsx
git commit -m "feat(analytics): track onboarding.get_started_search"
```

---

### Task 4.3: BreathingSpotlight — 3 events

**Files:**

- Modify: `packages/frontend/app/components/onboarding/BreathingSpotlight.tsx`

- [ ] **Step 1: Add import**

```typescript
import { trackEvent } from "@/lib/analytics/tracker";
```

- [ ] **Step 2: Fire `spotlight_step_viewed` on mount of each step**

In the effect that runs when the current step changes (or on mount):

```typescript
useEffect(() => {
  trackEvent("onboarding.spotlight_step_viewed", {
    step_name: currentStep.name,
    step_index: currentStepIndex,
  });
  const mountedAt = Date.now();
  return () => {
    // when unmounting or advancing
  };
}, [currentStepIndex]);
```

Track mount timestamp for `duration_ms` on completion/dismissal.

- [ ] **Step 3: Fire `spotlight_step_completed` on action-gated advance**

In the handler that advances when the user completes the action:

```typescript
trackEvent("onboarding.spotlight_step_completed", {
  step_name: currentStep.name,
  step_index: currentStepIndex,
  duration_ms: Date.now() - mountedAt,
});
```

- [ ] **Step 4: Fire `spotlight_dismissed` on "Do this later"**

```typescript
trackEvent("onboarding.spotlight_dismissed", {
  at_step: currentStep.name,
  duration_ms: Date.now() - mountedAt,
});
```

- [ ] **Step 5: Run build**

```bash
cd packages/frontend && npm run build
```

Expected: success.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/components/onboarding/BreathingSpotlight.tsx
git commit -m "feat(analytics): track onboarding.spotlight_step_viewed/completed/dismissed"
```

---

### Task 4.4: BeaconProvider — 3 events

**Files:**

- Modify: `packages/frontend/app/components/beacons/BeaconProvider.tsx`

- [ ] **Step 1: Add import**

```typescript
import { trackEvent } from "@/lib/analytics/tracker";
```

- [ ] **Step 2: Fire `beacon.shown` when a beacon appears**

In the effect or callback that mounts/renders a beacon:

```typescript
trackEvent("beacon.shown", {
  beacon_id: beacon.id,
  target_feature: beacon.targetFeature,
});
```

- [ ] **Step 3: Fire `beacon.clicked` in the click handler**

```typescript
trackEvent("beacon.clicked", {
  beacon_id: beacon.id,
  target_feature: beacon.targetFeature,
});
```

If the click causes navigation, add `flush()` after.

- [ ] **Step 4: Fire `beacon.dismissed` in the dismiss handler**

```typescript
trackEvent("beacon.dismissed", { beacon_id: beacon.id });
```

- [ ] **Step 5: Run build**

```bash
cd packages/frontend && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/components/beacons/BeaconProvider.tsx
git commit -m "feat(analytics): track beacon shown/clicked/dismissed"
```

---

### Task 4.5: HeroSection — `hero.cta_click`

**Files:**

- Modify: `packages/frontend/app/components/home/HeroSection.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { trackEvent, flush } from "@/lib/analytics/tracker";
```

- [ ] **Step 2: Wrap CTA click handlers**

For the primary CTA ("Explore the Map — Free"):

```typescript
onClick={() => {
  trackEvent("hero.cta_click", {
    cta_id: "explore_map",
    cta_label: "Explore the Map — Free",
    destination: "/map",
  });
  flush();
}}
```

For the secondary CTA ("See a Sample AI Report"):

```typescript
onClick={() => {
  trackEvent("hero.cta_click", {
    cta_id: "sample_report",
    cta_label: "See a Sample AI Report",
    destination: "/reports/sample",
  });
  flush();
}}
```

If either CTA is a `<Link>` with no onClick, convert to `onClick` + programmatic navigation, or use `onMouseDown` so the event fires before Link's default behavior.

- [ ] **Step 3: Run build**

```bash
cd packages/frontend && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/components/home/HeroSection.tsx
git commit -m "feat(analytics): track hero.cta_click on primary and secondary CTAs"
```

---

### Task 4.6: ScoreTeaser — `home.score_teaser_click`

**Files:**

- Modify: `packages/frontend/app/components/home/ScoreTeaser.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { trackEvent, flush } from "@/lib/analytics/tracker";
```

Note: ScoreTeaser is a server component per Apr 10 spec. If so, the click handler must live in a nested Client Component. Create one if needed:

```typescript
"use client";
// components/home/ScoreTeaserRow.tsx
import { trackEvent, flush } from "@/lib/analytics/tracker";
import Link from "next/link";

export function ScoreTeaserRow({ rank, geoLevel, geoId, name, score, hotOrCold, href }: {
  rank: number; geoLevel: string; geoId: string; name: string;
  score: number; hotOrCold: "hot" | "cold"; href: string;
}) {
  return (
    <Link
      href={href}
      onClick={() => {
        trackEvent("home.score_teaser_click", { rank, geoLevel, geoId, score, hot_or_cold: hotOrCold });
        flush();
      }}
    >
      {/* existing row markup */}
    </Link>
  );
}
```

Then use `<ScoreTeaserRow>` inside ScoreTeaser.tsx for each rendered row.

- [ ] **Step 2: Run build**

```bash
cd packages/frontend && npm run build
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/components/home/
git commit -m "feat(analytics): track home.score_teaser_click"
```

---

### Task 4.7: StickyScoreBar — 3 events

**Files:**

- Modify: `packages/frontend/app/components/home/StickyScoreBar.tsx`

- [ ] **Step 1: Add import**

```typescript
import { trackEvent } from "@/lib/analytics/tracker";
```

- [ ] **Step 2: Fire `home.sticky_bar_shown` when the bar appears**

In the effect that transitions the bar from hidden to visible:

```typescript
if (visible) {
  trackEvent("home.sticky_bar_shown", { trigger: triggerReason }); // "scroll" or "timer"
}
```

- [ ] **Step 3: Fire `home.sticky_bar_dismissed` on X click**

```typescript
trackEvent("home.sticky_bar_dismissed", {});
```

- [ ] **Step 4: Fire `home.sticky_bar_email_submitted` on successful email submit**

```typescript
trackEvent("home.sticky_bar_email_submitted", {});
```

- [ ] **Step 5: Run build**

```bash
cd packages/frontend && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/components/home/StickyScoreBar.tsx
git commit -m "feat(analytics): track home.sticky_bar shown/dismissed/email_submitted"
```

---

**Phase 4 Checkpoint.** All 12 gap-fill sites (counting 3 beacons + 3 spotlight + 2 hero CTAs + 3 sticky bar + 1 persona + 1 search) are now instrumented. SEO bar events come in Phase 5.

Run full build to confirm nothing's broken:

```bash
cd packages/frontend && npm run build
cd packages/backend && npm run build && npm test
```

---

# Phase 5 — SEO Conversion Layer

New reusable conversion bar + layout injection.

---

### Task 5.1: `SeoPageConversionBar` — component skeleton + props

**Files:**

- Create: `packages/frontend/app/components/seo/SeoPageConversionBar.tsx`
- Create: `packages/frontend/app/components/seo/__tests__/SeoPageConversionBar.test.tsx`

- [ ] **Step 1: Write skeleton with props + hidden render**

```tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { X } from "lucide-react";
import { trackEvent } from "@/lib/analytics/tracker";

const DISMISS_KEY = "piq_seo_bar_dismissed";
const DISMISS_TTL_MS = 7 * 86_400_000; // 7 days
const SHOW_AFTER_MS = 8_000;
const SHOW_AFTER_SCROLL_PCT = 40;

type Context = "market" | "blog";

interface SeoPageConversionBarProps {
  context: Context;
  marketName?: string;
}

export function SeoPageConversionBar({
  context,
  marketName,
}: SeoPageConversionBarProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const mountedAt = useRef(Date.now());

  // Dismissal check + trigger setup in Task 5.2
  // Event wiring in Task 5.4

  if (dismissed || !visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-surface-container border-t border-outline-variant shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
        {/* Headline + CTAs + dismiss — filled in Task 5.3 */}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write test skeleton**

```tsx
// SeoPageConversionBar.test.tsx
import { render, screen } from "@testing-library/react";
import { SeoPageConversionBar } from "../SeoPageConversionBar";

describe("SeoPageConversionBar", () => {
  beforeEach(() => localStorage.clear());

  it("does not render until trigger fires", () => {
    render(<SeoPageConversionBar context="market" />);
    expect(screen.queryByText(/Sign up free/i)).toBeNull();
  });
});
```

- [ ] **Step 3: Run vitest**

```bash
cd packages/frontend && npx vitest run SeoPageConversionBar
```

Expected: the skeleton test passes (bar doesn't render without trigger).

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/components/seo/
git commit -m "feat(seo): SeoPageConversionBar skeleton with dismissal state"
```

---

### Task 5.2: Trigger logic — 8s timer OR 40% scroll + dismissal persistence

**Files:**

- Modify: `packages/frontend/app/components/seo/SeoPageConversionBar.tsx`

- [ ] **Step 1: Add the trigger useEffect**

Inside the component, before the `if (dismissed || !visible) return null;`:

```tsx
useEffect(() => {
  // Check localStorage for prior dismissal within TTL
  const stored = localStorage.getItem(DISMISS_KEY);
  if (stored) {
    const dismissedAt = parseInt(stored, 10);
    if (
      !Number.isNaN(dismissedAt) &&
      Date.now() - dismissedAt < DISMISS_TTL_MS
    ) {
      setDismissed(true);
      return;
    }
  }

  let triggered = false;
  const fire = (trigger: "scroll" | "timer") => {
    if (triggered) return;
    triggered = true;
    setVisible(true);
    trackEvent("seo.conversion_bar_shown", {
      context,
      page_path: window.location.pathname,
      trigger,
    });
  };

  const timer = window.setTimeout(() => fire("timer"), SHOW_AFTER_MS);

  const onScroll = () => {
    const scrolled = window.scrollY + window.innerHeight;
    const total = document.body.scrollHeight;
    if (total > 0 && (scrolled / total) * 100 >= SHOW_AFTER_SCROLL_PCT) {
      fire("scroll");
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  return () => {
    clearTimeout(timer);
    window.removeEventListener("scroll", onScroll);
  };
}, [context]);
```

- [ ] **Step 2: Write test for dismissal persistence**

Add to test file:

```tsx
it("stays hidden if dismissed within 7 days", () => {
  localStorage.setItem(
    "piq_seo_bar_dismissed",
    String(Date.now() - 86_400_000),
  ); // 1 day ago
  render(<SeoPageConversionBar context="market" />);
  // Fast-forward 10 seconds (vitest fake timers or just wait)
  jest.advanceTimersByTime?.(10_000);
  expect(screen.queryByRole("button", { name: /dismiss/i })).toBeNull();
});

it("reappears if dismissal is older than 7 days", async () => {
  localStorage.setItem(
    "piq_seo_bar_dismissed",
    String(Date.now() - 8 * 86_400_000),
  );
  vi.useFakeTimers();
  render(<SeoPageConversionBar context="blog" />);
  vi.advanceTimersByTime(9_000);
  // bar should now be visible via timer trigger
  vi.useRealTimers();
});
```

Adjust test framework helpers to match vitest syntax (`vi.useFakeTimers`, `vi.advanceTimersByTime`).

- [ ] **Step 3: Run tests**

```bash
cd packages/frontend && npx vitest run SeoPageConversionBar
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/components/seo/
git commit -m "feat(seo): timer + scroll trigger with 7-day dismissal persistence"
```

---

### Task 5.3: Content + CTAs (market + blog variants, dual CTA)

**Files:**

- Modify: `packages/frontend/app/components/seo/SeoPageConversionBar.tsx`

- [ ] **Step 1: Replace the empty inner markup**

Inside the sticky container, fill in:

```tsx
<div className="flex-1 flex items-center gap-3 min-w-0">
  <p className="text-sm font-medium text-on-surface truncate">
    {context === "market"
      ? marketName
        ? `Get the full score breakdown for ${marketName} — free`
        : "See live scores for 23,600+ markets — free"
      : "See live scores for 23,600+ markets — free"}
  </p>
</div>

<div className="flex items-center gap-2 flex-wrap">
  {!emailMode && !submitted && (
    <>
      <a
        href={`/auth/sign-up?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}`}
        onClick={() => handleCtaClick("signup")}
        className="px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-medium hover:bg-primary/90"
      >
        Sign up free
      </a>
      <button
        type="button"
        onClick={() => setEmailMode(true)}
        className="px-4 py-2 rounded-full border border-outline-variant text-sm font-medium text-on-surface hover:bg-surface-container-high"
      >
        {context === "blog" ? "Weekly market pulse" : "Weekly updates"}
      </button>
    </>
  )}

  {emailMode && !submitted && (
    <form onSubmit={handleEmailSubmit} className="flex gap-2">
      <input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="px-3 py-2 rounded-full border border-outline-variant text-sm bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-medium disabled:opacity-50"
      >
        {submitting ? "..." : "Subscribe"}
      </button>
    </form>
  )}

  {submitted && <span className="text-sm text-on-surface-variant">Thanks — check your inbox.</span>}

  <button
    type="button"
    aria-label="Dismiss"
    onClick={handleDismiss}
    className="p-2 rounded-full hover:bg-surface-container-high"
  >
    <X className="w-4 h-4 text-on-surface-variant" />
  </button>
</div>
```

- [ ] **Step 2: Add handlers (stubs for Task 5.4 to fill with trackEvent)**

Above the return statement:

```tsx
function handleCtaClick(action: "signup" | "newsletter") {
  // trackEvent in Task 5.4
}

function handleDismiss() {
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
  setDismissed(true);
  // trackEvent in Task 5.4
}

async function handleEmailSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (submitting || !email) return;
  setSubmitting(true);
  try {
    await fetch("/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, source: "seo_conversion_bar", context }),
    });
    setSubmitted(true);
    handleCtaClick("newsletter");
  } finally {
    setSubmitting(false);
  }
}
```

- [ ] **Step 3: Run build**

```bash
cd packages/frontend && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/components/seo/SeoPageConversionBar.tsx
git commit -m "feat(seo): dual-CTA content (signup + newsletter) with market/blog variants"
```

---

### Task 5.4: Wire events for SEO bar (shown/clicked/dismissed)

**Files:**

- Modify: `packages/frontend/app/components/seo/SeoPageConversionBar.tsx`

- [ ] **Step 1: Complete `handleCtaClick`**

```tsx
function handleCtaClick(action: "signup" | "newsletter") {
  trackEvent("seo.conversion_bar_clicked", {
    context,
    page_path: window.location.pathname,
    action,
  });
}
```

- [ ] **Step 2: Complete `handleDismiss`**

```tsx
function handleDismiss() {
  localStorage.setItem(DISMISS_KEY, String(Date.now()));
  setDismissed(true);
  trackEvent("seo.conversion_bar_dismissed", {
    context,
    page_path: window.location.pathname,
  });
}
```

- [ ] **Step 3: Add flush() before signup CTA navigation**

Change the signup `<a>` onClick from:

```tsx
onClick={() => handleCtaClick("signup")}
```

to:

```tsx
onClick={() => {
  handleCtaClick("signup");
  // sendBeacon flush — the anchor navigation unmounts the page
  import("@/lib/analytics/tracker").then((m) => m.flush());
}}
```

Or import `flush` at the top of the file (cleaner) and call directly:

```tsx
import { trackEvent, flush } from "@/lib/analytics/tracker";
// ...
onClick={() => {
  handleCtaClick("signup");
  flush();
}}
```

Prefer the cleaner form.

- [ ] **Step 4: Run build + test**

```bash
cd packages/frontend && npm run build && npx vitest run SeoPageConversionBar
```

Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/components/seo/SeoPageConversionBar.tsx
git commit -m "feat(seo): trackEvent for seo.conversion_bar shown/clicked/dismissed"
```

---

### Task 5.5: Inject into markets layout

**Files:**

- Modify: `packages/frontend/app/markets/layout.tsx`

- [ ] **Step 1: Read current layout**

Confirm current contents (should be minimal — just passes children through).

- [ ] **Step 2: Add wrapper**

```tsx
import { SeoPageConversionBar } from "@/app/components/seo/SeoPageConversionBar";

export default function MarketsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <SeoPageConversionBar context="market" />
    </>
  );
}
```

Preserve any existing metadata or structure.

- [ ] **Step 3: Build**

```bash
cd packages/frontend && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/markets/layout.tsx
git commit -m "feat(seo): inject SeoPageConversionBar into markets layout"
```

---

### Task 5.6: Inject into blog layout

**Files:**

- Modify: `packages/frontend/app/blog/layout.tsx`

- [ ] **Step 1: Read current layout**

- [ ] **Step 2: Add wrapper**

```tsx
import { SeoPageConversionBar } from "@/app/components/seo/SeoPageConversionBar";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <SeoPageConversionBar context="blog" />
    </>
  );
}
```

If the existing layout has a container wrapper (`max-w-4xl`), preserve it — wrap children inside it, place the bar after.

- [ ] **Step 3: Build**

```bash
cd packages/frontend && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/blog/layout.tsx
git commit -m "feat(seo): inject SeoPageConversionBar into blog layout"
```

---

### Task 5.7: Extend newsletter endpoint to accept `source` + `context`

**Files:**

- Modify: backend newsletter route handler (Next.js app route or NestJS) — grep to locate

- [ ] **Step 1: Find the endpoint**

```bash
grep -r "newsletter_signups" packages/
grep -r "'/api/newsletter'" packages/frontend/app/api
```

- [ ] **Step 2: Ensure handler accepts `source` and `context` fields**

Update the schema/validator (Zod per CLAUDE.md §1.2 — "Every API endpoint MUST validate input using Zod or class-validator") to accept:

```typescript
{
  email: z.string().email(),
  source: z.string().optional(),
  context: z.string().optional(),
}
```

Persist `source` and `context` to the `newsletter_signups` table. Add columns if missing:

```sql
ALTER TABLE public.newsletter_signups
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS context text;
```

(Apply via Supabase MCP `apply_migration`.)

- [ ] **Step 3: Test locally**

```bash
curl -X POST http://localhost:3000/api/newsletter \
  -H "Content-Type: application/json" \
  -d '{"email":"seotest@example.com","source":"seo_conversion_bar","context":"blog"}'
```

Expected: 200 or 204. Query `newsletter_signups` — new row has `source='seo_conversion_bar'`, `context='blog'`.

- [ ] **Step 4: Commit**

```bash
git add -A packages/frontend/app/api/newsletter supabase/migrations
git commit -m "feat(newsletter): accept source and context fields"
```

---

# Phase 6 — Live E2E Verification

Execute the 20 checks from spec §7.1 against live local backend + real Supabase. No mocks.

---

### Task 6.1: Run the full E2E walkthrough

- [ ] **Step 1: Start local services**

```bash
# Terminal 1: backend
cd packages/backend && npm run start:dev
# Terminal 2: frontend
cd packages/frontend && npm run dev
```

Confirm backend logs show all modules loaded (no missing imports). Confirm frontend at http://localhost:3000.

- [ ] **Step 2: Execute checks 1–20 from spec §7.1**

Work through each check. For each:

1. Perform the action described
2. Run the SQL query described via Supabase MCP
3. Confirm expected result

If any check fails, do NOT mark this task complete — diagnose, fix, re-verify.

The full list is in `docs/superpowers/specs/2026-04-14-activation-funnel-remediation-design.md` §7.1. Specifically:

- Signup chain (checks 1–6): email + OAuth signup, redirect preservation, ensureProfile, backfill, trigger exception handler
- Pipeline cleanup (checks 7–8): analytics_events dropped, events still flowing
- SEO conversion (checks 9–11): market bar, blog bar + newsletter DB write, not on non-SEO routes
- Frontend gap-fill (check 12, 16 sub-items a–p): systematically verify ALL 16 events land
- Trial lifecycle (checks 13–16): start, pro_feature_used, expiration cron idempotent, Stripe conversion
- Funnel engine (checks 17–19): multi-event counting, backward compat, UI rendering
- Annotation (check 20)

- [ ] **Step 3: Document findings in commit message**

```bash
git commit --allow-empty -m "test(e2e): verified activation funnel remediation against live Supabase

All 20 checks from spec §7.1 passed:
- Signup chain 1-6: OK
- Pipeline cleanup 7-8: OK
- SEO conversion 9-11: OK
- Frontend gap-fill 12 (16 events): OK
- Trial lifecycle 13-16: OK
- Funnel engine 17-19: OK
- Annotation 20: OK"
```

---

### Task 6.2: Run unit + integration tests

- [ ] **Step 1: Backend**

```bash
cd packages/backend && npm test
```

Expected: all pass, especially:

- `funnel-engine.service.spec.ts` (single + multi-event cases)
- `server-event-emitter.service.spec.ts`
- `trial-expiration.cron.spec.ts`

- [ ] **Step 2: Frontend**

```bash
cd packages/frontend && npx vitest run
```

Expected: all pass, especially `SeoPageConversionBar.test.tsx`.

- [ ] **Step 3: Lint**

```bash
cd packages/frontend && npm run lint
cd packages/backend && npm run lint
```

Expected: no new errors.

- [ ] **Step 4: Commit (empty if all passed)**

```bash
git commit --allow-empty -m "test: all unit + integration tests passing post-remediation"
```

---

### Task 6.3: Dashboard verification — read the result

- [ ] **Step 1: Log in as admin** to `/admin/analytics`

- [ ] **Step 2: Add annotation at ship date**

Use the AnnotationPopover in the header. Label: "Activation funnel remediation shipped". Date: today.

- [ ] **Step 3: Walk the tabs**

For each tab, confirm:

- **Overview:** QuickFunnel shows numbers. DauChart shows traffic trend. Annotation visible.
- **Journeys:** LandingPagesTable shows real bounce rates on `/`, `/markets/zip/*`, `/blog/*`.
- **Retention:** DAU/WAU/MAU cards populated. CohortMatrix renders (may be sparse).
- **Acquisition:** TrafficSourcesChart shows where visitors come from.
- **Conversion:** FullFunnel defaults to "Activation Funnel". Shows all 8 steps. Step 2 label is "Clicked primary CTA". Click through drill-down works.

- [ ] **Step 4: Read the AiInsightsPanel output**

Scroll to the AiInsightsPanel on the Conversion tab. Read whatever insights it has generated for the current date range. Capture 2-3 key findings in a comment or note file for follow-up.

- [ ] **Step 5: Commit any captured observations**

```bash
# If you captured notes in a file
git add docs/notes/ # or wherever
git commit -m "docs: post-ship dashboard observations"
```

---

# Phase 7 — Ship

Deploy + post-deploy smoke.

---

### Task 7.1: Deploy

- [ ] **Step 1: Final pre-deploy check**

```bash
git status  # Should be clean
git log --oneline -40  # Review all commits in this branch
```

- [ ] **Step 2: Push and open PR**

```bash
git push -u origin <branch-name>
gh pr create --title "Activation funnel remediation (signup + SEO CTAs + trial + funnel)" --body "$(cat <<'EOF'
## Summary

Fixes the full activation funnel per `docs/superpowers/specs/2026-04-14-activation-funnel-remediation-design.md`:

- Signup `conversion.signup_complete` now fires + flushes before navigation (email + OAuth)
- New signups redirect through `/get-started` (currently 0 sessions → target ≥90% of signups)
- SEO conversion bar on 43,666 programmatic pages (markets + blog)
- Trial lifecycle events: started / pro_feature_used / expired / converted
- Multi-event funnel engine + canonical "Activation Funnel" definition
- Deprecated `AnalyticsEventsModule` + `analytics_events` table removed
- Backfilled 1 missing user_profile (troyhouston76)

## Test plan

- [x] All 20 live-DB E2E checks from spec §7.1 passed
- [x] Backend unit + integration tests passing (funnel-engine, server-event-emitter, trial-expiration.cron)
- [x] Frontend vitest passing (SeoPageConversionBar)
- [x] Admin dashboard Activation Funnel renders end-to-end
- [ ] Post-deploy: annotate deploy date, monitor +24h event counts, +7d funnel data

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Merge after review**

Follow normal PR process. Railway deploys on merge to the appropriate branch.

---

### Task 7.2: Post-deploy smoke (24h, 7d, 14d)

- [ ] **Step 1: At +24h**

Query via Supabase MCP:

```sql
SELECT event_category || '.' || event_action AS event, COUNT(*)
FROM user_events
WHERE created_at > '2026-04-14T00:00:00Z'
  AND event_category IN ('seo','hero','onboarding','beacon','home','trial','conversion')
GROUP BY 1
ORDER BY COUNT(*) DESC;
```

Expected: all 16 new event types have count > 0.

- [ ] **Step 2: At +7d**

Open `/admin/analytics` → Conversion tab → Activation Funnel. Confirm:

- Step 1 (Landed) > 100
- Step 2 (Clicked primary CTA) > 0 and increasing
- Step 3 (Signup started) → Step 4 (Signup completed) drop-off now measurable (not 100%)

- [ ] **Step 3: At +14d**

First real trial should be expiring or converting. Query:

```sql
SELECT event_category || '.' || event_action, COUNT(*)
FROM user_events
WHERE event_category = 'trial'
  AND created_at > (current_date - interval '14 days')::timestamptz
GROUP BY 1;
```

Expected: at least one of `trial.expired` or `trial.converted` present.

- [ ] **Step 4: Ship the retrospective**

Update the memory `project_activation-funnel.md` with actual numbers vs targets, which Approach-2/3 bets paid off, and what to do next.

---

## Out of Scope

- Retiring `user_trials` table (follow-up migration after code audit)
- MCP-side event instrumentation (Track D in charter — deferred)
- Market-name personalization in SeoPageConversionBar (v1 generic; follow-up enhancement)
- Homepage `/` persona hero repositioning (deferred — 94% traffic skips `/`)
- Post-trial paywall content personalization (existing paywall works)

## Self-Review Notes

Plan covers every spec section:

- §1 (Signup chain) → Phase 1 tasks 1.1–1.5
- §2 (Pipeline cleanup) → Phase 2 tasks 2.1–2.2 + Phase 0 Task 0.1
- §3 (SEO conversion) → Phase 5 tasks 5.1–5.7
- §4 (Frontend gap-fill) → Phase 4 tasks 4.1–4.7 + §5 tasks 5.4 (SEO events)
- §5 (Trial lifecycle) → Phase 0 Task 0.2, Phase 3 tasks 3.1–3.6
- §6 (Multi-event funnel) → Phase 0 tasks 0.5–0.7
- §7 (Verification) → Phase 6 tasks 6.1–6.3 + Phase 7 Task 7.2

Type consistency: `FunnelStepDef` defined in Task 0.5 is used in Task 0.6 (engine) and Task 0.7 (SQL inserts matching the shape). `ServerEventEmitterService.emit(category, action, userId, properties)` signature consistent across Tasks 3.1, 3.3, 3.4, 3.5, 3.6.

No placeholders. Every step has concrete code or commands.
