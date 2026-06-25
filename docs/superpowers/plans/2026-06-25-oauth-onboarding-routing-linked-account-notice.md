# OAuth Onboarding Routing + Linked-Account Notice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop force-onboarding returning users (only genuinely new, not-yet-onboarded accounts go through `/tour`), and show a one-time toast when a Google sign-in links to a pre-existing email account.

**Architecture:** All changes are in `packages/frontend`. A pure helper decides onboarding routing from the auth user's age + the real completion column; the OAuth callback consumes it and also detects a freshly-linked identity, stashing a one-shot `sessionStorage` flag; a tiny always-mounted client component reads that flag and fires the existing global toast.

**Tech Stack:** Next.js App Router (React 19), Supabase JS (`@supabase/ssr` browser client), vitest, existing `components/ui/Toast` (`ToastProvider` / `useToast`).

## Global Constraints

- Data fetching rule does NOT apply to `supabase.auth.*` / `supabase.from(...)` inside the auth callback — those are the Supabase client, not the `@/lib/data` REST layer. Do not route them through `@/lib/data`.
- No new DB columns, no migrations, no env changes.
- The completion signal is `user_profiles.onboarding_completed_at` (written by `completeOnboarding()` in `lib/data/fetchers/onboarding.ts:65`). `onboarding_market` and `last_login_at` are dead signals — do NOT use them for routing.
- The "new account" age signal is `session.user.created_at` (auth.users), NOT `user_profiles.created_at`.
- `NEW_ACCOUNT_WINDOW_MS = 30 * 60_000` (30 minutes).
- All callback session work stays inside the deferred `completeSignIn` (off the `onAuthStateChange` callback) — never reintroduce an `await supabase.auth.*` directly inside the `onAuthStateChange` handler (auth-lock deadlock).
- Toast copy (exact): `Welcome back — your Google sign-in is now linked to your existing PropertyIQ account.`
- Verification uses `tsc --noEmit` and `vitest`. NEVER run `next build` against the running dev `.next` (use is out of scope here). The pre-existing `.next-verify/types/.../go/[slug]/route.ts` TS error is a stale generated artifact — ignore it (filter it out).

---

### Task 1: Pure onboarding-routing helper (TDD)

**Files:**

- Create: `packages/frontend/app/(app)/auth/callback/onboarding-routing.ts`
- Test: `packages/frontend/app/(app)/auth/callback/__tests__/onboarding-routing.test.ts`

**Interfaces:**

- Produces: `decideNeedsOnboarding(input: { accountCreatedAt: string; type: string | null; onboardingCompletedAt: string | null; now: number; newAccountWindowMs?: number }): boolean` and `NEW_ACCOUNT_WINDOW_MS: number`.

- [ ] **Step 1: Write the failing test**

Create `packages/frontend/app/(app)/auth/callback/__tests__/onboarding-routing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { decideNeedsOnboarding } from "../onboarding-routing";

const NOW = 1_750_000_000_000;
const isoAgo = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

describe("decideNeedsOnboarding", () => {
  it("new OAuth account, not completed -> true", () => {
    expect(
      decideNeedsOnboarding({
        accountCreatedAt: isoAgo(5_000),
        type: null,
        onboardingCompletedAt: null,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("old account, not completed -> false (the reported bug)", () => {
    expect(
      decideNeedsOnboarding({
        accountCreatedAt: isoAgo(60 * DAY),
        type: null,
        onboardingCompletedAt: null,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("delayed email-confirm signup (old-ish account), not completed -> true", () => {
    expect(
      decideNeedsOnboarding({
        accountCreatedAt: isoAgo(6 * 60 * MIN),
        type: "signup",
        onboardingCompletedAt: null,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("completed onboarding -> false regardless of age/type", () => {
    expect(
      decideNeedsOnboarding({
        accountCreatedAt: isoAgo(5_000),
        type: "signup",
        onboardingCompletedAt: isoAgo(1_000),
        now: NOW,
      }),
    ).toBe(false);
  });

  it("invalid created_at and not email-confirm -> false", () => {
    expect(
      decideNeedsOnboarding({
        accountCreatedAt: "not-a-date",
        type: null,
        onboardingCompletedAt: null,
        now: NOW,
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `packages/frontend`): `npx vitest run onboarding-routing`
Expected: FAIL — cannot resolve `../onboarding-routing` / `decideNeedsOnboarding is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/frontend/app/(app)/auth/callback/onboarding-routing.ts`:

```ts
/**
 * Pure decision for whether a just-authenticated user should be routed into
 * the /tour onboarding flow.
 *
 * Force onboarding ONLY for genuinely new accounts that have not finished
 * onboarding. Returning users (established accounts) always skip it.
 *
 * Signals:
 *  - onboardingCompletedAt: the real completion marker
 *    (user_profiles.onboarding_completed_at). If set, never onboard again.
 *  - accountCreatedAt: auth.users.created_at via session.user.created_at —
 *    the only reliable account-age signal (last_login_at / profile.created_at
 *    are not maintained). OAuth round-trips complete in seconds, so a 30-min
 *    window cleanly separates new signups from returning users.
 *  - type === "signup": the email-confirmation link carries this; the click
 *    can land hours after signup, so it onboards regardless of the age window.
 */
