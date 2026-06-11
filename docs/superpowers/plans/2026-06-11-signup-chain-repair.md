# Signup Chain Repair — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every anonymous CTA reach a working account creation — fix the four confirmed signup-chain defects (ToS-disabled buttons, pricing→sign-in misroute, false "Current Plan", report dead-end), resume Stripe checkout after a purchase-intent signup, and prove it with a production Playwright E2E.

**Architecture:** Frontend-only changes (Next.js App Router, React 19, client components). One shared signal — `checkoutIntent` in `sessionStorage` — lets the email-signup flow skip the `/tour` and resume checkout on `/pricing`. Anonymous-vs-free is disambiguated by threading an `isAuthenticated` prop into the pricing cards. The report dead-end becomes an inline signup CTA that preserves the selected market via the page's existing `mid/mname/mtype/mstate` URL-prefill.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind, Playwright (`tests/e2e`), `@supabase/supabase-js` (E2E DB assertions). Vitest for unit tests; Google OAuth is **out of scope** (deferred — spec §2).

**Spec:** `docs/superpowers/specs/2026-06-11-signup-chain-repair-design.md`

**Branch/working-dir policy:** Execute on `develop` in the main working dir `D:\Projects\rei-platform`. No new branch. Commit locally per task. **Do NOT push** — the user pushes and triggers the production deploy.

**Per-task verification (project rule "verify after every task"):** after each code task run `npm run lint` and a typecheck, and for UI tasks a real browser render check. No mock-based UI unit tests — UI behavior is verified by the live Playwright E2E (Tasks 7–9) per `feedback_no-mock-tests-use-live-data`.

Typecheck command (no dedicated script exists):

```bash
cd packages/frontend && npx tsc --noEmit -p tsconfig.json
```

---

## File Structure

| File                                                        | Change | Responsibility                                                                                  |
| ----------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| `packages/frontend/app/auth/sign-up/page.tsx`               | Modify | Fix A (enable buttons + inline ToS error + checkbox emphasis); Task 3 checkout-resume skip-tour |
| `packages/frontend/app/pricing/page.tsx`                    | Modify | Fix B (anon Pro → sign-up); pass `isAuthenticated` to cards                                     |
| `packages/frontend/app/pricing/components/PricingCards.tsx` | Modify | Fix C (gate "Current Plan" on auth; anon Free → "Sign up free")                                 |
| `packages/frontend/app/reports/page.tsx`                    | Modify | Fix D (replace dead-end error with inline signup CTA preserving market)                         |
| `packages/frontend/tests/e2e/auth-flows.spec.ts`            | Modify | Replace the stale `/reports`→sign-in route-protection test                                      |
| `packages/frontend/tests/e2e/helpers/supabase-admin.ts`     | Create | E2E DB assertions + test-user cleanup                                                           |
| `packages/frontend/tests/e2e/signup-chain.spec.ts`          | Create | The acceptance E2E for the whole chain (email path)                                             |

---

## Task 1: Fix A — ToS buttons enabled-by-default + inline error

**Files:**

- Modify: `packages/frontend/app/auth/sign-up/page.tsx` (import line 3; handlers `:100-103`, `:182-185`; ToS label `:357-377`; buttons `:382`, `:404`)

Root cause: both buttons are `disabled={loading || !tosAccepted}`, so the existing `setError("You must accept the Terms of Service…")` guards are unreachable. Enable the buttons; the guards then fire the inline banner; add a ring on the ToS checkbox and scroll it into view.

- [ ] **Step 1: Add `useRef` to the React import**

Change line 3:

```tsx
import { Suspense, useState, useEffect, useRef, FormEvent } from "react";
```

- [ ] **Step 2: Declare a ref for the ToS checkbox**

Immediately after `const [confirmationSent, setConfirmationSent] = useState(false);` (line ~89) add:

```tsx
const tosRef = useRef<HTMLLabelElement>(null);
const tosError =
  error === "You must accept the Terms of Service to create an account";
```

- [ ] **Step 3: Scroll-to + keep the guard in `handleSignUp`**

Replace the existing guard (lines ~100-103):

```tsx
if (!tosAccepted) {
  setError("You must accept the Terms of Service to create an account");
  return;
}
```

with:

```tsx
if (!tosAccepted) {
  setError("You must accept the Terms of Service to create an account");
  tosRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  return;
}
```

- [ ] **Step 4: Same scroll-to in `handleOAuth`**

