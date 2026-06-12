# Anonymous Two-Step Capture (Backlog #2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire the non-dismissible anonymous "5-page wall" so anonymous users browse freely, and replace the anon locked-feature experience with a dismissible email-first capture modal that hands off to the existing signup chain and grants a real 14-day Pro trial on signup.

**Architecture:** Remove the front-door `AnonPaywallOverlay` from `PaywallProvider`. Add one `AnonCaptureModal` (email + Google, dismissible via X/Escape/backdrop) that anon premium-clicks open instead of `/pricing`. Make the existing reverse-Pro-trial (`ensureTrialStarted`) fire on every completed signup (both the email-OTP and OAuth funnels), not just inside the tour, so the modal's "14 days of Pro" promise is honest. Small enablers: `?email=` prefill on signup, a shared `useDismissable` hook, a `useIsAnonymous` hook, and a pure `buildAnonReturnTo` helper.

**Tech Stack:** Next.js 16 App Router (client components), React 19, TypeScript, Tailwind v4 (M3 semantic tokens), Supabase auth, vitest + @testing-library/react (unit/component), Playwright (E2E against live dev servers on :3000/:3001).

**Spec:** `docs/superpowers/specs/2026-06-12-anon-paywall-two-step-capture-design.md`

**Verified facts this plan relies on:**

- Anonymous users resolve to tier `free` (`tier-resolver.service.ts:43`); anon and free see identical gating.
- `trial_config` in prod = `{ is_enabled: true, duration_days: 14, trial_tier: 'pro' }` (verified 2026-06-12). The trial copy is therefore honest.
- `ensureTrialStarted` is idempotent (existing-row check + `23505` race handling), so calling `startOnboardingTrial()` from multiple sites is safe.
- Two post-signup funnels: email-OTP → `app/auth/sign-up/complete-signup.ts`; OAuth/email-confirm → `handlePostSignup()` in `app/auth/callback/page.tsx`.
- `?tier=` URL param sets `simulatedAuth=true`, which suppresses anon UI — **do not** use it in anon E2E tests; use a clean logged-out context.

**Commit convention:** Do NOT add `Co-Authored-By` lines (user preference). Work on the `develop` branch. Run `git branch --show-current` before each commit. Do not push.

**Run commands (from `packages/frontend/`):**

- Unit/component test: `npx vitest run <path>`
- E2E: `npm run test:e2e -- <path>` (auto-starts dev server if not running)
- Build: `npm run build`
- Lint: `npx eslint <path>`

---

## Task 1: `useIsAnonymous` hook (DRY anon detection)

Centralizes the "is this visitor anonymous?" logic (real auth + dev `simulatedAuth` override) so `MetricItem` and `QuickActions` don't each re-derive it.

**Files:**

- Create: `packages/frontend/lib/entitlements/useIsAnonymous.ts`
- Test: `packages/frontend/lib/entitlements/__tests__/useIsAnonymous.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/lib/entitlements/__tests__/useIsAnonymous.test.tsx
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const authState = { user: null as null | { id: string }, loading: false };
const entState = { simulatedAuth: null as boolean | null };

vi.mock("@/lib/auth", () => ({ useAuth: () => authState }));
vi.mock("../EntitlementsContext", () => ({
  useEntitlements: () => entState,
}));

import { useIsAnonymous } from "../useIsAnonymous";

describe("useIsAnonymous", () => {
  it("is false while auth is still loading (avoids anon flash)", () => {
    authState.user = null;
    authState.loading = true;
    entState.simulatedAuth = null;
    expect(renderHook(() => useIsAnonymous()).result.current).toBe(false);
  });

  it("is true when no user and auth resolved", () => {
    authState.user = null;
    authState.loading = false;
    entState.simulatedAuth = null;
    expect(renderHook(() => useIsAnonymous()).result.current).toBe(true);
  });

  it("is false when a real user is present", () => {
    authState.user = { id: "u1" };
    authState.loading = false;
    entState.simulatedAuth = null;
    expect(renderHook(() => useIsAnonymous()).result.current).toBe(false);
  });

  it("treats dev simulatedAuth===false as anonymous even with a user", () => {
    authState.user = { id: "u1" };
    authState.loading = false;
    entState.simulatedAuth = false;
    expect(renderHook(() => useIsAnonymous()).result.current).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/entitlements/__tests__/useIsAnonymous.test.tsx`