export const NEW_ACCOUNT_WINDOW_MS = 30 * 60_000;

export function decideNeedsOnboarding(input: {
  accountCreatedAt: string;
  type: string | null;
  onboardingCompletedAt: string | null;
  now: number;
  newAccountWindowMs?: number;
}): boolean {
  const {
    accountCreatedAt,
    type,
    onboardingCompletedAt,
    now,
    newAccountWindowMs = NEW_ACCOUNT_WINDOW_MS,
  } = input;

  if (onboardingCompletedAt) return false;

  const createdMs = new Date(accountCreatedAt).getTime();
  const isNewAccount =
    Number.isFinite(createdMs) && now - createdMs < newAccountWindowMs;
  const isEmailConfirmSignup = type === "signup";

  return isNewAccount || isEmailConfirmSignup;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `packages/frontend`): `npx vitest run onboarding-routing`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add "packages/frontend/app/(app)/auth/callback/onboarding-routing.ts" "packages/frontend/app/(app)/auth/callback/__tests__/onboarding-routing.test.ts"
git commit -m "feat(auth): pure decideNeedsOnboarding helper (gate on onboarding_completed_at + account age)"
```

---

### Task 2: Wire the helper into the OAuth callback

**Files:**

- Modify: `packages/frontend/app/(app)/auth/callback/page.tsx`

**Interfaces:**

- Consumes: `decideNeedsOnboarding` from Task 1.
- Produces: callback routing now driven by `onboarding_completed_at` + `session.user.created_at`.

- [ ] **Step 1: Add the import**

At the top of `page.tsx`, after the existing `import { startOnboardingTrial, API_URL } from "@/lib/data";` line, add:

```ts
import { decideNeedsOnboarding } from "./onboarding-routing";
```

- [ ] **Step 2: Switch the profile query column**

In `completeSignIn`, find:

```ts
const profileResult: any = await withTimeout(
  supabase
    .from("user_profiles")
    .select("created_at, onboarding_market")
    .eq("id", session.user.id)
    .maybeSingle(),
);
```

Replace the `.select(...)` line so it reads:

```ts
              .select("created_at, onboarding_completed_at")
```

(Leave `created_at` — it still feeds the `isFreshSignup` analytics check below.)

- [ ] **Step 3: Replace the needsOnboarding computation**

In `completeSignIn`, find:

```ts
const profile = profileResult?.data;
needsOnboarding = !!profile && profile.onboarding_market === null;
```

Replace the second line with:

```ts
const profile = profileResult?.data;
needsOnboarding = decideNeedsOnboarding({
  accountCreatedAt: session.user.created_at,
  type,
  onboardingCompletedAt: profile?.onboarding_completed_at ?? null,
  now: Date.now(),
});
```

(`type` and `now` are already in scope; `session.user.created_at` is on the Supabase session user.)

- [ ] **Step 4: Verify types compile**

Run (from `packages/frontend`): `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v ".next-verify" | grep "error TS" || echo "TYPECLEAN"`
Expected: `TYPECLEAN` (the `session.user.created_at` access is typed on the Supabase `User`; `created_at` is still selected so the analytics block still compiles).

- [ ] **Step 5: Run the unit test again (regression guard)**

Run (from `packages/frontend`): `npx vitest run onboarding-routing`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "packages/frontend/app/(app)/auth/callback/page.tsx"
git commit -m "fix(auth): route only new, not-yet-onboarded accounts to /tour"
```