Replace the existing guard (lines ~182-185):

```tsx
if (!tosAccepted) {
  setError("You must accept the Terms of Service to create an account");
  return;
}
```

with:

```tsx
if (!tosAccepted) {
  setError("You must accept the Terms of Service to create an account");
  tosRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  return;
}
```

- [ ] **Step 5: Attach the ref + emphasis ring to the ToS label**

Replace the opening tag of the ToS `<label>` (line ~357):

```tsx
              <label className="flex items-start gap-3 cursor-pointer select-none py-1">
```

with:

```tsx
              <label
                ref={tosRef}
                className={`flex items-start gap-3 cursor-pointer select-none py-1 rounded-lg transition-shadow ${
                  tosError ? "ring-2 ring-error/60 ring-offset-2 ring-offset-surface-container px-2" : ""
                }`}
              >
```

- [ ] **Step 6: Enable the Create Account button**

Change line ~382 from `disabled={loading || !tosAccepted}` to:

```tsx
disabled = { loading };
```

- [ ] **Step 7: Enable the Google button**

Change line ~404 from `disabled={loading || !tosAccepted}` to:

```tsx
disabled = { loading };
```

- [ ] **Step 8: Verify (lint + typecheck + render)**

```bash
cd packages/frontend && npm run lint && npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.
Render check: with dev running, load `http://localhost:3000/auth/sign-up`, confirm Create Account + Google are clickable with ToS unchecked, clicking Create Account shows the red banner and the checkbox gets a ring.

- [ ] **Step 9: Commit**

```bash
git add packages/frontend/app/auth/sign-up/page.tsx
git commit -m "fix(signup): enable Create Account/Google with inline ToS error instead of silent disable"
```

---

## Task 2: Fix B + C — pricing anonymous handling

**Files:**

- Modify: `packages/frontend/app/pricing/page.tsx` (`handleUpgrade` `:128-140`; `<PricingCards>` usage `:185-194`)
- Modify: `packages/frontend/app/pricing/components/PricingCards.tsx` (props `:10-19`; `PricingCard` `:112-224`; `CardCTA` `:230-297`)

Root cause: the page passes `effectiveTier ?? "free"`, so anonymous looks like logged-in free → false "Current Plan". Thread `isAuthenticated`; gate the current-plan treatment on it; send anonymous Pro clicks to sign-UP.

- [ ] **Step 1: Route anonymous Pro clicks to sign-up (Fix B)**

In `pricing/page.tsx` `handleUpgrade`, replace the `router.push` inside the `if (!user) {` block (lines ~137-139):

```tsx
router.push(
  `/auth/sign-in?redirect=${encodeURIComponent(`/pricing?from=${encodeURIComponent(returnContext)}`)}`,
);
```

with:

```tsx
router.push(
  `/auth/sign-up?redirect=${encodeURIComponent(`/pricing?from=${encodeURIComponent(returnContext)}`)}`,
);
```

- [ ] **Step 2: Pass `isAuthenticated` into `<PricingCards>`**

In `pricing/page.tsx`, add the prop to the `<PricingCards ... />` usage (after `onUpgrade={handleUpgrade}`, line ~193):

```tsx
          isAuthenticated={!!user}
```

- [ ] **Step 3: Add `isAuthenticated` to `PricingCardsProps` and thread it down**

In `PricingCards.tsx`, add to the `PricingCardsProps` interface (after `onUpgrade`, line ~18):

```tsx
isAuthenticated: boolean;
```

Destructure it in the `PricingCards` function signature (add `isAuthenticated,` to the params, line ~29), and pass it to each `<PricingCard>` (add the prop after `onUpgrade={onUpgrade}`, line ~91):

```tsx
isAuthenticated = { isAuthenticated };
```

- [ ] **Step 4: Add `isAuthenticated` to `PricingCardProps` and gate `isCurrentPlan`**

In `PricingCardProps` (after `onUpgrade`, line ~109) add:

```tsx
isAuthenticated: boolean;
```

Add `isAuthenticated,` to the `PricingCard` destructured params (line ~119). Then change line ~120:

```tsx
const isCurrentPlan = effectiveTier === plan.slug;
```

to:

```tsx
const isCurrentPlan = isAuthenticated && effectiveTier === plan.slug;
```

This single change fixes both the green badge (`:153`) and the dead "Current Plan" div, since both read `isCurrentPlan`.

