# Activation Funnel Remediation — Design Spec

**Date:** 2026-04-14
**Status:** Approved (via brainstorm, 2026-04-14)
**Charter:** `docs/superpowers/specs/2026-04-14-activation-funnel-initiative.md`
**Approach:** A3 — surgical signup fixes + pipeline cleanup + SEO conversion layer + full event instrumentation + trial lifecycle + extended funnel engine

---

## Problem

Live 30-day DB data (pulled 2026-04-14) showed:

- **Signups are happening but invisible.** 8 new `auth.users` in 30d; `conversion.signup_complete` event fired 0 times because `router.push()` after `trackEvent()` loses the queued event.
- **Apr 12 onboarding is unreachable.** `/get-started` has 0 sessions ever — post-signup redirect defaults to `/map`.
- **94% of traffic lands on programmatic SEO pages** (`/markets/zip/*`, `/markets/county/*`, `/blog/*`) with no persistent conversion CTA.
- **Two analytics ingestion controllers register the same route.** `UserAnalyticsModule` wins (writes to `user_events`, 3,533 rows). `AnalyticsEventsModule` is a dead ghost writing to empty `analytics_events`.
- **Trial lifecycle is broken at the schema level.** Backend references `user_profiles.trial_started_at` etc., but those columns don't exist. Live schema has a separate unused `user_trials` table (0 rows).
- **7 instrumentation gaps** — PersonaCards, spotlight steps, beacons, hero CTAs, ScoreTeaser/StickyScoreBar, trial lifecycle, SEO conversion bar — none fire `trackEvent`.
- **Funnel engine supports only single-event-per-step.** Activation funnel needs multi-event alternatives (e.g., "SEO bar CTA click OR hero CTA click" as one step).

## Goal

Unblock the full activation funnel measurably: signups visible, onboarding reachable, SEO traffic converts, trial lifecycle fires, canonical multi-event funnel queryable end-to-end.

---

## Section 1 — Signup Chain Fixes

### 1.1 Flush before navigate (email signup path)

**File:** `packages/frontend/app/auth/sign-up/page.tsx`

Import and use `flush` from the tracker:

```typescript
import { trackEvent, flush } from "@/lib/analytics/tracker";
```

In the email signup success branch (around line 117–135):

```typescript
if (session) {
  trackEvent("conversion.signup_complete", { method: "email" });
  flush(); // <-- ADD
  await supabase.from("user_profiles").upsert({
    /* ... existing */
  });
  fetch("/api/auth/welcome", {
    /* ... existing */
  });
  router.push(redirectTo); // <-- redirectTo now computed per §1.3
}
```

`flush()` is synchronous — it calls `navigator.sendBeacon()` immediately with the queued events. `sendBeacon` is designed to survive navigation.

**Grep for other `trackEvent` → `router.push` patterns in the repo and apply same pattern where found.** Not speculative — spec writer greps and enumerates before implementation.

### 1.2 OAuth `signup_complete` firing

**File:** `packages/frontend/app/auth/callback/page.tsx`

Currently: OAuth users never fire `signup_complete`. The callback runs `setSession` then redirects, but does not distinguish first-signup from returning-sign-in.

**Detection logic (inside the callback handler after `setSession` succeeds):**

```typescript
// After successful setSession, before final redirect
const {
  data: { user },
} = await supabase.auth.getUser();
if (user) {
  // New signup heuristic: user_profiles.created_at within last 60s
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("created_at")
    .eq("id", user.id)
    .single();

  const isNewSignup =
    profile && Date.now() - new Date(profile.created_at).getTime() < 60_000;

  if (isNewSignup) {
    trackEvent("conversion.signup_complete", { method: "oauth" });
    flush();
  }
}
```

Heuristic is intentional — Supabase does not give us a clean "first-signup" signal in the OAuth callback. 60-second window is conservative; returning users whose profile was created >60s ago won't match.

### 1.3 Post-signup redirect target

**File:** `packages/frontend/app/auth/sign-up/page.tsx:64`

Current:

```typescript
const redirectTo = searchParams.get("redirect") || "/map";
```

Change: For net-new signups, override default to `/get-started`. Preserve explicit `?redirect=` to `/get-started?next=...` so the onboarding flow can forward the user onward.

```typescript
const explicitRedirect = searchParams.get("redirect");
// Default new signups to onboarding; preserve explicit targets via ?next=
const redirectTo = explicitRedirect
  ? `/get-started?next=${encodeURIComponent(explicitRedirect)}`
  : "/get-started";
```

**`/get-started` updates:** Read the `?next=` query param. On completion of the onboarding flow (final step or skip), navigate to `next` if present, else to `/map`. File: `packages/frontend/app/get-started/page.tsx`.

**OAuth path:** The OAuth callback (`/auth/callback`) already honors the `next` query parameter for redirects. Ensure the same logic applies: if new signup and no explicit `next`, redirect to `/get-started`.

