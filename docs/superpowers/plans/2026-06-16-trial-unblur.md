# Trial-Unblur — Implementation Plan (P0, Part 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guarantee a brand-new signup resolves to its Pro trial tier **before first render**, so no surface (the tour's highlighted Score, map metrics, the report) ever flashes paywall-blurred `free`.

**Architecture:** Two independent fixes that compound. **(A) Make the trial real server-side:** the `handle_new_user` trigger already sets `user_profiles.trial_started_at/ends_at`, but the tier-resolver only reads the `user_trials` table — which gets a row only from a best-effort client `fetch` after navigation. We make the trigger insert the `user_trials` row atomically at signup. **(B) Seed entitlements server-side:** `EntitlementsProvider` starts at the hard-coded `DEFAULT_ENTITLEMENTS_STATE` (`tier:"free"`) and only corrects after a client fetch — the flash. `AppShell` is a Server Component, so it resolves the real tier on the server and seeds the provider's initial state. Together: the row always exists, and the first paint already shows the correct tier — for everyone, free or trial.

**Tech Stack:** Supabase Postgres (trigger via SQL migration), NestJS backend (`tier-resolver`, unchanged), Next.js App Router Server Components, React 19, Vitest (unit), Playwright (E2E). Frontend commands run from `packages/frontend`.

**⚠️ Could not pre-verify from the planning session:** the Supabase MCP was unauthorized, so **Task 1 verifies `trial_config.is_enabled` against the real DB.** If it is `false`, new users currently get `user_profiles.trial_*` columns but **no `user_trials` row**, so the tier-resolver reads them as `free` — i.e. the "14 days of Pro" promise is silently broken today. That makes this plan a bug fix, not just a polish.

**Companion plan:** Plan 1 (`2026-06-16-tour-rebuild-and-system-b-deletion.md`) fixes the spotlight's own blur. Independent of this plan; either can ship first.

---

## Task 1: Verify (and if needed enable) the reverse Pro trial

**Files:** none (DB verification). Run against the **dev/staging** Supabase first, then confirm prod.

- [ ] **Step 1: Check `trial_config` and whether trials are actually landing**

Run in the Supabase SQL editor (or `psql "$SUPABASE_DB_URL"`):

```sql
-- (a) Is the reverse trial enabled, and to what tier/duration?
select is_enabled, trial_tier, duration_days from trial_config;

-- (b) Reality check: of users created in the last 14 days, how many have a
--     user_trials row vs only the user_profiles.trial_* columns?
select
  count(*)                                              as new_users_14d,
  count(*) filter (where ut.user_id is not null)        as have_user_trials_row
from user_profiles up
left join user_trials ut on ut.user_id = up.id
where up.created_at > now() - interval '14 days';
```

Expected if healthy: `is_enabled = true`, `trial_tier = 'pro'`, and `have_user_trials_row` ≈ `new_users_14d`.

- [ ] **Step 2: If `is_enabled = false` OR the counts diverge, enable trials**

```sql
update trial_config set is_enabled = true, trial_tier = 'pro', duration_days = 14;
```

(If there are zero rows: `insert into trial_config (is_enabled, duration_days, trial_tier, show_banner) values (true, 14, 'pro', true);`)

- [ ] **Step 3: Record the finding**

Note in the PR description whether trials were already enabled or this fixed a latent gap. No commit (data change only).

---

## Task 2: Make `handle_new_user` insert the `user_trials` row atomically

**Files:**

- Create: `supabase/migrations/20260616120000_handle_new_user_inserts_user_trials.sql` (use the actual current UTC timestamp if later — backdated migrations are silently skipped)

- [ ] **Step 1: Write the migration**

This replaces `handle_new_user` (latest definition in `20260414120200_update_handle_new_user_trigger.sql`) to ALSO insert a `user_trials` row from `trial_config`, inside the existing error-swallowing guard so it can never block the `auth.users` insert.