- [ ] **Step 5: Pass `isAuthenticated` into `CardCTA`**

In `PricingCard`'s `<CardCTA ... />` (after `onUpgrade={onUpgrade}`, line ~220) add:

```tsx
isAuthenticated = { isAuthenticated };
```

- [ ] **Step 6: Anonymous Free card → "Sign up free" (Fix C)**

In `CardCTA`'s prop type object (after `onUpgrade: (s: string) => void;`, line ~247) add:

```tsx
isAuthenticated: boolean;
```

Add `isAuthenticated,` to the `CardCTA` destructured params (line ~248). Then replace the `free` branch (lines ~256-265):

```tsx
if (slug === "free") {
  return (
    <a
      href="/map"
      className="block w-full text-center py-2 rounded-lg font-medium text-sm transition-colors bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
    >
      Get Started
    </a>
  );
}
```

with:

```tsx
if (slug === "free") {
  return (
    <a
      href={isAuthenticated ? "/map" : "/auth/sign-up"}
      className="block w-full text-center py-2 rounded-lg font-medium text-sm transition-colors bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
    >
      {isAuthenticated ? "Get Started" : "Sign up free"}
    </a>
  );
}
```

- [ ] **Step 7: Verify (lint + typecheck + render)**

```bash
cd packages/frontend && npm run lint && npx tsc --noEmit -p tsconfig.json
```

Render check (logged out, e.g. incognito): load `http://localhost:3000/pricing` — Free card shows **"Sign up free"** (no green "Current Plan" badge); clicking the Pro CTA navigates to `/auth/sign-up`.

- [ ] **Step 8: Commit**

```bash
git add packages/frontend/app/pricing/page.tsx packages/frontend/app/pricing/components/PricingCards.tsx
git commit -m "fix(pricing): anonymous visitors get Sign-up-free + sign-up routing, not false Current Plan"
```

---

## Task 3: Email signup resumes checkout, skipping the tour

**Files:**

- Modify: `packages/frontend/app/auth/sign-up/page.tsx` (success branch, the `router.push(redirectTo)` at line ~172)

`checkoutIntent` (written by `pricing/page.tsx` before redirect) is the single skip-tour signal. When present, push the explicit redirect (`/pricing?from=…`) directly; the `/pricing` auto-checkout effect then resumes Stripe.

- [ ] **Step 1: Branch the post-signup destination on `checkoutIntent`**

Replace the single line (line ~172):

```tsx
router.push(redirectTo);
```

with:

```tsx
// Honor a pending purchase intent: if the user clicked a paid CTA before
// signing up, skip the /tour and return to /pricing so the existing
// auto-checkout effect resumes Stripe. Otherwise use the normal flow.
const hasCheckoutIntent =
  typeof window !== "undefined" &&
  !!window.sessionStorage.getItem("checkoutIntent");
router.push(
  hasCheckoutIntent && explicitRedirect ? explicitRedirect : redirectTo,
);
```

- [ ] **Step 2: Verify (lint + typecheck)**

```bash
cd packages/frontend && npm run lint && npx tsc --noEmit -p tsconfig.json
```