### 1.4 `troyhouston76` missing-profile race — defensive fix + diagnostic

**One user (Apr 13) has `auth.users` row but no `user_profiles` row.** Trigger works for 7/8 recent signups, so this is a race or one-off. Two-layer fix:

**1.4a — Defensive backup (client-side):**
File: `packages/frontend/lib/auth/useAuth.ts` (or wherever the first authenticated fetch happens).

On first session establishment, check if profile exists; if not, upsert. Idempotent + safe:

```typescript
async function ensureProfile(user: User) {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.from("user_profiles").upsert(
      {
        id: user.id,
        email: user.email,
        created_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  }
}
```

**1.4b — Diagnostic logging in the trigger:**
File: `supabase/migrations/20260414XXX_log_handle_new_user_errors.sql`

Add an EXCEPTION handler to `handle_new_user()` that logs what went wrong for the next occurrence. Not a fix — a future-diagnostic so we can close the root cause if it happens again.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for user %: % (SQLSTATE %)', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;  -- Do not abort the auth.users insert
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**1.4c — Backfill the one missing profile.** Migration adds:

```sql
INSERT INTO public.user_profiles (id, email, created_at, updated_at)
SELECT id, email, created_at, NOW()
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.user_profiles)
ON CONFLICT (id) DO NOTHING;
```

---

## Section 2 — Event Pipeline Cleanup

### 2.1 Remove deprecated module registration

**File:** `packages/backend/src/app.module.ts`

Delete:

- Line 41: `import { AnalyticsEventsModule }` statement
- Line 123: `AnalyticsEventsModule,` from imports array

### 2.2 Delete dead module files

Remove directory: `packages/backend/src/analytics-events/` (contains `analytics-events.controller.ts`, `analytics-events.module.ts`).

### 2.3 Drop dead table

**File:** `supabase/migrations/20260414XXX_drop_analytics_events.sql`

```sql
DROP TABLE IF EXISTS public.analytics_events;
```

Zero consumers, zero rows, confirmed dead. No backward compat needed.

---

## Section 3 — SEO Conversion Layer

### 3.1 `SeoPageConversionBar` component

**File:** `packages/frontend/app/components/seo/SeoPageConversionBar.tsx`

**Behavior:**

- Sticky bottom bar, persistent on SEO pages
- Appears after **8-second dwell OR 40% scroll depth** (whichever first) — IntersectionObserver + setTimeout
- Dismissible — localStorage key `piq_seo_bar_dismissed`, **7-day TTL** (stores dismissal timestamp; compare on mount)
- Responsive: stacks vertically on mobile (<640px)
- z-index: `z-40` (above page content, below modals at `z-50`)
- Theme: light surface (most SEO pages are light-themed), M3 outlined card pattern

**Props:**

```typescript
type SeoPageConversionBarProps = {
  context: "market" | "blog";
  marketName?: string; // optional, for market pages — used in headline
};
```

**Content (dual CTA per approval 3.A):**

| Context                       | Headline                                               | Primary CTA                                              | Secondary CTA                                    |
| ----------------------------- | ------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------ |
| `market` (with marketName)    | "Get the full score breakdown for {marketName} — free" | "Sign up free" → `/auth/sign-up?redirect={current_path}` | "Weekly updates" → opens inline email input      |
| `market` (without marketName) | "See live scores for 23,600+ markets — free"           | same                                                     | same                                             |
| `blog`                        | "See live scores for 23,600+ markets — free"           | "Sign up free" → `/auth/sign-up`                         | "Weekly market pulse" → opens inline email input |

Secondary CTA ("weekly updates" / "weekly market pulse") expands inline to an email input + submit. On submit: POST to existing `/api/newsletter` endpoint with `source: "seo_conversion_bar"`, `context` property for differentiation. On success: success toast + collapse.

**Events fired (defined in Section 4):** `seo.conversion_bar_shown`, `seo.conversion_bar_clicked` (with `action: "signup" | "newsletter"`), `seo.conversion_bar_dismissed`.

**Styling reference:** Follow M3 pattern from `StickyScoreBar.tsx` for the sticky container, but decouple from `#hero-heading` IntersectionObserver — use self-contained scroll-depth logic.

### 3.2 Layout injection

**File:** `packages/frontend/app/markets/layout.tsx`

Wrap children:

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

**Market-name-aware variant** — the bar shows a generic headline by default; pages that want market-name personalization can pass `marketName` via a context provider or render their own instance. For v1, keep it generic to avoid touching all 43,666 page components. Market name personalization is a follow-up enhancement.

**File:** `packages/frontend/app/blog/layout.tsx`

```tsx
import { SeoPageConversionBar } from "@/app/components/seo/SeoPageConversionBar";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {children}
      <SeoPageConversionBar context="blog" />
    </div>
  );
}
```

**Do NOT inject into `app/layout.tsx`** — would appear on `/admin`, `/account`, `/auth`, etc.