Expected: FAIL — `Cannot find module '../useIsAnonymous'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/frontend/lib/entitlements/useIsAnonymous.ts
"use client";

import { useAuth } from "@/lib/auth";
import { useEntitlements } from "./EntitlementsContext";

/**
 * True when the current visitor should be treated as anonymous for gating UX.
 * Mirrors PaywallProvider's logic: honors the dev `simulatedAuth === false`
 * override and stays false until auth resolves (prevents an anon-UI flash on
 * hydration for logged-in users).
 */
export function useIsAnonymous(): boolean {
  const { user, loading } = useAuth();
  const { simulatedAuth } = useEntitlements();
  const effectiveUser = simulatedAuth === false ? null : user;
  return !loading && effectiveUser === null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/entitlements/__tests__/useIsAnonymous.test.tsx`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/lib/entitlements/useIsAnonymous.ts packages/frontend/lib/entitlements/__tests__/useIsAnonymous.test.tsx
git commit -m "feat(entitlements): add useIsAnonymous hook for anon gating UX"
```

---

## Task 2: `useDismissable` hook (Escape + backdrop)

Shared dismiss behavior so both the new modal and `FreeUserUpgradeModal` close on Escape and backdrop click.

**Files:**

- Create: `packages/frontend/lib/entitlements/useDismissable.ts`
- Test: `packages/frontend/lib/entitlements/__tests__/useDismissable.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/lib/entitlements/__tests__/useDismissable.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useRef } from "react";
import { useDismissable } from "../useDismissable";