---

### Task 3: Detect a freshly-linked OAuth identity in the callback

**Files:**

- Modify: `packages/frontend/app/(app)/auth/callback/page.tsx`

**Interfaces:**

- Produces: writes `sessionStorage["piq_account_linked"] = "<provider>"` (e.g. `"google"`) when an OAuth identity was linked to a pre-existing password account within the last 60s. Consumed by Task 4.

- [ ] **Step 1: Add the detection block**

In `completeSignIn`, find the recovery early-return:

```ts
if (type === "recovery") {
  router.replace("/account?reset=true");
  return;
}
```

Immediately AFTER that block, insert:

```ts
// Detect a freshly-linked OAuth identity on a pre-existing (email)
// account so the destination page can show a one-time toast. Safe
// here: completeSignIn runs off the onAuthStateChange callback, so
// getUserIdentities does not re-enter the auth lock. Best-effort —
// failure/timeout simply shows no toast and never blocks auth.
try {
  const { data: identityData } = await withTimeout(
    supabase.auth.getUserIdentities(),
  );
  const identities = identityData?.identities ?? [];
  const oauthIdentity = identities.find((i) => i.provider !== "email");
  const hasPassword = identities.some((i) => i.provider === "email");
  const linkedAtMs = oauthIdentity?.created_at
    ? new Date(oauthIdentity.created_at).getTime()
    : null;
  const justLinked =
    hasPassword &&
    !!oauthIdentity &&
    linkedAtMs !== null &&
    Date.now() - linkedAtMs < 60_000;
  if (justLinked) {
    sessionStorage.setItem("piq_account_linked", oauthIdentity.provider);
    debugLog("account_linked", { provider: oauthIdentity.provider });
  }
} catch (err) {
  debugLog("account_link_check_failed", { error: String(err) });
}
```

- [ ] **Step 2: Verify types compile**

Run (from `packages/frontend`): `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v ".next-verify" | grep "error TS" || echo "TYPECLEAN"`
Expected: `TYPECLEAN` (`getUserIdentities()` returns `{ data: { identities: UserIdentity[] } | null }`; `UserIdentity.created_at` is `string | undefined`, handled by the `?` guard).

- [ ] **Step 3: Commit**

```bash
git add "packages/frontend/app/(app)/auth/callback/page.tsx"
git commit -m "feat(auth): flag freshly-linked OAuth identity for the account-linked toast"
```

---

### Task 4: AccountLinkedToast component + global mount

**Files:**

- Create: `packages/frontend/components/auth/AccountLinkedToast.tsx`
- Modify: `packages/frontend/app/providers.tsx`

**Interfaces:**

- Consumes: `sessionStorage["piq_account_linked"]` from Task 3; `useToast()` from `@/components/ui/Toast`.

- [ ] **Step 1: Create the component**

Create `packages/frontend/components/auth/AccountLinkedToast.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/Toast";

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
};

/**
 * Reads the one-shot `piq_account_linked` flag written by the auth callback
 * when a Google sign-in is linked to a pre-existing PropertyIQ account, and
 * fires a single welcome-back toast. Renders nothing. Must be mounted inside
 * <ToastProvider>.
 */
export function AccountLinkedToast() {
  const { showToast } = useToast();

  useEffect(() => {
    const provider = sessionStorage.getItem("piq_account_linked");
    if (!provider) return;
    sessionStorage.removeItem("piq_account_linked");
    const label = PROVIDER_LABELS[provider] ?? "social";
    showToast(
      `Welcome back — your ${label} sign-in is now linked to your existing PropertyIQ account.`,
      "🔗",
    );
  }, [showToast]);

  return null;
}
```

- [ ] **Step 2: Mount it inside ToastProvider**