### 3.3 Dismissal persistence

Key: `piq_seo_bar_dismissed`
Value: ISO timestamp of dismissal
TTL check on mount: if `(now - stored) < 7 * 86_400_000`, bar is dismissed.

---

## Section 4 — Frontend Event Gap-Fill

All events use existing `trackEvent(name, properties)` from `lib/analytics/tracker.ts`. **No PII in properties** (no emails, names, addresses). Naming follows `category.action` convention.

| Event                                 | File                                               | Call site                      | Properties                                                                 |
| ------------------------------------- | -------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `onboarding.persona_selected`         | `app/get-started/PersonaCards.tsx`                 | `onClick` of each persona card | `{persona: "investor"\|"homebuyer"\|"agent"\|"researcher", persona_label}` |
| `onboarding.get_started_search`       | `app/get-started/OnboardingSearch.tsx`             | After market selection         | `{geoLevel, geoId, geoName}`                                               |
| `onboarding.spotlight_step_viewed`    | `app/components/onboarding/BreathingSpotlight.tsx` | On step mount                  | `{step_name, step_index}`                                                  |
| `onboarding.spotlight_step_completed` | same                                               | On action-gated advance        | `{step_name, step_index, duration_ms}`                                     |
| `onboarding.spotlight_dismissed`      | same                                               | On "Do this later" click       | `{at_step, duration_ms}`                                                   |
| `beacon.shown`                        | `app/components/beacons/BeaconProvider.tsx`        | Beacon mount                   | `{beacon_id, target_feature}`                                              |
| `beacon.clicked`                      | same                                               | Beacon click → navigation      | `{beacon_id, target_feature}`                                              |
| `beacon.dismissed`                    | same                                               | X click                        | `{beacon_id}`                                                              |
| `hero.cta_click`                      | `app/components/home/HeroSection.tsx`              | Primary/secondary CTA click    | `{cta_id, cta_label, destination}`                                         |
| `home.score_teaser_click`             | `app/components/home/ScoreTeaser.tsx`              | Top/bottom row click           | `{rank, geoLevel, geoId, score, hot_or_cold}`                              |
| `home.sticky_bar_shown`               | `app/components/home/StickyScoreBar.tsx`           | Intersection or timer trigger  | `{trigger: "scroll"\|"timer"}`                                             |
| `home.sticky_bar_dismissed`           | same                                               | X click                        | `{}`                                                                       |
| `home.sticky_bar_email_submitted`     | same                                               | Email submit success           | `{}`                                                                       |
| `seo.conversion_bar_shown`            | `app/components/seo/SeoPageConversionBar.tsx`      | Show trigger                   | `{context, page_path}`                                                     |
| `seo.conversion_bar_clicked`          | same                                               | CTA click                      | `{context, page_path, action: "signup"\|"newsletter"}`                     |
| `seo.conversion_bar_dismissed`        | same                                               | X click                        | `{context, page_path}`                                                     |

**Implementation rule:** Every `trackEvent` call must be followed by `flush()` if immediately preceding a client-side navigation. Audit during implementation.

---

## Section 5 — Trial Lifecycle

### 5.1 Schema migration (per decision 5.A — migrate to user_profiles)

**File:** `supabase/migrations/20260414XXX_add_trial_columns_to_user_profiles.sql`

```sql
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at    timestamptz,
  ADD COLUMN IF NOT EXISTS free_report_credits integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_market   jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_checklist jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dismissed_beacons    jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS usage_stats          jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_user_profiles_trial_ends_at
  ON public.user_profiles (trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;

GRANT ALL ON public.user_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
```

**Retire `user_trials` table** in a follow-up migration after confirming no consumers:

```sql
-- In a subsequent migration (after code audit):
DROP TABLE IF EXISTS public.user_trials;
DROP TABLE IF EXISTS public.trial_config;  -- if unused
```

### 5.2 Trial start on signup

**File:** `packages/backend/src/onboarding/onboarding.service.ts` (already references `trial_started_at` — confirm or update).

On signup-complete callback (server-side, or `handle_new_user` trigger extension):

```sql
-- Extend handle_new_user trigger
INSERT INTO public.user_profiles (id, email, created_at, updated_at, trial_started_at, trial_ends_at)
VALUES (NEW.id, NEW.email, NOW(), NOW(), NOW(), NOW() + INTERVAL '14 days')
ON CONFLICT (id) DO NOTHING;
```

### 5.3 Backend analytics emitter

**New file:** `packages/backend/src/user-analytics/server-event-emitter.service.ts`

```typescript
@Injectable()
export class ServerEventEmitterService {
  constructor(private readonly ingestion: EventIngestionService) {}

  async emit(
    category: string,
    action: string,
    userId: string,
    properties: Record<string, unknown> = {},
  ): Promise<void> {
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
  }
}
```

Exported from `UserAnalyticsModule`. Inject into any service that fires backend events.

