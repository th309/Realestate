# Site-Level Paywall System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a site-level paywall that hard-blocks anonymous users after 5 product-page views and nags free authenticated users every 5 minutes with an upgrade modal.

**Architecture:** A `PaywallProvider` context mounts in `app/providers.tsx` inside `EntitlementsProvider`. It tracks page views in sessionStorage, manages a 5-minute timer for free users, and portal-renders two overlay components. No backend changes needed — uses existing Stripe checkout and entitlements infrastructure.

**Tech Stack:** React 19, Next.js 16 (App Router), Tailwind CSS 4, M3 design system, existing `useAuth`/`useEntitlements` hooks, `startCheckout` billing fetcher.

**Design Doc:** `docs/plans/2026-02-22-site-level-paywall-design.md`

---

### Task 1: Clean Up Conflicting Paywall Systems

Remove three dead/disabled paywall mechanisms that would conflict with the new system.

**Files:**
- Delete: `packages/frontend/app/components/SignUpWall.tsx`
- Delete: `packages/frontend/components/entitlements/SignupPromptBanner.tsx`
- Delete: `packages/frontend/lib/entitlements/anonymousViews.ts`
- Modify: `packages/frontend/components/entitlements/index.ts:10` (remove SignupPromptBanner export)
- Modify: `packages/frontend/app/layout.tsx:7,137` (remove commented-out SignUpWall lines)

**Step 1: Delete the three dead files**

```bash
rm packages/frontend/app/components/SignUpWall.tsx
rm packages/frontend/components/entitlements/SignupPromptBanner.tsx
rm packages/frontend/lib/entitlements/anonymousViews.ts
```

**Step 2: Remove SignupPromptBanner export from barrel**

In `packages/frontend/components/entitlements/index.ts`, delete line 10:
```typescript
// DELETE this line:
export { SignupPromptBanner } from './SignupPromptBanner';
```

**Step 3: Remove commented-out SignUpWall from layout**

In `packages/frontend/app/layout.tsx`:
- Delete line 7: `// import { SignUpWall } from "@/app/components/SignUpWall"; // PAUSED: re-enable after beta`
- Delete line 137: `{/* <SignUpWall /> */} {/* PAUSED: re-enable after beta */}`

**Step 4: Verify no remaining imports reference deleted files**

```bash
cd packages/frontend && grep -r "SignUpWall\|SignupPromptBanner\|anonymousViews" --include="*.ts" --include="*.tsx" app/ lib/ components/ | grep -v node_modules
```

Expected: No results (or only this plan file).

**Step 5: Verify frontend compiles**

```bash
cd packages/frontend && npx tsc --noEmit 2>&1 | grep -i "signup\|signupwall\|anonymousViews\|SignupPrompt"
```

Expected: No errors related to deleted files.

**Step 6: Commit**

```bash
git add -A && git commit -m "chore: remove dead paywall systems (SignUpWall, SignupPromptBanner, anonymousViews)"
```

---

### Task 2: Create Page-View Tracking Hook

A small hook that tracks unique product-page URL visits in sessionStorage.

**Files:**
- Create: `packages/frontend/lib/entitlements/usePaywallPageTracking.ts`

**Step 1: Implement the hook**