Expected: no errors. (Behavioral verification happens in the Task 8 E2E "pricing → sign-up → checkout resumes" case.)

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/auth/sign-up/page.tsx
git commit -m "fix(signup): resume Stripe checkout after purchase-intent signup, bypassing the tour"
```

---

## Task 4: Fix D — report dead-end becomes an inline signup CTA

**Files:**

- Modify: `packages/frontend/app/reports/page.tsx` (state `:476-479`; `handleGenerate` guard `:597-602`; JSX after the Generate button `:725`)

Anonymous users reach `/reports` (middleware makes exactly `/reports` public, `middleware.ts:160`). Replace the flat "You must be signed in" error with an inline CTA that preserves the chosen market via the page's existing `mid/mname/mtype/mstate` URL-prefill (`:487-499`).

- [ ] **Step 1: Add the signup-prompt state**

After `const [error, setError] = useState<string | null>(null);` (line ~479) add:

```tsx
const [showSignupPrompt, setShowSignupPrompt] = useState(false);
```

- [ ] **Step 2: Replace the dead-end guard in `handleGenerate`**

Replace lines ~597-602:

```tsx
const userId = user?.id;
if (!userId) {
  setError("You must be signed in to generate a report.");
  setIsGenerating(false);
  return;
}
```

with:

```tsx
const userId = user?.id;
if (!userId) {
  setShowSignupPrompt(true);
  setIsGenerating(false);
  return;
}
```

- [ ] **Step 3: Render the inline signup CTA after the Generate button**

Insert this block immediately after the closing `</motion.button>` of the Generate button (line ~725), before the `{!canGenerate && (` block:

```tsx
{
  showSignupPrompt && markets[0] && (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-primary/30 bg-primary-container/40 p-5 text-center"
    >
      <h3 className="text-base font-semibold text-on-surface mb-1">
        Sign up free to generate your {markets[0].name} report
      </h3>
      <p className="text-sm text-on-surface-variant mb-4">
        Create a free account and we&apos;ll bring you right back to this
        report.
      </p>
      <a
        href={`/auth/sign-up?redirect=${encodeURIComponent(
          `/reports?mid=${encodeURIComponent(markets[0].id)}&mname=${encodeURIComponent(
            markets[0].name,
          )}&mtype=${encodeURIComponent(markets[0].type)}${
            markets[0].state
              ? `&mstate=${encodeURIComponent(markets[0].state)}`
              : ""
          }`,
        )}`}
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full font-semibold text-sm hover:bg-primary/90 transition-all"
      >
        Sign up free <ArrowRight className="w-4 h-4" />
      </a>
    </motion.div>
  );
}
```

(`ArrowRight` and `motion` are already imported — `:25`, `:11`.)

- [ ] **Step 4: Verify (lint + typecheck + render)**

```bash
cd packages/frontend && npm run lint && npx tsc --noEmit -p tsconfig.json
```

Render check (logged out): load `http://localhost:3000/reports`, search and add a market, click **Generate Report** → the inline "Sign up free to generate your … report" card appears (no "You must be signed in" error); the button links to `/auth/sign-up?redirect=%2Freports%3Fmid%3D…`.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/reports/page.tsx
git commit -m "fix(reports): replace anonymous generate dead-end with inline signup CTA preserving the market"
```

---

## Task 5: Fix the stale `/reports` route-protection E2E test

**Files:**

- Modify: `packages/frontend/tests/e2e/auth-flows.spec.ts` (test at `:251-256`)

`/reports` is public (`middleware.ts:160`), so the existing test asserting a redirect to sign-in is stale and fails. Update it to assert the public builder.

- [ ] **Step 1: Replace the stale test**

Replace lines ~251-256:

```ts
test("redirects unauthenticated user from /reports to sign-in", async ({
  page,
}) => {
  await page.goto("/reports");
  await page.waitForURL(/\/auth\/sign-in/, { timeout: 10_000 });
});
```

with:

```ts
test("/reports is public — anonymous users reach the report builder", async ({
  page,
}) => {
  await page.goto("/reports");
  // Public builder: stays on /reports, does NOT redirect to sign-in.
  await expect(page).toHaveURL(/\/reports(\?.*)?$/);
  await expect(
    page.getByRole("heading", { name: /select your market/i }),
  ).toBeVisible({ timeout: 10_000 });
});
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/tests/e2e/auth-flows.spec.ts
git commit -m "test(auth): /reports is public — update stale route-protection expectation"
```

---

## Task 6: E2E DB-assertion helper

**Files:**

- Create: `packages/frontend/tests/e2e/helpers/supabase-admin.ts`

A small admin client for asserting `auth.users` + `user_events` rows and deleting test users afterward. Reads service credentials from `.env.test` (loaded by `playwright.config.ts:4`).

> Before writing, confirm the exact env var names in `packages/frontend/.env.test` (the repo uses the new `sb_secret_` key naming per the Supabase-key memory). The helper below falls back across the common names.

- [ ] **Step 1: Write the helper**

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for E2E assertions and cleanup.
 * NEVER import this into application code — tests only.
 */
function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;
  if (!url || !secret) {
    throw new Error(
      "E2E DB assertions need NEXT_PUBLIC_SUPABASE_URL and a service/secret key in .env.test",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Find an auth user by email. Returns the user id or null. */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const supabase = adminClient();
  // listUsers is paginated; for a fresh unique email the user is on page 1.
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) throw error;
  const match = data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  return match?.id ?? null;
}

/** True once a signup_complete event for this user is in user_events. */
export async function hasSignupCompleteEvent(userId: string): Promise<boolean> {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("user_events")
    .select("id")
    .eq("user_id", userId)
    .eq("event_name", "signup_complete")
    .limit(1);
  if (error) throw error;
  return !!data && data.length > 0;
}

/** Delete a test user (and cascade) by id. Best-effort. */
export async function deleteUser(userId: string): Promise<void> {
  const supabase = adminClient();
  await supabase.auth.admin.deleteUser(userId).catch(() => {});
}
```

- [ ] **Step 2: Verify it typechecks**

```bash
cd packages/frontend && npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/tests/e2e/helpers/supabase-admin.ts
git commit -m "test(e2e): add supabase-admin helper for signup-chain DB assertions"
```

---

## Task 7: The signup-chain acceptance E2E (email path)

**Files:**

- Create: `packages/frontend/tests/e2e/signup-chain.spec.ts`

Covers the four fixes against live pages, then a real email signup with DB assertions + cleanup. Google OAuth is deferred.

- [ ] **Step 1: Write the spec**

```ts
/**
 * Signup Chain E2E — backlog item #1 (email path; Google OAuth deferred).
 *
 * Drives LIVE pages (no mocks). The "completes email signup" test creates a
 * REAL auth user with a unique disposable email and deletes it afterward.
 *
 * Prereqs: frontend on :3000, backend on :3001, .env.test with
 * NEXT_PUBLIC_SUPABASE_URL + a service/secret key.
 */
import { test, expect } from "@playwright/test";
import {
  findUserIdByEmail,
  hasSignupCompleteEvent,
  deleteUser,
} from "./helpers/supabase-admin";

test.describe("Signup chain", () => {
  test.setTimeout(90_000);

  // ---- Fix A: ToS no longer silently disables ----
  test("sign-up buttons are enabled with ToS unchecked and show an inline error", async ({
    page,
  }) => {
    await page.goto("/auth/sign-up");
    const createBtn = page.getByRole("button", { name: /create account/i });
    await expect(createBtn).toBeEnabled();
    await page.getByLabel(/^email$/i).fill("not-submitted@example.com");
    await page.locator("#password").fill("StrongPass1");
    await page.locator("#confirm-password").fill("StrongPass1");
    await createBtn.click();
    await expect(
      page.getByText(/must accept the terms of service/i),
    ).toBeVisible();
  });

  // ---- Fix B/C: pricing anonymous ----
  test("anonymous Free card says Sign up free, not Current Plan", async ({
    page,
  }) => {
    await page.goto("/pricing");
    await expect(
      page.getByRole("link", { name: /sign up free/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/current plan/i)).toHaveCount(0);
  });

  test("anonymous Pro CTA routes to sign-up", async ({ page }) => {
    await page.goto("/pricing");
    // Bottom CTA uses the pricing A/B copy; match the Pro card button instead.
    await page
      .getByRole("button", { name: /get pro|go pro|upgrade|start/i })
      .first()
      .click();
    await page.waitForURL(/\/auth\/sign-up/, { timeout: 10_000 });
  });

  // ---- Fix D: report dead-end ----
  test("anonymous report generate shows a signup CTA, not a dead-end", async ({
    page,
  }) => {
    await page.goto("/reports");
    // Select a market via the builder's search widget.
    await page.getByRole("heading", { name: /select your market/i }).waitFor();
    const search = page.getByPlaceholder(/search/i).first();
    await search.click();
    await search.fill("Austin");
    await page
      .getByText(/Austin/i)
      .first()
      .click();
    await page.getByRole("button", { name: /generate report/i }).click();
    await expect(page.getByText(/sign up free to generate your/i)).toBeVisible({
      timeout: 10_000,
    });
    const cta = page.getByRole("link", { name: /sign up free/i });
    await expect(cta).toHaveAttribute(
      "href",
      /\/auth\/sign-up\?redirect=.*reports/,
    );
    // No dead-end error string anywhere.
    await expect(page.getByText(/you must be signed in/i)).toHaveCount(0);
  });

  // ---- Email signup happy path + DB assertions (creates + deletes a real user) ----
  test("completes email signup from homepage and logs signup_complete", async ({
    page,
  }) => {
    const email = `piq-e2e-${Date.now()}@example.com`;
    const password = "StrongPass1";
    let userId: string | null = null;
    try {
      await page.goto("/auth/sign-up");
      await page.getByLabel(/^email$/i).fill(email);
      await page.locator("#password").fill(password);
      await page.locator("#confirm-password").fill(password);
      await page.getByRole("checkbox").check(); // ToS
      await page.getByRole("button", { name: /create account/i }).click();

      // Autoconfirm returns a session and navigates into the app (tour/map).
      await page.waitForURL(/\/(tour|map)/, { timeout: 20_000 });

      // Account row exists.
      await expect
        .poll(async () => (userId = await findUserIdByEmail(email)), {
          timeout: 15_000,
        })
        .not.toBeNull();

      // signup_complete landed in user_events (not analytics_events).
      await expect
        .poll(async () => hasSignupCompleteEvent(userId as string), {
          timeout: 15_000,
        })
        .toBe(true);
    } finally {
      if (userId) await deleteUser(userId);
    }
  });
});
```

- [ ] **Step 2: Stabilize selectors against the real pages**

Run only the non-destructive tests first and fix any selector drift (the Pro-card button name depends on the A/B copy in `PRICING_CTA_COPY`; the reports search placeholder comes from `SearchWidget`). Inspect with the Playwright UI if a locator misses:

```bash
cd packages/frontend && npx playwright test signup-chain -g "Free card|signup CTA|enabled with ToS" --reporter=list
```

Expected: these three pass once selectors match. Adjust the `getByRole`/`getByPlaceholder` names to the live DOM as needed (no behavior changes — selectors only).

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/tests/e2e/signup-chain.spec.ts
git commit -m "test(e2e): signup-chain acceptance spec (email path, DB-asserted)"
```

---

## Task 8: Local smoke run against real Supabase

**Files:** none (verification task)

- [ ] **Step 1: Start one clean dev stack**

Per project rule (single frontend + single backend): kill stray node, then from the repo root:

```bash
npm run dev:fresh
```

Confirm `http://localhost:3000` and the backend on `:3001` are up (real cloud Supabase).

- [ ] **Step 2: Run the full signup-chain spec + the updated auth-flows test**

```bash
cd packages/frontend && npx playwright test signup-chain auth-flows --project=chromium --reporter=list
```

Expected: all signup-chain tests PASS, including "completes email signup …" (creates then deletes a real user), and the updated `/reports is public` test PASSES.

- [ ] **Step 3: If anything fails, fix and re-run**

Use `superpowers:systematic-debugging` if a failure persists ~2 min. Re-run until green. Confirm in the Supabase dashboard that no `piq-e2e-*` users remain (cleanup worked).

- [ ] **Step 4: Commit any selector/code fixes**

```bash
git add -A packages/frontend
git commit -m "test(e2e): stabilize signup-chain selectors against live pages"
```

---

## Task 9: Production acceptance gate (user-triggered deploy)

**Files:** none (verification task). **This task is gated on a user action.**

- [ ] **Step 1: Hand off for deploy**

Tell the user the branch is ready and ask them to push `develop` and deploy frontend to production (Railway). Do not push or deploy yourself.

- [ ] **Step 2: Run the E2E against production**

After the deploy reaches a terminal SUCCESS state (verify per the Railway blue-green memory — don't trust a 200 alone):

```bash
cd packages/frontend && PLAYWRIGHT_BASE_URL=https://propertyiq.up.railway.app npx playwright test signup-chain --project=chromium --reporter=list
```

(Use the real production URL/custom domain if it has moved off the railway.app subdomain.)
Expected: all tests PASS against production; the email-signup test creates and then deletes a real production user.

- [ ] **Step 3: Confirm cleanup**

Verify in the production Supabase that no `piq-e2e-*` users or their `user_events` rows remain.

- [ ] **Step 4: Mark acceptance criteria**

Check off, with evidence (Playwright report + DB query screenshots/output):

- [ ] Anonymous completes email signup from homepage, pricing (checkout resumes), and the report dead-end → row in `auth.users` + `user_profiles`.
- [ ] ToS unchecked → inline error; button never silently disabled.
- [ ] Pricing "Get Pro Access" anonymous click lands on sign-up.
- [ ] `signup_complete` visible in `user_events` after the run.

---

## Notes / deferred follow-ups

- **Google OAuth flow** (callback skip-tour wiring, OAuth E2E, sub-task (e) confirmation messaging) — deferred (spec §2). Track as a follow-up task.
- **(g) instrumentation** is verified, not rebuilt: the Task 7 email test asserts `signup_complete` in `user_events`. Add instrumentation only if that assertion fails.
- **(f) reconciliation** — recon confirmed no overlap with the shipped 2026-04-10/04-12 activation tracks; nothing to dedupe.