### 5.4 Trial lifecycle events

| Event                    | Where fired                                                                          | Properties                                  |
| ------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------- |
| `trial.started`          | `handle_new_user` trigger completes + `onboarding.service.ts` server-side event emit | `{trial_duration_days: 14}`                 |
| `trial.pro_feature_used` | `EntitlementsService` when trial user passes a Pro-gated check                       | `{feature_slug}`                            |
| `trial.expired`          | Daily cron (§5.5) detects `trial_ends_at <= now()`                                   | `{days_active, features_used_count}`        |
| `trial.converted`        | Stripe webhook handler on `customer.subscription.created` for user with active trial | `{tier, mrr_cents, days_since_trial_start}` |

For `trial.started`, emit from application code after signup completes (the trigger-level emit would require a pg_net call; cleaner to do it in the NestJS layer once signup_complete chain runs server-side).

### 5.5 Daily trial-expiration cron

**File:** `packages/backend/src/scheduling/trial-expiration.cron.ts`

```typescript
@Injectable()
export class TrialExpirationCron {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly emitter: ServerEventEmitterService,
  ) {}

  @Cron("0 2 * * *") // Daily 02:00 UTC
  async expireTrials() {
    const client = this.supabase.getClient();
    const { data: expiredUsers } = await client
      .from("user_profiles")
      .select("id, trial_started_at, trial_ends_at, usage_stats")
      .lte("trial_ends_at", new Date().toISOString())
      .is("trial_expired_emitted_at", null); // ADD this column in §5.1 migration

    for (const user of expiredUsers ?? []) {
      await this.emitter.emit("trial", "expired", user.id, {
        days_active: daysBetween(user.trial_started_at, user.trial_ends_at),
        features_used_count: Object.keys(user.usage_stats ?? {}).length,
      });
      await client
        .from("user_profiles")
        .update({ trial_expired_emitted_at: new Date().toISOString() })
        .eq("id", user.id);
    }
  }
}
```

**Additional schema add to §5.1 migration:**

```sql
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS trial_expired_emitted_at timestamptz;
```

### 5.6 Stripe webhook handler for conversion

**File:** `packages/backend/src/billing/stripe-webhook.controller.ts` (or existing webhook entry point — verify)

On `customer.subscription.created` event: look up the user (by Stripe customer ID), read their `trial_started_at`, emit `trial.converted`:

```typescript
if (event.type === "customer.subscription.created") {
  const subscription = event.data.object;
  const user = await this.userByStripeCustomer(subscription.customer);
  if (user?.trial_started_at) {
    await this.emitter.emit("trial", "converted", user.id, {
      tier: subscription.items.data[0].price.nickname ?? "unknown",
      mrr_cents: subscription.items.data[0].price.unit_amount ?? 0,
      days_since_trial_start: daysBetween(user.trial_started_at, new Date()),
    });
  }
}
```

---

## Section 6 — Multi-Event Funnel Engine Extension

### 6.1 Step type extension (backward compatible)

**File:** `packages/backend/src/user-analytics/user-analytics.types.ts`

```typescript
// Current (preserved for backward compat with existing 2 funnel rows):
export type FunnelStepSingle = {
  event_category: string;
  event_action: string;
  label?: string;
};

// New: alternative events for one logical step
export type FunnelStepMulti = {
  any_of: Array<{ event_category: string; event_action: string }>;
  label?: string;
};

export type FunnelStepDef = FunnelStepSingle | FunnelStepMulti;

export function isMultiStep(step: FunnelStepDef): step is FunnelStepMulti {
  return "any_of" in step;
}
```

### 6.2 Engine update

**File:** `packages/backend/src/user-analytics/funnel-engine.service.ts`

Change the matcher to accept either shape:

```typescript
const steps = funnel.steps as FunnelStepDef[];

// Build matchers once per step
const matchersPerStep = steps.map((step) => {
  if (isMultiStep(step)) return step.any_of;
  return [
    { event_category: step.event_category, event_action: step.event_action },
  ];
});

// Inside the loop:
for (let i = 0; i < steps.length; i++) {
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
  // ... existing intersection logic unchanged
}

// Step label fallback for multi-step:
const stepLabel = (s: FunnelStepDef): string => {
  if (s.label) return s.label;
  if (isMultiStep(s)) {
    return s.any_of
      .map((m) => `${m.event_category}.${m.event_action}`)
      .join(" | ");
  }
  return `${s.event_category}.${s.event_action}`;
};
```

Existing 2 funnel definitions (single-event shape) continue to work unchanged.

### 6.3 Insert canonical Activation Funnel

**File:** `supabase/migrations/20260414XXX_insert_activation_funnel.sql`