```sql
-- Make handle_new_user create the user_trials row that the tier-resolver reads,
-- so a brand-new signup resolves to its Pro trial before first render.
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  cfg trial_config%ROWTYPE;
BEGIN
  INSERT INTO public.user_profiles (
    id, email, full_name, trial_started_at, trial_ends_at, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NOW(),
    NOW() + INTERVAL '14 days',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Reverse Pro trial: insert the user_trials row the tier-resolver queries.
  SELECT * INTO cfg FROM trial_config LIMIT 1;
  IF cfg.is_enabled THEN
    INSERT INTO public.user_trials (user_id, tier, expires_at)
    VALUES (
      NEW.id,
      COALESCE(cfg.trial_tier, 'pro'),
      NOW() + (INTERVAL '1 day' * COALESCE(cfg.duration_days, 14))
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for user %: % (SQLSTATE %)',
    NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;  -- never abort the auth.users insert
END;
$function$;
```

- [ ] **Step 2: Apply the migration to dev/staging**

Use the repo's normal mechanism (e.g. `supabase db push`, or the Supabase MCP `apply_migration`, or `psql "$SUPABASE_DB_URL" -f <file>`).

- [ ] **Step 3: Verify against the real DB (no mocks)**

Create a throwaway signup (via the app's sign-up, or Supabase Studio → Authentication → Add user), then:

```sql
select ut.tier, ut.expires_at
from user_trials ut
join auth.users u on u.id = ut.user_id
where u.email = '<the-throwaway-email>';
```

Expected: one row, `tier = 'pro'`, `expires_at ≈ now() + 14 days`. (Leave the existing client `startOnboardingTrial()` call in place as an idempotent fallback — do **not** remove it.)

- [ ] **Step 4: Commit**

```bash
git add "supabase/migrations/20260616120000_handle_new_user_inserts_user_trials.sql"
git commit -m "fix(trial): create user_trials row in handle_new_user so new signups resolve to Pro"
```

---

## Task 3: Add a server-side entitlements resolver

**Files:**

- Create: `packages/frontend/lib/entitlements/server.ts`
- Create: `packages/frontend/lib/entitlements/__tests__/server.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchEntitlementsServer } from "../server";

afterEach(() => vi.restoreAllMocks());

describe("fetchEntitlementsServer", () => {
  it("returns null for an anonymous (no userId) request without fetching", async () => {
    const spy = vi.spyOn(global, "fetch");
    expect(await fetchEntitlementsServer(null)).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("resolves the tier from the backend using the x-user-id header", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          tier: "pro",
          access: {},
          trial: { active: true, daysRemaining: 14, tier: "pro" },
        }),
        { status: 200 },
      ),
    );
    const result = await fetchEntitlementsServer("user-123");
    expect(result?.tier).toBe("pro");
    expect(result?.loading).toBe(false);
  });

  it("returns null on a non-OK response (caller falls back to client refresh)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("nope", { status: 500 }),
    );
    expect(await fetchEntitlementsServer("user-123")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm run test:unit -- entitlements/__tests__/server
```

Expected: FAIL (module `../server` does not exist).

- [ ] **Step 3: Implement `server.ts`**

```ts
import type { EntitlementsState } from "./types";

/**
 * Server-side tier resolution for SSR seeding. Runs in a Server Component
 * (AppShell), so it authorizes with the cookie-derived `x-user-id` (the same
 * header the client uses — the entitlements endpoint does not require a JWT).
 * Returns null for anonymous users or on any failure, so the caller falls back
 * to the client-side refresh.
 */
export async function fetchEntitlementsServer(
  userId: string | null,
): Promise<EntitlementsState | null> {
  if (!userId) return null;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  try {
    const res = await fetch(`${apiUrl}/api/entitlements/check?resources=`, {
      headers: { "x-user-id": userId, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      tier: data.tier,
      access: data.access ?? {},
      trial: data.trial ?? null,
      loading: false,
      error: null,
    };
  } catch {
    return null; // backend unreachable during SSR — client refresh will resolve
  }
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm run test:unit -- entitlements/__tests__/server
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/lib/entitlements/server.ts packages/frontend/lib/entitlements/__tests__/server.test.ts
git commit -m "feat(entitlements): add server-side tier resolver for SSR seeding"
```

---

## Task 4: Seed `EntitlementsProvider` initial state from the server

**Files:**

- Modify: `packages/frontend/lib/entitlements/EntitlementsContext.tsx` (add `initialState` prop)
- Modify: `packages/frontend/app/providers.tsx` (accept + forward `initialEntitlementState`)
- Modify: `packages/frontend/app/components/AppShell.tsx` (await the resolver, pass it down)
- Create: `packages/frontend/lib/entitlements/__tests__/EntitlementsContext.seed.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EntitlementsProvider, useEntitlements } from "../EntitlementsContext";
import type { EntitlementsState } from "../types";

// authLoading:true so the refresh effect (gated on !authLoading) never runs —
// isolates the initial-state seeding.
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: "u1" }, session: null, loading: true }),
}));

function TierProbe() {
  const { tier } = useEntitlements();
  return <span data-testid="tier">{tier}</span>;
}

describe("EntitlementsProvider seeding", () => {
  it("renders the server-seeded tier on first paint (no free flash)", () => {
    const seed: EntitlementsState = {
      tier: "pro",
      access: {},
      trial: { active: true, daysRemaining: 14, tier: "pro" },
      loading: false,
      error: null,
    };
    render(
      <EntitlementsProvider initialState={seed}>
        <TierProbe />
      </EntitlementsProvider>,
    );
    expect(screen.getByTestId("tier").textContent).toBe("pro");
  });

  it("falls back to free when no initialState is provided", () => {
    render(
      <EntitlementsProvider>
        <TierProbe />
      </EntitlementsProvider>,
    );
    expect(screen.getByTestId("tier").textContent).toBe("free");
  });
});
```

(If the provider's consumer hook is named differently than `useEntitlements`, match the existing export in `EntitlementsContext.tsx`.)

- [ ] **Step 2: Run to verify it fails**

```bash
npm run test:unit -- EntitlementsContext.seed
```

Expected: FAIL (`initialState` is not a prop; tier is `free` even with a seed).

- [ ] **Step 3: Add the `initialState` prop to `EntitlementsProvider`**

In `lib/entitlements/EntitlementsContext.tsx`, extend the props and use the seed as the initial `useState` value:

```tsx
interface EntitlementsProviderProps {
  children: React.ReactNode;
  initialResources?: string[];
  initialState?: EntitlementsState | null;
}

export function EntitlementsProvider({
  children,
  initialResources,
  initialState,
}: EntitlementsProviderProps) {
  const { user, session, loading: authLoading } = useAuth();
  const [state, setState] = useState<EntitlementsState>(
    initialState ?? DEFAULT_ENTITLEMENTS_STATE,
  );
  // ...everything below is unchanged...
```

(Ensure `EntitlementsState` is imported in this file — it already references `DEFAULT_ENTITLEMENTS_STATE` from `entitlements-helpers`, so add `import type { EntitlementsState } from "./types";` if not present.)

- [ ] **Step 4: Forward the seed through `Providers`**

In `app/providers.tsx`, accept the prop and pass it to the provider (leave every other provider in the tree unchanged; note `<TourProvider>` is already removed by Plan 1 — if Plan 1 hasn't landed yet, keep the existing wrapper):

```tsx
export function Providers({
  children,
  initialUserId,
  initialEntitlementState,
}: {
  children: React.ReactNode;
  initialUserId: string | null;
  initialEntitlementState?:
    | import("@/lib/entitlements/types").EntitlementsState
    | null;
}) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider initialUserId={initialUserId}>
        <QueryCacheCleaner />
        <ToastProvider>
          <EntitlementsProvider initialState={initialEntitlementState}>
            <OnboardingBeaconProvider>
              <PaywallProvider>{children}</PaywallProvider>
            </OnboardingBeaconProvider>
          </EntitlementsProvider>
          <ExitIntentModal />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 5: Resolve + pass the seed from `AppShell` (Server Component)**

In `app/components/AppShell.tsx`, make the component async, resolve the tier, and pass it to `Providers`:

```tsx
import { fetchEntitlementsServer } from "@/lib/entitlements/server";

export async function AppShell({
  initialUserId,
  children,
}: {
  initialUserId: string | null;
  children: React.ReactNode;
}) {
  const initialEntitlementState = await fetchEntitlementsServer(initialUserId);

  return (
    <>
      <GoogleAnalytics />
      <Providers
        initialUserId={initialUserId}
        initialEntitlementState={initialEntitlementState}
      >
        <Header />
        <EnterpriseGraceBanner />
        <EnterpriseOnboardingGate>
          <AnalyticsProvider>
            <main
              id="main-content"
              className="flex-1 min-h-0 flex flex-col relative"
            >
              {children}
            </main>
          </AnalyticsProvider>
          <AppFooter />
          <DevToolbarLoader />
        </EnterpriseOnboardingGate>
      </Providers>
    </>
  );
}
```

- [ ] **Step 6: Run unit tests + build**

```bash
npm run test:unit -- EntitlementsContext.seed
npm run build
```

Expected: tests PASS; build succeeds (AppShell as an async Server Component is valid in the App Router).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(entitlements): seed provider initial tier server-side to kill the free-flash"
```

---

## Task 5: E2E — a fresh trial user sees no free-flash

**Files:**

- Create: `packages/frontend/tests/e2e/trial-unblur.spec.ts`

Runs against live dev servers with a real trial user. Use the existing auth fixtures pattern (`tests/fixtures/.auth/`). This assumes a trial-tier fixture exists or is created; if not, add `tests/fixtures/.auth/trial-user.json` mirroring `enterprise-user.json`.

- [ ] **Step 1: Write the E2E spec**

```ts
import { test, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "../fixtures/.auth/trial-user.json");
test.use({ storageState: authFile });
test.setTimeout(30_000);

// A trial user must see Pro content unblurred on first paint — assert a
// known Pro-gated element is NOT inside a blurred/locked wrapper.
test("trial user: Pro content is not paywall-blurred on first load", async ({
  page,
}) => {
  await page.goto("/market/39580?type=metro", { waitUntil: "load" });

  // The PropertyIQ score is Pro-gated content the tour highlights.
  const score = page.locator('[data-tour="propertyiq-score"]').first();
  await expect(score).toBeVisible();

  // It must not be wrapped by a blur/paywall component.
  const blurred = await score.evaluate((el) => {
    const wrap = el.closest('[class*="blur"], [data-paywalled="true"]');
    if (wrap) return true;
    return getComputedStyle(el).filter.includes("blur");
  });
  expect(blurred).toBe(false);
});
```

- [ ] **Step 2: Run it (dev servers up on :3000/:3001)**

```bash
npm run test:e2e -- trial-unblur
```

Expected: PASS. If it fails with the score blurred, confirm Task 2's trigger ran (the user has a `user_trials` row) and Task 4 seeded the tier.

- [ ] **Step 3: Manual prod confirmation (the success criterion)**

After deploy: sign up a brand-new account on prod and confirm the Score/metrics/report render unblurred on the very first paint (no flash). This is spec §2 success criterion #1.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/tests/e2e/trial-unblur.spec.ts
git commit -m "test(trial): e2e verify trial users see Pro content unblurred on first load"
```

---

## Self-Review

**Spec coverage (§5.1):**

- Trial resolvable before first render → Task 2 (DB trigger inserts `user_trials` atomically) ✓
- No surface flashes `free` → Task 4 (SSR-seeded `EntitlementsProvider.initialState`) ✓
- Keep client `startOnboardingTrial()` as fallback → Task 2 Step 3 note (not removed) ✓
- Acceptance: brand-new trial user unblurred on first paint → Task 5 (E2E + manual prod) ✓

**Placeholder scan:** No TODO/TBD. Task 1 is a real verification with exact SQL and a conditional action, not a placeholder. ✓

**Type consistency:** `EntitlementsState` is used identically in `server.ts` (Task 3), the provider prop (Task 4), and the `Providers` prop (Task 4). `fetchEntitlementsServer(userId)` signature matches its call in `AppShell`. ✓

**Risks:** (1) SSR adds one backend call per authenticated render — acceptable, runs only when `initialUserId` is set, fails open to client refresh. (2) Task 2 depends on `trial_config.is_enabled = true` (Task 1 guarantees it). (3) The migration timestamp must be ≥ the current max in `schema_migrations` or it is silently skipped — use a real current UTC timestamp.