```typescript
/**
 * Tracks unique product-page visits in sessionStorage for paywall gating.
 *
 * Only counts paths under PRODUCT_PREFIXES.
 * Excludes EXEMPT_PATHS (sample report, shared reports).
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';

const STORAGE_KEY = 'piq-paywall-views';
const VIEW_THRESHOLD = 5;

const PRODUCT_PREFIXES = ['/maps', '/graphs', '/markets', '/scores', '/reports'];
const EXEMPT_PATHS = ['/reports/sample', '/reports/shared'];

function isProductPage(pathname: string): boolean {
  if (EXEMPT_PATHS.some((p) => pathname.startsWith(p))) return false;
  return PRODUCT_PREFIXES.some((p) => pathname.startsWith(p));
}

function getStoredViews(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function storeViews(views: Set<string>): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...views]));
  } catch {
    // sessionStorage unavailable — degrade gracefully
  }
}

export function usePaywallPageTracking() {
  const pathname = usePathname();
  const [viewCount, setViewCount] = useState(0);

  // Sync initial count from sessionStorage on mount
  useEffect(() => {
    setViewCount(getStoredViews().size);
  }, []);

  // Record new page views
  useEffect(() => {
    if (!pathname || !isProductPage(pathname)) return;

    const views = getStoredViews();
    if (!views.has(pathname)) {
      views.add(pathname);
      storeViews(views);
      setViewCount(views.size);
    }
  }, [pathname]);

  const isOverThreshold = viewCount >= VIEW_THRESHOLD;
  const isOnProductPage = !!pathname && isProductPage(pathname);

  const resetViews = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setViewCount(0);
  }, []);

  return { viewCount, isOverThreshold, isOnProductPage, resetViews };
}
```

**Step 2: Export from entitlements barrel**

In `packages/frontend/lib/entitlements/index.ts`, add:
```typescript
export { usePaywallPageTracking } from './usePaywallPageTracking';
```

**Step 3: Commit**

```bash
git add packages/frontend/lib/entitlements/usePaywallPageTracking.ts packages/frontend/lib/entitlements/index.ts
git commit -m "feat: add usePaywallPageTracking hook for site-level paywall"
```

---

### Task 3: Create AnonPaywallOverlay Component

Full-screen, non-dismissible overlay for anonymous users.

**Files:**
- Create: `packages/frontend/components/entitlements/AnonPaywallOverlay.tsx`

**Step 1: Implement the component**

```typescript
/**
 * AnonPaywallOverlay
 *
 * Full-screen non-dismissible overlay shown to anonymous users
 * after they've visited 5+ product pages. Prompts account creation.
 *
 * M3 design: Extra Large dialog (rounded-[28px]), Surface Container High,
 * Level 3 elevation. No dismiss mechanism.
 */

'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { MapPin, BarChart3, Sparkles } from 'lucide-react';
import { trackPaywallEvent } from '@/lib/entitlements/api';

const VALUE_PROPS = [
  { icon: MapPin, text: 'Explore every market nationwide' },
  { icon: BarChart3, text: 'Interactive data and analytics tools' },
  { icon: Sparkles, text: 'AI-powered market insights' },
] as const;

export function AnonPaywallOverlay() {
  useEffect(() => {
    trackPaywallEvent('feature', 'site-paywall-anon', 'view', window.location.pathname);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="relative mx-4 w-full max-w-md rounded-[28px] bg-surface-container-high p-8 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="anon-paywall-heading"
      >
        {/* Logo */}
        <div className="mb-6 text-center">
          <span className="text-xl font-bold tracking-tight text-on-surface">
            Property<span className="text-primary">IQ</span>
          </span>
        </div>

        {/* Heading */}
        <h2
          id="anon-paywall-heading"
          className="mb-2 text-center text-2xl font-semibold tracking-tight text-on-surface"
        >
          Create your free account to continue
        </h2>
        <p className="mb-8 text-center text-sm text-on-surface-variant">
          You&apos;ve explored 5 pages &mdash; sign up in seconds to keep going
        </p>

        {/* Value props */}
        <ul className="mb-8 space-y-3">
          {VALUE_PROPS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-on-surface">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              {text}
            </li>
          ))}
        </ul>

        {/* Primary CTA */}
        <Link
          href="/auth/sign-up"
          onClick={() =>
            trackPaywallEvent('feature', 'site-paywall-anon', 'click_upgrade', window.location.pathname)
          }
          className="flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-on-primary shadow-md shadow-primary/20 transition-colors hover:bg-primary/90"
        >
          Sign Up Free
        </Link>

        {/* Secondary */}
        <p className="mt-4 text-center text-sm text-on-surface-variant">
          Already have an account?{' '}
          <Link href="/auth/sign-in" className="font-medium text-primary hover:text-primary/80">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Export from barrel**

In `packages/frontend/components/entitlements/index.ts`, add:
```typescript
export { AnonPaywallOverlay } from './AnonPaywallOverlay';
```

**Step 3: Commit**

```bash
git add packages/frontend/components/entitlements/AnonPaywallOverlay.tsx packages/frontend/components/entitlements/index.ts
git commit -m "feat: add AnonPaywallOverlay component for anonymous user hard block"
```

---

### Task 4: Create FreeUserUpgradeModal Component

Dismissible upgrade modal for free authenticated users.

**Files:**
- Create: `packages/frontend/components/entitlements/FreeUserUpgradeModal.tsx`

**Step 1: Implement the component**

```typescript
/**
 * FreeUserUpgradeModal
 *
 * Dismissible modal shown to free authenticated users every 5 minutes.
 * Shows feature comparison (Free vs Pro) and CTA to Stripe checkout.
 *
 * M3 design: Extra Large dialog, Surface Container High, Level 3.
 * Dismissible via X button or clicking outside.
 */