function Harness({ onDismiss }: { onDismiss: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { onScrimClick } = useDismissable({ onDismiss, cardRef });
  return (
    <div data-testid="scrim" onClick={onScrimClick}>
      <div ref={cardRef} data-testid="card">
        card
      </div>
    </div>
  );
}

describe("useDismissable", () => {
  it("calls onDismiss when Escape is pressed", () => {
    const onDismiss = vi.fn();
    render(<Harness onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when the scrim (outside the card) is clicked", () => {
    const onDismiss = vi.fn();
    const { getByTestId } = render(<Harness onDismiss={onDismiss} />);
    fireEvent.click(getByTestId("scrim"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does NOT dismiss when the card itself is clicked", () => {
    const onDismiss = vi.fn();
    const { getByTestId } = render(<Harness onDismiss={onDismiss} />);
    fireEvent.click(getByTestId("card"));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/entitlements/__tests__/useDismissable.test.tsx`
Expected: FAIL — `Cannot find module '../useDismissable'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/frontend/lib/entitlements/useDismissable.ts
"use client";

import { useCallback, useEffect, type RefObject } from "react";

interface UseDismissableArgs {
  onDismiss: () => void;
  /** Ref to the dialog card; scrim clicks outside it dismiss. */
  cardRef: RefObject<HTMLElement | null>;
}

/**
 * Wires Escape-to-dismiss (document keydown) and returns an onScrimClick
 * handler that dismisses only when the click lands outside the card.
 */
export function useDismissable({ onDismiss, cardRef }: UseDismissableArgs) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  const onScrimClick = useCallback(
    (e: React.MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    },
    [onDismiss, cardRef],
  );

  return { onScrimClick };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/entitlements/__tests__/useDismissable.test.tsx`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/lib/entitlements/useDismissable.ts packages/frontend/lib/entitlements/__tests__/useDismissable.test.tsx
git commit -m "feat(entitlements): add useDismissable hook (Escape + backdrop)"
```

---

## Task 3: `buildAnonReturnTo` helper (pure)

Builds the URL the user returns to after signup, preserving current map state and forcing the clicked metric to be selected. Decision (settled): preserve the **full current map query string** (which already encodes geo level, state, sub-selectors) and set/override `metric` to the clicked id. This reuses the map's existing URL contract from `useMapViewParams.ts:79-88`.

**Files:**

- Create: `packages/frontend/lib/entitlements/buildAnonReturnTo.ts`
- Test: `packages/frontend/lib/entitlements/__tests__/buildAnonReturnTo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/frontend/lib/entitlements/__tests__/buildAnonReturnTo.test.ts
import { describe, it, expect } from "vitest";
import { buildAnonReturnTo } from "../buildAnonReturnTo";

describe("buildAnonReturnTo", () => {
  it("returns just the path when there is no state and no metric", () => {
    expect(buildAnonReturnTo("/map", "", undefined)).toBe("/map");
  });

  it("sets the metric param when provided on a bare path", () => {
    expect(buildAnonReturnTo("/map", "", "cap_rate")).toBe(
      "/map?metric=cap_rate",
    );
  });

  it("preserves existing map params and overrides metric", () => {
    expect(
      buildAnonReturnTo(
        "/map",
        "?level=county&st=TX&metric=home_value",
        "cap_rate",
      ),
    ).toBe("/map?level=county&st=TX&metric=cap_rate");
  });

  it("preserves existing params when no metric override is given", () => {
    expect(buildAnonReturnTo("/map", "?level=metro&st=CA", undefined)).toBe(
      "/map?level=metro&st=CA",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/entitlements/__tests__/buildAnonReturnTo.test.ts`
Expected: FAIL — `Cannot find module '../buildAnonReturnTo'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/frontend/lib/entitlements/buildAnonReturnTo.ts
/**
 * Builds the post-signup return URL for an anon capture.
 * Preserves the current map query string (geo level, state, sub-selectors —
 * see useMapViewParams URL contract) and, when a metric id is given, forces
 * it as the selected metric so the just-unlocked feature is visible on return.
 *
 * @param pathname e.g. "/map"
 * @param search   current location search incl. leading "?" (or "")
 * @param metricId clicked metric id to select, or undefined for non-metric gates
 */
export function buildAnonReturnTo(
  pathname: string,
  search: string,
  metricId: string | undefined,
): string {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  if (metricId) params.set("metric", metricId);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/entitlements/__tests__/buildAnonReturnTo.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/lib/entitlements/buildAnonReturnTo.ts packages/frontend/lib/entitlements/__tests__/buildAnonReturnTo.test.ts
git commit -m "feat(entitlements): add buildAnonReturnTo URL helper"
```

---

## Task 4: `AnonCaptureModal` component

The dismissible email-first capture modal. Email submit routes to the fixed signup with `email` + `redirect`; Google does OAuth directly (carrying `tos=1` + `next`, matching the signup page's existing OAuth encoding) with an inline Terms disclosure.

**Files:**

- Create: `packages/frontend/components/entitlements/AnonCaptureModal.tsx`
- Test: `packages/frontend/components/entitlements/__tests__/AnonCaptureModal.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/frontend/components/entitlements/__tests__/AnonCaptureModal.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const pushSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy }),
}));
vi.mock("@/lib/entitlements/api", () => ({ trackPaywallEvent: vi.fn() }));
const signInWithOAuth = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithOAuth } }),
}));

import { AnonCaptureModal } from "../AnonCaptureModal";

describe("AnonCaptureModal", () => {
  beforeEach(() => {
    pushSpy.mockClear();
    signInWithOAuth.mockClear();
  });

  it("shows the feature name in the heading", () => {
    render(
      <AnonCaptureModal
        featureName="Cap Rate"
        returnTo="/map?metric=cap_rate"
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText(/Cap Rate/)).toBeTruthy();
  });

  it("routes email submit to signup with email + redirect params", () => {
    render(
      <AnonCaptureModal
        featureName="Cap Rate"
        returnTo="/map?metric=cap_rate"
        onDismiss={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "lead@test.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(pushSpy).toHaveBeenCalledWith(
      "/auth/sign-up?email=lead%40test.com&redirect=%2Fmap%3Fmetric%3Dcap_rate",
    );
  });

  it("dismisses on X button click", () => {
    const onDismiss = vi.fn();
    render(
      <AnonCaptureModal
        featureName="Cap Rate"
        returnTo="/map"
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses on Escape", () => {
    const onDismiss = vi.fn();
    render(
      <AnonCaptureModal
        featureName="Cap Rate"
        returnTo="/map"
        onDismiss={onDismiss}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("starts Google OAuth with a callback carrying tos=1 and next", () => {
    render(
      <AnonCaptureModal
        featureName="Cap Rate"
        returnTo="/map?metric=cap_rate"
        onDismiss={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /google/i }));
    expect(signInWithOAuth).toHaveBeenCalledTimes(1);
    const arg = signInWithOAuth.mock.calls[0][0];
    expect(arg.provider).toBe("google");
    expect(arg.options.redirectTo).toContain("tos=1");
    expect(arg.options.redirectTo).toContain(
      "next=" + encodeURIComponent("/map?metric=cap_rate"),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/entitlements/__tests__/AnonCaptureModal.test.tsx`
Expected: FAIL — `Cannot find module '../AnonCaptureModal'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// packages/frontend/components/entitlements/AnonCaptureModal.tsx
"use client";

import React, { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { X, Sparkles } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { trackPaywallEvent } from "@/lib/entitlements/api";
import { useDismissable } from "@/lib/entitlements/useDismissable";

interface AnonCaptureModalProps {
  /** Human-readable name of the feature the user tried to unlock. */
  featureName: string;
  /** URL to return to after signup (already encodes desired map state). */
  returnTo: string;
  onDismiss: () => void;
}

/**
 * Dismissible, email-first capture shown when an anonymous user clicks a
 * locked premium feature. Email routes to the canonical signup with the email
 * prefilled and a redirect back to `returnTo`; Google runs OAuth directly,
 * carrying `tos=1` + `next` exactly like the signup page. The new account
 * receives a 14-day Pro trial at signup (see complete-signup / auth callback),
 * which unlocks the clicked feature on return.
 */
export function AnonCaptureModal({
  featureName,
  returnTo,
  onDismiss,
}: AnonCaptureModalProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const { onScrimClick } = useDismissable({ onDismiss, cardRef });

  useEffect(() => {
    trackPaywallEvent(
      "feature",
      "anon-capture",
      "view",
      window.location.pathname,
    );
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleEmailSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;
    trackPaywallEvent(
      "feature",
      "anon-capture",
      "click_upgrade",
      window.location.pathname,
    );
    const url = `/auth/sign-up?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(returnTo)}`;
    router.push(url);
  };

  const handleGoogle = async () => {
    trackPaywallEvent(
      "feature",
      "anon-capture",
      "click_upgrade",
      window.location.pathname,
    );
    const supabase = createSupabaseBrowserClient();
    const callbackUrl = `${window.location.origin}/auth/callback?tos=1&next=${encodeURIComponent(returnTo)}`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-400"
      onClick={onScrimClick}
    >
      <div
        ref={cardRef}
        className="relative mx-4 w-full max-w-md rounded-[28px] bg-surface-container-high p-8 shadow-lg animate-in zoom-in-95 duration-400"
        role="dialog"
        aria-modal="true"
        aria-labelledby="anon-capture-heading"
      >
        <button
          onClick={onDismiss}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>

        <h2
          id="anon-capture-heading"
          className="mb-2 text-center text-xl font-semibold tracking-tight text-on-surface"
        >
          Unlock {featureName} — free for 14 days
        </h2>
        <p className="mb-6 text-center text-sm text-on-surface-variant">
          Create a free account and your first 14 days of Pro are on us. No card
          required.
        </p>

        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-4 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="submit"
            className="flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-on-primary shadow-md shadow-primary/20 transition-colors hover:bg-primary/90"
          >
            Continue
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-outline-variant" />
          <span className="text-xs text-on-surface-variant">or</span>
          <div className="h-px flex-1 bg-outline-variant" />
        </div>

        <button
          onClick={handleGoogle}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-6 py-3 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-highest"
        >
          Continue with Google
        </button>

        <p className="mt-4 text-center text-xs text-on-surface-variant">
          By continuing you agree to our{" "}
          <a
            href="/about/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            Terms of Service
          </a>
          .
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/entitlements/__tests__/AnonCaptureModal.test.tsx`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/components/entitlements/AnonCaptureModal.tsx packages/frontend/components/entitlements/__tests__/AnonCaptureModal.test.tsx
git commit -m "feat(entitlements): add dismissible AnonCaptureModal (email + Google)"
```

---

## Task 5: Retire the front-door wall

Remove the anon hard-block from `PaywallProvider`, delete `AnonPaywallOverlay`, and drop the now-dead anon view-threshold path from `usePaywallPageTracking` (keep `isOnProductPage`, still used by the free-user nag).

**Files:**

- Modify: `packages/frontend/lib/entitlements/PaywallProvider.tsx`
- Delete: `packages/frontend/components/entitlements/AnonPaywallOverlay.tsx`
- Modify: `packages/frontend/lib/entitlements/usePaywallPageTracking.ts`

- [ ] **Step 1: Edit `PaywallProvider.tsx`**

Remove the `AnonPaywallOverlay` import (line 17). Change the tracking hook usage (line 29) from:

```ts
const { isOverThreshold, isOnProductPage } = usePaywallPageTracking();
```

to:

```ts
const { isOnProductPage } = usePaywallPageTracking();
```

Delete the anon-block computation (lines 45-46):

```ts
// Anon hard block: show when over threshold and on a product page
const showAnonBlock = isAnon && isOverThreshold && isOnProductPage;
```

Update the render block (lines 87-95) to drop the overlay and the `!showAnonBlock` guard:

```tsx
return (
  <>
    {children}
    {nagVisible && <FreeUserUpgradeModal onDismiss={handleDismissNag} />}
  </>
);
```

`isAnon` is still referenced for nothing else now — verify with the next step and remove it if unused. (It is only used by `showAnonBlock`; remove the `isAnon` const on line 38 and the now-unused `effectiveUser`/`simulatedAuth` only if nothing else uses them. `isFree`/`isPaid` still use `isAnon` — keep `isAnon`.)

- [ ] **Step 2: Delete the overlay component**

```bash
git rm packages/frontend/components/entitlements/AnonPaywallOverlay.tsx
```

- [ ] **Step 3: Simplify `usePaywallPageTracking.ts`**

Open the file. Remove `VIEW_THRESHOLD`, the view-counting `Set`/sessionStorage logic, `isOverThreshold`, `viewCount`, and `resetViews` — anything that exists solely to drive the deleted wall. Keep `isOnProductPage` (computed from `PRODUCT_PREFIXES`/`EXEMPT_PATHS` against the current pathname), which the free-user nag still needs. The hook's return type should become `{ isOnProductPage: boolean }`. If `PRODUCT_PREFIXES`/`EXEMPT_PATHS` are still needed only for `isOnProductPage`, keep them.

- [ ] **Step 4: Verify nothing else imports the removed symbols**

Run (from `packages/frontend/`):

```bash
npx grep -rn "AnonPaywallOverlay\|isOverThreshold\|resetViews" app lib components || echo "no stray references"
```

Expected: `no stray references` (or only matches inside test files you will update/remove). If `resetViews` is referenced elsewhere, leave it intact and only remove `isOverThreshold`.

- [ ] **Step 5: Typecheck via build of the touched modules**

Run: `npx eslint lib/entitlements/PaywallProvider.tsx lib/entitlements/usePaywallPageTracking.ts`
Expected: no errors (no unused vars).

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/lib/entitlements/PaywallProvider.tsx packages/frontend/lib/entitlements/usePaywallPageTracking.ts
git commit -m "feat(paywall): retire non-dismissible anon front-door wall"
```

---

## Task 6: Backfill Escape into `FreeUserUpgradeModal`

Reuse `useDismissable` so the free-user nag also closes on Escape (it currently only has X + backdrop).

**Files:**

- Modify: `packages/frontend/components/entitlements/FreeUserUpgradeModal.tsx`

- [ ] **Step 1: Replace the local scrim handler with the shared hook**

Add the import:

```ts
import { useDismissable } from "@/lib/entitlements/useDismissable";
```

Replace the existing `handleScrimClick` (lines 45-53) with:

```ts
const { onScrimClick } = useDismissable({ onDismiss, cardRef });
```

Then change the scrim `onClick` (line 70) from `onClick={handleScrimClick}` to `onClick={onScrimClick}`. Keep the dismiss tracking by wrapping `onDismiss` at the call site is unnecessary — leave the existing X-button tracking as-is. (The Escape/backdrop dismiss now fires `onDismiss`; if you want the `dismiss` analytics event on those too, pass a wrapped callback that calls `trackPaywallEvent(...'dismiss'...)` then `onDismiss()` into `useDismissable`.)

- [ ] **Step 2: Manual verification**

Run: `npx eslint components/entitlements/FreeUserUpgradeModal.tsx`
Expected: no errors (no unused `handleScrimClick`/`useCallback` left behind — remove now-unused imports).

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/components/entitlements/FreeUserUpgradeModal.tsx
git commit -m "feat(paywall): add Escape dismiss to FreeUserUpgradeModal via useDismissable"
```

---

## Task 7: Wire `MetricItem` anon clicks to `AnonCaptureModal`

Anon users clicking a locked metric get the capture modal; free authed users keep the existing `PaywallCard` (upgrade-to-Pro).

**Files:**

- Modify: `packages/frontend/app/map/components/sidebar-components/MetricItem.tsx`

- [ ] **Step 1: Add imports and anon detection**

Add to imports:

```ts
import { useIsAnonymous } from "@/lib/entitlements/useIsAnonymous";
import { buildAnonReturnTo } from "@/lib/entitlements/buildAnonReturnTo";
import { AnonCaptureModal } from "@/components/entitlements/AnonCaptureModal";
```

Inside the component (after `const isLocked = isMetricGated(metric.id);`):

```ts
const isAnonymous = useIsAnonymous();
```

- [ ] **Step 2: Render the capture modal for anon instead of the PaywallCard portal**

The existing `showPaywall` portal (lines 93-111) renders `PaywallCard`. Replace the portal block so that when `isAnonymous` is true it renders `AnonCaptureModal`, otherwise the existing `PaywallCard`:

```tsx
{
  /* Locked-metric modal: capture for anon, upgrade card for free users */
}
{
  showPaywall &&
    typeof document !== "undefined" &&
    (isAnonymous
      ? createPortal(
          <AnonCaptureModal
            featureName={metric.name}
            returnTo={buildAnonReturnTo(
              window.location.pathname,
              window.location.search,
              metric.id,
            )}
            onDismiss={() => setShowPaywall(false)}
          />,
          document.body,
        )
      : createPortal(
          <div
            data-testid={`paywall-overlay-${metric.id}`}
            className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40"
            onClick={() => setShowPaywall(false)}
          >
            <div className="max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
              <PaywallCard
                type="metric"
                id={metric.id}
                title={`Unlock ${metric.name}`}
              />
            </div>
          </div>,
          document.body,
        ));
}
```

(The locked button's `onClick={isLocked ? () => setShowPaywall(true) : onSelect}` is unchanged — it already opens the modal for both anon and free; only what renders changes.)

- [ ] **Step 3: Lint**

Run: `npx eslint app/map/components/sidebar-components/MetricItem.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/map/components/sidebar-components/MetricItem.tsx
git commit -m "feat(map): anon locked-metric click opens capture modal, not pricing"
```

---

## Task 8: Wire `QuickActions` anon clicks to `AnonCaptureModal`

The detail-panel Favorite/Report locks open the capture modal for anon (today they open a `PaywallCard` portal). Confirm there is no double-modal: `QuickActions` owns its own `showPaywall` state, so it is the single source.

**Files:**

- Modify: `packages/frontend/app/map/components/RightDetailPanel/QuickActions.tsx`

- [ ] **Step 1: Add imports + anon detection**

Add imports:

```ts
import { useIsAnonymous } from "@/lib/entitlements/useIsAnonymous";
import { buildAnonReturnTo } from "@/lib/entitlements/buildAnonReturnTo";
import { AnonCaptureModal } from "@/components/entitlements/AnonCaptureModal";
```

Inside the component:

```ts
const isAnonymous = useIsAnonymous();
```

- [ ] **Step 2: Branch the existing `showPaywall` portal (lines 162-182)**

Replace it with:

```tsx
{
  showPaywall &&
    typeof document !== "undefined" &&
    (isAnonymous
      ? createPortal(
          <AnonCaptureModal
            featureName={showPaywall === "watchlist" ? "Favorites" : "Reports"}
            returnTo={buildAnonReturnTo(
              window.location.pathname,
              window.location.search,
              undefined,
            )}
            onDismiss={() => setShowPaywall(null)}
          />,
          document.body,
        )
      : createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40"
            onClick={() => setShowPaywall(null)}
          >
            <div className="max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
              <PaywallCard
                type="feature"
                id={showPaywall === "watchlist" ? "watchlist_limit" : "reports"}
                title={
                  showPaywall === "watchlist"
                    ? "Unlock Favorites"
                    : "Unlock Reports"
                }
              />
            </div>
          </div>,
          document.body,
        ));
}
```

- [ ] **Step 3: Lint**

Run: `npx eslint app/map/components/RightDetailPanel/QuickActions.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/map/components/RightDetailPanel/QuickActions.tsx
git commit -m "feat(map): anon QuickActions locks open capture modal"
```

---

## Task 9: Fix `PaywallCard` anon CTA destination

Anywhere a `PaywallCard` renders for an anonymous user (other surfaces beyond the map), its CTA should route into signup, not `/pricing`.

**Files:**

- Modify: `packages/frontend/components/entitlements/PaywallCard.tsx`

- [ ] **Step 1: Compute the anon-aware href**

The component already tracks `isAuthenticated`. Change the CTA `<Link>` href (line 80) so unauthenticated users go to signup with a redirect back, while authenticated users keep the pricing link:

```tsx
<Link
  data-testid="paywall-cta"
  href={
    isAuthenticated
      ? `/pricing?from=${encodeURIComponent(pathname)}`
      : `/auth/sign-up?redirect=${encodeURIComponent(pathname)}`
  }
  onClick={handleUpgradeClick}
  className="
          inline-flex items-center gap-2 px-6 py-2.5
          bg-primary text-on-primary rounded-full
          font-medium text-sm
          hover:bg-primary/90 transition-colors
        "
>
  {isAuthenticated ? PRICING_CTA_COPY[variant] : "Sign Up Free"}
</Link>
```

- [ ] **Step 2: Lint**

Run: `npx eslint components/entitlements/PaywallCard.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/components/entitlements/PaywallCard.tsx
git commit -m "fix(paywall): route anonymous PaywallCard CTA to signup, not pricing"
```

---

## Task 10: `?email=` prefill on the signup page

So the captured email carries through and the user doesn't retype it.

**Files:**

- Modify: `packages/frontend/app/auth/sign-up/page.tsx`

- [ ] **Step 1: Initialize email state from the query param**

The component reads `searchParams` already. Change the email state initializer (line 40) from:

```ts
const [email, setEmail] = useState("");
```

to:

```ts
const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
```

The existing sessionStorage OTP-restore effect (lines 59-76) still overrides this on refresh of the OTP screen, which is correct.

- [ ] **Step 2: Lint**

Run: `npx eslint app/auth/sign-up/page.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/auth/sign-up/page.tsx
git commit -m "feat(signup): prefill email from ?email= query param"
```

---

## Task 11: Grant the reverse Pro trial in `completeSignup` (email funnel)

**Files:**

- Modify: `packages/frontend/app/auth/sign-up/complete-signup.ts`

- [ ] **Step 1: Import the trial fetcher**

Add to imports:

```ts
import { startOnboardingTrial } from "@/lib/data";
```

- [ ] **Step 2: Fire the (idempotent, best-effort) trial grant before returning**

Immediately before the `// Honor a pending purchase intent` block (line 59), add:

```ts
// Grant the reverse Pro trial at signup so the anon-capture promise
// ("14 days of Pro") is honest regardless of whether the user finishes the
// tour. ensureTrialStarted is idempotent; best-effort — never block signup.
void startOnboardingTrial().catch(() => {});
```

- [ ] **Step 3: Lint**

Run: `npx eslint app/auth/sign-up/complete-signup.ts`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/auth/sign-up/complete-signup.ts
git commit -m "feat(signup): grant reverse Pro trial on email signup (decouple from tour)"
```

---

## Task 12: Grant the reverse Pro trial in the OAuth callback

**Files:**

- Modify: `packages/frontend/app/auth/callback/page.tsx`

- [ ] **Step 1: Import the trial fetcher**

Add to the top imports:

```ts
import { startOnboardingTrial } from "@/lib/data";
```

- [ ] **Step 2: Fire the trial grant inside `handlePostSignup`**

In `handlePostSignup` (after the ToS upsert, near line 268, before/after the welcome-email fire-and-forget), add:

```ts
// Reverse Pro trial for OAuth / email-confirm signups (idempotent, best-effort).
void startOnboardingTrial().catch(() => {});
```

- [ ] **Step 3: Lint**

Run: `npx eslint app/auth/callback/page.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/auth/callback/page.tsx
git commit -m "feat(auth): grant reverse Pro trial on OAuth/email-confirm signup"
```

---

## Task 13: E2E — anonymous capture flow (live, no mocks)

**Files:**

- Create: `packages/frontend/tests/e2e/anon-capture.spec.ts`

**Prerequisites:** frontend dev server on :3000, backend on :3001, real DB. Do NOT use `?tier=` (it sets simulatedAuth and hides anon UI).

- [ ] **Step 1: Write the E2E spec**

```ts
// packages/frontend/tests/e2e/anon-capture.spec.ts
import { test, expect } from "@playwright/test";

// Force a clean, logged-out context — the global setup auth must not leak in.
test.use({ storageState: { cookies: [], origins: [] } });
test.setTimeout(60_000);

test.describe("Anonymous two-step capture", () => {
  test("anon can browse many product pages with no undismissable wall", async ({
    page,
  }) => {
    const paths = [
      "/map",
      "/scores",
      "/map?level=metro",
      "/graphs",
      "/scores",
      "/map",
    ];
    for (const p of paths) {
      await page.goto(p);
      await page.waitForLoadState("domcontentloaded");
    }
    // The retired wall used this heading; it must never appear.
    await expect(
      page.getByRole("heading", {
        name: /Create your free account to continue/i,
      }),
    ).toHaveCount(0);
  });

  test("clicking a locked metric opens a dismissible capture modal", async ({
    page,
  }) => {
    await page.goto("/map");
    // Cap rate is Pro-gated → locked for anon. Open its modal.
    const locked = page.getByTestId("metric-button-cap_rate");
    await locked.click();
    const heading = page.getByRole("heading", { name: /Unlock Cap Rate/i });
    await expect(heading).toBeVisible();

    // Escape closes it.
    await page.keyboard.press("Escape");
    await expect(heading).toHaveCount(0);

    // Reopen → X closes it.
    await locked.click();
    await page.getByLabel("Close").click();
    await expect(
      page.getByRole("heading", { name: /Unlock Cap Rate/i }),
    ).toHaveCount(0);

    // Reopen → backdrop click closes it.
    await locked.click();
    await page.mouse.click(5, 5);
    await expect(
      page.getByRole("heading", { name: /Unlock Cap Rate/i }),
    ).toHaveCount(0);
  });

  test("email submit lands on signup with email prefilled + redirect", async ({
    page,
  }) => {
    await page.goto("/map");
    await page.getByTestId("metric-button-cap_rate").click();
    await page.getByPlaceholder("you@example.com").fill("e2e-lead@example.com");
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForURL(/\/auth\/sign-up/);
    expect(page.url()).toContain("redirect=");
    await expect(page.locator("#email")).toHaveValue("e2e-lead@example.com");
  });
});
```

> Note: if the gated metric id `cap_rate` is not rendered in the default Popular category, open the category containing it first, or switch to a metric that is gated for anon and present in the default sidebar (consult `entitlements-gating.spec.ts` for the live gated set). Adjust the testid accordingly — keep the assertion on a genuinely Pro-gated metric.

- [ ] **Step 2: Run the E2E spec**

Run: `npm run test:e2e -- tests/e2e/anon-capture.spec.ts`
Expected: 3 passed. If the metric testid isn't found, fix per the note above and re-run.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/tests/e2e/anon-capture.spec.ts
git commit -m "test(e2e): anonymous two-step capture flow (no wall, dismissible modal, prefill)"
```

---

## Task 14: Full verification + trial-grant proof

- [ ] **Step 1: Run the full unit/component suite for touched areas**

Run:

```bash
npx vitest run lib/entitlements components/entitlements
```

Expected: all pass (includes the 4 new test files).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build completes with no type errors. (Catches any missed `isOverThreshold`/`AnonPaywallOverlay` references and the new imports.)

- [ ] **Step 3: Prove the trial is actually granted on signup (live DB)**

Complete a real signup end-to-end in a browser against the dev servers (email OTP path), using a unique throwaway email. Then verify a trial row exists. Using the Supabase MCP (project `pysflbhpnqwoczyuaaif`):

```sql
select user_id, tier, expires_at, created_at
from user_trials
order by created_at desc
limit 5;
```

Expected: a row for the just-created user with `tier = 'pro'` and `expires_at` ~14 days out. Confirm the clicked gated metric (e.g. cap rate) renders for that user on `/map` after returning (Pro trial active).

- [ ] **Step 4: Crawlability regression check**

Run (no JS): `curl -s http://localhost:3000/markets/austin-tx | head -c 2000` (use a real metro slug from the live route). Expected: full server-rendered market content present (the removal did not affect SEO pages, which never had the wall).

- [ ] **Step 5: Final commit (if any verification fixups were needed)**

```bash
git add -A
git commit -m "chore(paywall): verification fixups for anon capture flow"
```

---

## Self-Review Notes (coverage vs spec)

- §5.0 trial grant → Tasks 11, 12, 14.3
- §5.1 retire wall → Task 5
- §5.2 AnonCaptureModal → Task 4
- §5.3 route anon clicks (MetricItem / QuickActions / PaywallCard) → Tasks 7, 8, 9
- §5.4 returnTo builder → Task 3 (decision: preserve full map query string + force metric)
- §5.5 email prefill + useDismissable → Tasks 10, 2, 6
- §7 testing → Tasks 13, 14
- Non-goals (#19 redaction, #14 tour, SEO capture blocks) → intentionally untouched; crawl regression covered in 14.4.