In `packages/frontend/app/providers.tsx`, add the import near the other component imports (alongside the `ToastProvider` import):

```ts
import { AccountLinkedToast } from "@/components/auth/AccountLinkedToast";
```

Then, inside the `<ToastProvider>` element, add `<AccountLinkedToast />` next to `<ExitIntentModal />`:

```tsx
<ToastProvider>
  <EntitlementsProvider initialState={initialEntitlementState}>
    <OnboardingBeaconProvider>
      <PaywallProvider>{children}</PaywallProvider>
    </OnboardingBeaconProvider>
  </EntitlementsProvider>
  <ExitIntentModal />
  <AccountLinkedToast />
</ToastProvider>
```

- [ ] **Step 3: Verify types compile**

Run (from `packages/frontend`): `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v ".next-verify" | grep "error TS" || echo "TYPECLEAN"`
Expected: `TYPECLEAN`.

- [ ] **Step 4: Commit**

```bash
git add "packages/frontend/components/auth/AccountLinkedToast.tsx" "packages/frontend/app/providers.tsx"
git commit -m "feat(auth): one-time account-linked welcome-back toast"
```

---

### Task 5: Live verification (post-deploy, real DB, no mocks)

**Files:** none (verification only).

This runs AFTER the change is released to `main` and Railway redeploys the frontend (the deadlock fix + this change). Uses the real Google account `troyhouston76@gmail.com` (user id `5834f6da-aaee-480d-9754-8c4f0b6f4927`), which has `onboarding_completed_at IS NULL` and an old (`2026-04-13`) auth account — i.e. the exact reported case.

- [ ] **Step 1: Returning-user sign-in does NOT force onboarding**

On prod, sign in with Google as the existing account. Watch the browser console.
Expected: `[auth/callback] 3_redirect { ... needsOnboarding: false }`, lands on the app destination (e.g. `/map`), NOT `/tour`. The "what brings you to PropertyIQ?" page does not appear.

- [ ] **Step 2: Account-linked toast appears once**

On that same landing, the toast `Welcome back — your Google sign-in is now linked to your existing PropertyIQ account.` appears and auto-dismisses (~4s). Console shows `[auth/callback] account_linked { provider: "google" }`.

- [ ] **Step 3: Toast does not repeat**

Reload the landing page.
Expected: no toast (the `piq_account_linked` flag was cleared on first read).

- [ ] **Step 4: New signup still onboards**

In a clean browser profile, sign up with a brand-new Google account.
Expected: console `needsOnboarding: true`, routed through `/tour`.

- [ ] **Step 5: Confirm DB state for the returning user (optional sanity)**

Via Supabase MCP (`plugin_supabase` server, project `pysflbhpnqwoczyuaaif`):

```sql
select id, onboarding_completed_at,
       (select count(*) from auth.identities i where i.user_id = u.id) as identity_count
from auth.users u where u.id = '5834f6da-aaee-480d-9754-8c4f0b6f4927';
```

Expected: `identity_count = 2` (email + google), `onboarding_completed_at` still null (we never force-completed it).

---

## Self-Review

**Spec coverage:**

- Part 1 onboarding routing → Tasks 1–2 ✓ (helper + wiring, gate on `onboarding_completed_at`, age via `session.user.created_at`, `type=signup` for email).
- Part 2 linked-account toast → Tasks 3–4 ✓ (detection via `getUserIdentities` + `sessionStorage`; display via `AccountLinkedToast` in `ToastProvider`).
- Non-goals (no migration, linking unchanged, recovery untouched) → respected; detection block is placed AFTER the `type === "recovery"` return so resets never trigger it ✓.
- Error handling (best-effort identity check, invalid created_at → not-new) → Task 3 try/catch + Task 1 `Number.isFinite` guard ✓.
- Testing (unit + live E2E) → Tasks 1 and 5 ✓.

**Placeholder scan:** none — all steps contain full code/commands.

**Type consistency:** `decideNeedsOnboarding` signature identical in Task 1 (definition) and Task 2 (call site); `piq_account_linked` key + provider-string value identical in Task 3 (write) and Task 4 (read); toast copy identical in spec and Task 4.