```sql
INSERT INTO public.funnel_definitions (id, name, steps, is_default, created_at)
VALUES (
  gen_random_uuid(),
  'Activation Funnel',
  '[
    {"event_category": "pageview", "event_action": "view", "label": "Landed on site"},
    {"any_of": [
      {"event_category": "seo",   "event_action": "conversion_bar_clicked"},
      {"event_category": "hero",  "event_action": "cta_click"}
    ], "label": "Clicked primary CTA"},
    {"event_category": "conversion", "event_action": "signup_start",    "label": "Signup started"},
    {"event_category": "conversion", "event_action": "signup_complete", "label": "Signup completed"},
    {"event_category": "onboarding", "event_action": "persona_selected","label": "Persona picked"},
    {"event_category": "onboarding", "event_action": "spotlight_step_completed", "label": "Report generated (activation)"},
    {"event_category": "trial",      "event_action": "pro_feature_used", "label": "Trial engagement"},
    {"event_category": "trial",      "event_action": "converted",        "label": "Converted to paid"}
  ]'::jsonb,
  true,
  now()
);

-- Demote old defaults if desired (keep them selectable but make Activation Funnel the display default)
UPDATE public.funnel_definitions SET is_default = false WHERE name IN ('Signup Funnel', 'Conversion Funnel');
```

### 6.4 Frontend FullFunnel compatibility

**File:** `packages/frontend/app/admin/analytics/components/conversion/FullFunnel.tsx`

The existing component renders steps by label. No change needed for multi-event rendering — the engine returns a `name` field (from label or computed fallback) and the UI just displays it. Verify during implementation.

---

## Section 7 — Verification

All verification runs against the **live local backend (port 3001) + real Supabase database** per CLAUDE.md §2.3 and the "Plans must include E2E testing with real DB" memory. No mocks.

### 7.1 Manual E2E walkthrough (required — live local backend + real Supabase, no mocks)

Every step below that involves "query" means a real SQL query run via Supabase MCP or `psql` against the live Supabase DB. Every step that involves "visit" or "click" means real browser interaction against `http://localhost:3000`. No stubs, no mocks.

#### Signup chain

1. **Email signup — success path:** Sign up via `/auth/sign-up` with fresh test email.
   - Query `auth.users WHERE email = {test}` — new row exists, `email_confirmed_at` populated (autoconfirm).
   - Query `user_profiles WHERE id = {uid}` — new row exists with `trial_started_at` and `trial_ends_at = trial_started_at + 14 days`.
   - Query `user_events WHERE visitor_id = {vid} ORDER BY created_at` — contains `conversion.signup_start` then `conversion.signup_complete` with `properties->>'method' = 'email'`, then `trial.started`.
   - Verify browser landed on `/get-started` (URL check).

2. **OAuth signup — success path:** Sign up via Google OAuth.
   - Same `auth.users` / `user_profiles` DB checks as (1).
   - Query `user_events` — `conversion.signup_complete` with `properties->>'method' = 'oauth'` present.
   - Browser lands on `/get-started`.

3. **Redirect preservation:** Visit `/auth/sign-up?redirect=/markets/zip/83873-wallace-id`. Complete signup.
   - Browser chain: `/auth/sign-up` → `/get-started?next=/markets/zip/83873-wallace-id` → on onboarding complete → `/markets/zip/83873-wallace-id`.
   - Query `user_events` — signup events fired with `properties->>'redirect_to'` retained.