'use client';

import React, { useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { X, Lock, Check, Minus } from 'lucide-react';
import { startCheckout } from '@/lib/data/fetchers/billing';
import { trackPaywallEvent } from '@/lib/entitlements/api';

interface FreeUserUpgradeModalProps {
  onDismiss: () => void;
}

const COMPARISON_ROWS = [
  { feature: 'Market access', free: '5 markets', pro: 'Unlimited' },
  { feature: 'Data metrics', free: 'Basic set', pro: 'All 40+ metrics' },
  { feature: 'AI reports', free: false, pro: true },
  { feature: 'Score breakdowns', free: false, pro: true },
  { feature: 'Data export', free: false, pro: true },
] as const;

export function FreeUserUpgradeModal({ onDismiss }: FreeUserUpgradeModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackPaywallEvent('feature', 'site-paywall-free', 'view', window.location.pathname);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleScrimClick = useCallback(
    (e: React.MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        trackPaywallEvent('feature', 'site-paywall-free', 'dismiss', window.location.pathname);
        onDismiss();
      }
    },
    [onDismiss],
  );

  const handleUpgradeClick = useCallback(async () => {
    trackPaywallEvent('feature', 'site-paywall-free', 'click_upgrade', window.location.pathname);
    try {
      const checkoutUrl = await startCheckout('pro', 'month', window.location.pathname);
      window.location.href = checkoutUrl;
    } catch {
      // Fallback: send to pricing page
      window.location.href = '/pricing';
    }
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-400"
      onClick={handleScrimClick}
    >
      <div
        ref={cardRef}
        className="relative mx-4 w-full max-w-md rounded-[28px] bg-surface-container-high p-8 shadow-lg animate-in zoom-in-95 duration-400"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-heading"
      >
        {/* Close button */}
        <button
          onClick={() => {
            trackPaywallEvent('feature', 'site-paywall-free', 'dismiss', window.location.pathname);
            onDismiss();
          }}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon */}
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>

        {/* Heading */}
        <h2
          id="upgrade-modal-heading"
          className="mb-2 text-center text-xl font-semibold tracking-tight text-on-surface"
        >
          Unlock the full PropertyIQ experience
        </h2>
        <p className="mb-6 text-center text-sm text-on-surface-variant">
          Get unlimited access to every market, metric, and AI-powered tool.
        </p>

        {/* Feature comparison */}
        <div className="mb-6 overflow-hidden rounded-xl border border-outline-variant">
          {/* Header row */}
          <div className="grid grid-cols-3 border-b border-outline-variant bg-surface-container-low px-4 py-2.5">
            <span className="text-xs font-medium uppercase tracking-wide text-on-surface-variant">
              Feature
            </span>
            <span className="text-center text-xs font-medium uppercase tracking-wide text-on-surface-variant">
              Free
            </span>
            <span className="text-center text-xs font-medium uppercase tracking-wide text-primary">
              Pro
            </span>
          </div>
          {/* Rows */}
          {COMPARISON_ROWS.map(({ feature, free, pro }) => (
            <div
              key={feature}
              className="grid grid-cols-3 border-b border-outline-variant/50 px-4 py-2.5 last:border-0"
            >
              <span className="text-sm text-on-surface">{feature}</span>
              <span className="flex items-center justify-center text-sm text-on-surface-variant">
                {typeof free === 'string' ? (
                  free
                ) : free ? (
                  <Check className="h-4 w-4 text-on-surface-variant" />
                ) : (
                  <Minus className="h-4 w-4 text-outline" />
                )}
              </span>
              <span className="flex items-center justify-center text-sm font-medium text-primary">
                {typeof pro === 'string' ? (
                  pro
                ) : pro ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Minus className="h-4 w-4 text-outline" />
                )}
              </span>
            </div>
          ))}
        </div>

        {/* Primary CTA */}
        <button
          onClick={handleUpgradeClick}
          className="flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-on-primary shadow-md shadow-primary/20 transition-colors hover:bg-primary/90"
        >
          Upgrade to Pro
        </button>

        {/* Secondary */}
        <p className="mt-3 text-center text-sm text-on-surface-variant">
          <Link href="/pricing" className="font-medium text-primary hover:text-primary/80">
            View all plans
          </Link>
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Export from barrel**

In `packages/frontend/components/entitlements/index.ts`, add:
```typescript
export { FreeUserUpgradeModal } from './FreeUserUpgradeModal';
```

**Step 3: Commit**

```bash
git add packages/frontend/components/entitlements/FreeUserUpgradeModal.tsx packages/frontend/components/entitlements/index.ts
git commit -m "feat: add FreeUserUpgradeModal component for free user nag"
```

---

### Task 5: Create PaywallProvider

The central provider that ties page tracking, auth state, timer, and overlay rendering together.

**Files:**
- Create: `packages/frontend/lib/entitlements/PaywallProvider.tsx`

**Step 1: Implement the provider**

```typescript
/**
 * PaywallProvider
 *
 * Site-level paywall context. Wraps product pages and conditionally renders:
 * - AnonPaywallOverlay: hard block after 5 product-page views (anon users)
 * - FreeUserUpgradeModal: dismissible nag every 5 minutes (free auth users)
 *
 * Paid users (pro/enterprise/admin) and dev-simulated tiers are never affected.
 */

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useEntitlements } from '@/lib/entitlements/EntitlementsContext';
import { usePaywallPageTracking } from './usePaywallPageTracking';
import { AnonPaywallOverlay } from '@/components/entitlements/AnonPaywallOverlay';
import { FreeUserUpgradeModal } from '@/components/entitlements/FreeUserUpgradeModal';

const NAG_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface PaywallProviderProps {
  children: React.ReactNode;
}

export function PaywallProvider({ children }: PaywallProviderProps) {
  const { user } = useAuth();
  const { tier } = useEntitlements();
  const { isOverThreshold, isOnProductPage } = usePaywallPageTracking();

  const [nagVisible, setNagVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAnon = user === null;
  const isFree = !isAnon && tier === 'free';
  const isPaid = !isAnon && (tier === 'pro' || tier === 'enterprise' || tier === 'admin');

  // Anon hard block: show when over threshold and on a product page
  const showAnonBlock = isAnon && isOverThreshold && isOnProductPage;

  // Free user nag: 5-minute timer
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setNagVisible(true);
    }, NAG_INTERVAL_MS);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isFree && isOnProductPage) {
      startTimer();
    } else {
      stopTimer();
      setNagVisible(false);
    }
    return stopTimer;
  }, [isFree, isOnProductPage, startTimer, stopTimer]);

  // If user upgrades mid-session, clear everything
  useEffect(() => {
    if (isPaid) {
      stopTimer();
      setNagVisible(false);
    }
  }, [isPaid, stopTimer]);

  const handleDismissNag = useCallback(() => {
    setNagVisible(false);
    // Reset the timer so next nag is a full 5 minutes away
    startTimer();
  }, [startTimer]);

  return (
    <>
      {children}
      {showAnonBlock && <AnonPaywallOverlay />}
      {nagVisible && !showAnonBlock && <FreeUserUpgradeModal onDismiss={handleDismissNag} />}
    </>
  );
}
```

**Step 2: Export from entitlements barrel**

In `packages/frontend/lib/entitlements/index.ts`, add:
```typescript
export { PaywallProvider } from './PaywallProvider';
```

**Step 3: Commit**

```bash
git add packages/frontend/lib/entitlements/PaywallProvider.tsx packages/frontend/lib/entitlements/index.ts
git commit -m "feat: add PaywallProvider with anon block and free user nag timer"
```

---

### Task 6: Wire PaywallProvider Into App Layout

Mount the provider in the global providers so it wraps all pages.

**Files:**
- Modify: `packages/frontend/app/providers.tsx:6-7,42-44`

**Step 1: Add import and wrap children**

In `packages/frontend/app/providers.tsx`:

Add import after line 6:
```typescript
import { PaywallProvider } from '@/lib/entitlements';
```

Replace line 43 (`{children}`) with:
```typescript
<PaywallProvider>{children}</PaywallProvider>
```

Final nesting: `QueryClientProvider > AuthProvider > EntitlementsProvider > PaywallProvider > children`

**Step 2: Verify frontend compiles**

```bash
cd packages/frontend && npx tsc --noEmit 2>&1 | grep -i "paywall\|provider" | head -10
```

Expected: No errors.

**Step 3: Commit**

```bash
git add packages/frontend/app/providers.tsx
git commit -m "feat: wire PaywallProvider into app layout"
```

---

### Task 7: Manual Smoke Test

Verify the full system works locally.

**Step 1: Test anonymous hard block**

1. Open the app in an incognito window (no session)
2. Visit 5 different product pages: `/maps`, `/graphs`, `/markets`, `/scores`, `/reports/sample` (note: sample is exempt, so try `/reports`)
3. On the 5th product page, the `AnonPaywallOverlay` should appear
4. Verify: no X button, no way to dismiss
5. Verify: "Sign Up Free" links to `/auth/sign-up`
6. Verify: "Log in" links to `/auth/sign-in`
7. Verify: visiting `/pricing` or `/about-us` does NOT show the overlay

**Step 2: Test free user nag modal**

1. Log in as a free-tier user
2. Navigate to a product page
3. Wait 5 minutes (or temporarily change `NAG_INTERVAL_MS` to `10_000` for testing)
4. The `FreeUserUpgradeModal` should appear
5. Verify: X button and clicking outside both dismiss it
6. Verify: after dismissing, it reappears ~5 minutes later
7. Verify: "Upgrade to Pro" triggers Stripe checkout (or redirects to `/pricing` if Stripe not configured locally)

**Step 3: Test paid user sees nothing**

1. Use dev toolbar to simulate `?tier=pro`
2. Navigate product pages — no overlay should appear
3. Wait 5+ minutes — no modal should appear

**Step 4: Final commit (squash if needed)**

```bash
git add -A && git commit -m "feat: site-level paywall system — anon block + free user nag modal"
```

---

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `app/components/SignUpWall.tsx` | DELETE | Dead 340-line sign-up wall |
| `components/entitlements/SignupPromptBanner.tsx` | DELETE | Dead floating banner |
| `lib/entitlements/anonymousViews.ts` | DELETE | Dead storage engine |
| `components/entitlements/index.ts` | MODIFY | Remove dead export, add new exports |
| `app/layout.tsx` | MODIFY | Remove commented-out SignUpWall |
| `lib/entitlements/usePaywallPageTracking.ts` | CREATE | Page-view counting hook |
| `components/entitlements/AnonPaywallOverlay.tsx` | CREATE | Full-screen anon hard block |
| `components/entitlements/FreeUserUpgradeModal.tsx` | CREATE | Dismissible free user nag |
| `lib/entitlements/PaywallProvider.tsx` | CREATE | Central provider with timer + state |
| `lib/entitlements/index.ts` | MODIFY | Export new hook + provider |
| `app/providers.tsx` | MODIFY | Mount PaywallProvider |