4. **Missing-profile defensive fix + trial backfill in `ensureProfile`:**
   - Sign up a test user. Manually `DELETE FROM user_profiles WHERE id = {uid}` via SQL.
   - Sign back in.
   - Query `user_profiles WHERE id = {uid}` — row re-created by `ensureProfile`.
   - **Additional check:** confirm `trial_started_at` is populated (either from prior signup's trigger or from `ensureProfile`). If `ensureProfile` does not set trial columns, add this as an implementation requirement: re-created profiles must inherit trial defaults.

5. **Backfill migration ran — no orphaned auth.users:**
   - Query: `SELECT au.id, au.email FROM auth.users au LEFT JOIN user_profiles up ON up.id = au.id WHERE up.id IS NULL;` — returns 0 rows.
   - Specifically confirm `troyhouston76@gmail.com` now has a `user_profiles` row.

6. **Trigger exception handler — diagnostic test:**
   - Manually revoke INSERT on `user_profiles` from service_role for 30 seconds (`REVOKE INSERT ON user_profiles FROM service_role`).
   - Force a new auth.users insert (via Supabase dashboard or test script).
   - Tail Postgres logs (`SELECT * FROM postgres_logs ...` if available, or Supabase dashboard logs) — confirm `WARNING: handle_new_user failed for user ... (SQLSTATE ...)` appears.
   - Restore grant. Confirm subsequent signups work normally.

#### Pipeline cleanup

7. **`analytics_events` dropped:**
   - Query `SELECT to_regclass('public.analytics_events');` — returns NULL.
   - Check `packages/backend/src/app.module.ts` — no `AnalyticsEventsModule` reference.
   - Check `packages/backend/src/analytics-events/` — directory doesn't exist.
8. **Tracker still writes to user_events after cleanup:**
   - Load `/` as anonymous visitor, interact for 30 seconds.
   - Query `user_events WHERE session_id = {your session} ORDER BY created_at DESC` — pageview.view and other events present.

#### SEO conversion layer

9. **Market bar — show, click signup, persistence:**
   - Visit `/markets/zip/83873-wallace-id` as anonymous visitor. Wait 8s OR scroll 40%.
   - Bar appears. Query `user_events WHERE event_category='seo' AND event_action='conversion_bar_shown'` — row exists with `properties->>'context' = 'market'`, `properties->>'page_path' = '/markets/zip/83873-wallace-id'`.
   - Click "Sign up free". Query `user_events WHERE event_action='conversion_bar_clicked'` — row has `action = 'signup'`.
   - Browser navigates to `/auth/sign-up?redirect=/markets/zip/83873-wallace-id`.
   - Back on SEO page, dismiss bar. Query `user_events` — `conversion_bar_dismissed` present.
   - Refresh page. Bar does NOT reappear (localStorage dismissal).
   - In browser devtools, set `localStorage('piq_seo_bar_dismissed')` to a timestamp 8 days old. Refresh. Bar reappears.

10. **Blog bar — newsletter submit writes DB row:**
    - Visit `/blog/cincinnati-real-estate-market-2026`. Wait for bar.
    - Click "Weekly market pulse" (secondary CTA). Inline email input appears.
    - Submit test email `seotest+{timestamp}@example.com`.
    - Query `newsletter_signups WHERE email = {test email}` — new row exists with `source = 'seo_conversion_bar'` and a `context` field indicating `blog`.
    - Query `user_events WHERE event_action='conversion_bar_clicked'` — row has `action = 'newsletter'`.

11. **SEO bar does NOT appear on non-SEO routes:**
    - Visit `/admin`, `/account`, `/auth/sign-in`. Wait 10s+. Scroll. Bar never appears.

#### Frontend gap-fill events — ALL 16 systematically

Each of these rows must be verified via:
`SELECT COUNT(*) FROM user_events WHERE event_category = {cat} AND event_action = {act} AND created_at > {test_start};`

Test harness: start a fresh test session at time T, perform the trigger action, query with `created_at > T` to isolate.

| #   | Event                                 | Trigger action                                                                         |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------- |
| 12a | `onboarding.persona_selected`         | Click a persona card on `/get-started`                                                 |
| 12b | `onboarding.get_started_search`       | Select a market in OnboardingSearch                                                    |
| 12c | `onboarding.spotlight_step_viewed`    | Advance to each spotlight step                                                         |
| 12d | `onboarding.spotlight_step_completed` | Complete the action-gate on each step                                                  |
| 12e | `onboarding.spotlight_dismissed`      | Click "Do this later" on any step                                                      |
| 12f | `beacon.shown`                        | Trigger beacon condition (view a score to show "Compare Markets" beacon)               |
| 12g | `beacon.clicked`                      | Click the beacon                                                                       |
| 12h | `beacon.dismissed`                    | X out a beacon                                                                         |
| 12i | `hero.cta_click`                      | Click primary and secondary CTAs on `/` (two rows, different `cta_id`)                 |
| 12j | `home.score_teaser_click`             | Click a top and a bottom row in ScoreTeaser (verify `hot_or_cold` is correct for each) |
| 12k | `home.sticky_bar_shown`               | Load `/` and wait for scroll/timer trigger                                             |
| 12l | `home.sticky_bar_dismissed`           | Dismiss the sticky bar                                                                 |
| 12m | `home.sticky_bar_email_submitted`     | Submit email in sticky bar                                                             |
| 12n | `seo.conversion_bar_shown`            | Covered by (9)                                                                         |
| 12o | `seo.conversion_bar_clicked`          | Covered by (9) and (10)                                                                |
| 12p | `seo.conversion_bar_dismissed`        | Covered by (9)                                                                         |

All 16 must return COUNT ≥ 1 after the test session. Zero is a failure.

#### Trial lifecycle

13. **Trial start:** Covered by (1) — `user_profiles.trial_started_at` + `trial.started` event.

14. **Trial Pro feature used:**
    - As trial user, access ZIP-level metric data (or any Pro-gated feature).
    - Query `user_events WHERE event_category='trial' AND event_action='pro_feature_used' AND user_id={uid}` — row exists with `feature_slug` matching the accessed feature.

15. **Trial expiration cron — happy path + idempotency:**
    - Set test user's `trial_ends_at` to yesterday via SQL.
    - Run cron:
      - If `@nestjs/schedule` is configured via CLI: `npm run nest -- start --entryFile main --env CRON_ONCE=trial-expiration`
      - If no CLI runner exists, add a dev-only endpoint `POST /api/dev/cron/trial-expiration` (gated by AdminGuard) that manually invokes `TrialExpirationCron.expireTrials()`. Verify during implementation that such a runner exists or is added.
    - Query `user_events WHERE event_action='expired' AND user_id={uid}` — exactly one row.
    - Query `user_profiles WHERE id={uid}` — `trial_expired_emitted_at` set.
    - Run cron again. Query `user_events WHERE event_action='expired' AND user_id={uid}` — still exactly one row (idempotency verified by COUNT).

16. **Trial conversion via Stripe webhook:**
    - Trigger Stripe CLI: `stripe trigger customer.subscription.created` with a test customer linked to a trial user.
    - Query `user_events WHERE event_action='converted' AND user_id={uid}` — row exists with `tier`, `mrr_cents`, `days_since_trial_start` properties.

#### Funnel engine

17. **Multi-event funnel counts BOTH `any_of` events (SQL-level):**
    - Seed test data: create 2 fresh test visitors.
      - Visitor A: fires `pageview.view`, then `seo.conversion_bar_clicked`, then `conversion.signup_start`.
      - Visitor B: fires `pageview.view`, then `hero.cta_click`, then `conversion.signup_start`.
    - Query the Activation Funnel via the backend service directly:
      ```sql
      SELECT * FROM funnel_definitions WHERE name = 'Activation Funnel';
      ```
      Then POST to the funnel evaluation endpoint (or call `FunnelEngineService.evaluateFunnel()` via a test script) with `funnelId` and `days=1`.
    - Expected: step 2 ("Clicked primary CTA") count = **2** (both visitors, union of `any_of`). Step 3 ("Signup started") count = **2**.
    - If step 2 count is 1, the `any_of` matcher is broken — FAIL.

18. **Backward-compat: existing single-event funnels still render:**
    - Evaluate "Signup Funnel" (id from `funnel_definitions` WHERE name='Signup Funnel') — returns 3 steps with counts.
    - Evaluate "Conversion Funnel" — returns 3 steps with counts (may be 0, but the call must succeed and not throw).

19. **Multi-event funnel in admin UI:**
    - Open `/admin/analytics` → Conversion tab → FullFunnel. If there's a funnel dropdown, select "Activation Funnel"; else, confirm it's the default.
    - Confirm all 8 steps render with labels and drop-off percentages.
    - Confirm step 2 label is "Clicked primary CTA" (from `funnel_definitions.steps[1].label`, not an auto-generated `any_of` fallback).

20. **Annotation for this deploy:**
    - Use `/admin/analytics` AnnotationPopover to add annotation at ship date, label "Activation funnel remediation shipped".
    - Query `analytics_annotations WHERE label LIKE 'Activation funnel%'` — row exists.
    - Confirm annotation renders on DauChart and ChannelTrendChart as a vertical line.

### 7.2 Unit / integration tests (live DB where behavior is DB-dependent)

- `FunnelEngineService.evaluateFunnel` — extend tests in `packages/backend/src/user-analytics/__tests__/` with cases for:
  - Single-event step shape (backward compat with existing funnels)
  - `any_of` multi-event step — both events fire for different visitors, step count = union
  - `any_of` multi-event step — only one event fires, step count = those visitors only
  - Empty events, malformed step JSON — graceful handling
  - **Live DB:** These tests hit real Supabase (existing tests already use `SupabaseService` — keep that pattern; do not mock).
- `ServerEventEmitterService.emit` — integration test that writes to real `user_events` table, queries back, confirms schema.
- `TrialExpirationCron.expireTrials` — integration test: seed `user_profiles` with `trial_ends_at < now()` and `trial_expired_emitted_at IS NULL`, run cron, assert exactly one `trial.expired` event per seeded user; run again, assert no new events.
- `SeoPageConversionBar` component test (no DB needed — pure client):
  - Dismissal persistence: set localStorage, mount, assert bar hidden
  - TTL expiry: set stale localStorage (> 7 days), mount, assert bar shows
  - Trigger: mount without localStorage, wait 8s or simulate 40% scroll, assert bar visible
  - Click events fire correctly (mock `trackEvent`)

### 7.3 Post-deploy smoke

- Annotate deploy date in admin dashboard.
- At +24h: check `user_events` contains all 16 new event types with >0 counts.
- At +7d: check "Activation Funnel" in FullFunnel shows meaningful drop-off data.
- At +14d: first real trial should expire or convert — confirm corresponding event fires.

---

## Files Changed Summary

| File                                                                     | Change                                                                     |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `packages/frontend/app/auth/sign-up/page.tsx`                            | Import `flush`, call before `router.push`, update redirect default         |
| `packages/frontend/app/auth/callback/page.tsx`                           | Detect new-OAuth-signup, fire `signup_complete`, flush, honor `next` param |
| `packages/frontend/app/get-started/page.tsx`                             | Read `?next=` param, forward on completion                                 |
| `packages/frontend/lib/auth/useAuth.ts`                                  | Add `ensureProfile` call on session establishment                          |
| `packages/frontend/app/components/seo/SeoPageConversionBar.tsx`          | New component                                                              |
| `packages/frontend/app/markets/layout.tsx`                               | Inject SeoPageConversionBar                                                |
| `packages/frontend/app/blog/layout.tsx`                                  | Inject SeoPageConversionBar                                                |
| `packages/frontend/app/get-started/PersonaCards.tsx`                     | trackEvent persona_selected                                                |
| `packages/frontend/app/get-started/OnboardingSearch.tsx`                 | trackEvent get_started_search                                              |
| `packages/frontend/app/components/onboarding/BreathingSpotlight.tsx`     | trackEvent spotlight_step_viewed/completed/dismissed                       |
| `packages/frontend/app/components/beacons/BeaconProvider.tsx`            | trackEvent beacon.shown/clicked/dismissed                                  |
| `packages/frontend/app/components/home/HeroSection.tsx`                  | trackEvent hero.cta_click                                                  |
| `packages/frontend/app/components/home/ScoreTeaser.tsx`                  | trackEvent home.score_teaser_click                                         |
| `packages/frontend/app/components/home/StickyScoreBar.tsx`               | trackEvent home.sticky_bar_shown/dismissed/email_submitted                 |
| `packages/backend/src/app.module.ts`                                     | Remove AnalyticsEventsModule import + registration                         |
| `packages/backend/src/analytics-events/`                                 | Delete entire directory                                                    |
| `packages/backend/src/user-analytics/user-analytics.types.ts`            | Add FunnelStepMulti + isMultiStep                                          |
| `packages/backend/src/user-analytics/funnel-engine.service.ts`           | Multi-event matcher logic + label fallback                                 |
| `packages/backend/src/user-analytics/server-event-emitter.service.ts`    | New — backend event emitter                                                |
| `packages/backend/src/user-analytics/user-analytics.module.ts`           | Export ServerEventEmitterService                                           |
| `packages/backend/src/onboarding/onboarding.service.ts`                  | Emit `trial.started` after signup completes                                |
| `packages/backend/src/entitlements/entitlements.service.ts`              | Emit `trial.pro_feature_used` on trial-user pro access                     |
| `packages/backend/src/scheduling/trial-expiration.cron.ts`               | New — daily cron                                                           |
| `packages/backend/src/scheduling/scheduling.module.ts`                   | Register the cron                                                          |
| `packages/backend/src/billing/stripe-webhook.controller.ts`              | Emit `trial.converted` on subscription.created                             |
| `supabase/migrations/20260414XXX_drop_analytics_events.sql`              | Drop dead table                                                            |
| `supabase/migrations/20260414XXX_add_trial_columns_to_user_profiles.sql` | Trial + onboarding state columns                                           |
| `supabase/migrations/20260414XXX_log_handle_new_user_errors.sql`         | Trigger exception logging                                                  |
| `supabase/migrations/20260414XXX_backfill_missing_user_profiles.sql`     | One-time backfill                                                          |
| `supabase/migrations/20260414XXX_extend_handle_new_user_trial_start.sql` | Trigger writes `trial_started_at` + `trial_ends_at`                        |
| `supabase/migrations/20260414XXX_insert_activation_funnel.sql`           | Canonical funnel row                                                       |

---

## Out of Scope

- Retiring `user_trials` table (follow-up migration after code audit confirms no consumers)
- MCP-side event instrumentation (Track D in charter — deferred until real MCP demand exists)
- Homepage persona-decision (MCP power-user vs Agent) — parked; 94% of traffic doesn't see `/` anyway
- Market-name personalization in SeoPageConversionBar (v1 ships with generic headline; personalization is follow-up enhancement)
- Post-trial paywall redesign (existing paywall works; Apr 12 spec's personalized paywall content is a follow-up)
- GA4 credentials fix (nice-to-have for external channel attribution; not blocking)

---

## Success Metrics

Measured via the new Activation Funnel in `/admin/analytics`:

| Metric                                                                  | Baseline (pre-fix, 30d ending 2026-04-14) | Target (30d post-ship)                                                 |
| ----------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| `conversion.signup_complete` events                                     | 0                                         | ≥ `auth.users` new rows count (prove tracking works)                   |
| `/get-started` sessions                                                 | 0                                         | ≥90% of new signups                                                    |
| SEO bar CTR on `/markets/*`                                             | N/A                                       | ≥2% (visitors who clicked signup / total visitors who saw bar)         |
| SEO bar CTR on `/blog/*`                                                | N/A                                       | ≥1%                                                                    |
| Full activation funnel step 1 → step 4 (site landing → signup complete) | Unmeasurable                              | ≥1%                                                                    |
| Full activation funnel step 4 → step 6 (signup → report generated)      | Unmeasurable                              | ≥60%                                                                   |
| Trial → converted                                                       | 0%                                        | Directionally measurable (baseline is ~0 historical trials to convert) |
