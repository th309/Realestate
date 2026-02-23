# Site-Level Paywall System Design

**Date:** 2026-02-22
**Status:** Approved

## Problem

PropertyIQ has no site-level conversion mechanism. Anonymous users can browse indefinitely. Free authenticated users are never prompted to upgrade. Three previous attempts at this exist in the codebase (`SignUpWall`, `SignupPromptBanner`, `anonymousViews.ts`) but none are active — they conflict with each other and were disabled.

## Requirements

1. **Anonymous users** — after 5 unique product-page URL navigations, show a full-screen non-dismissible overlay requiring account creation
2. **Free authenticated users** — every 5 minutes on product pages, show a dismissible upgrade modal with feature comparison and Stripe checkout CTA
3. **Scope** — only on product pages: `/maps`, `/graphs`, `/markets`, `/scores`, `/reports` (excluding `/reports/sample` and `/reports/shared/*`)
4. **Exempt pages** — `/`, `/pricing`, `/about-us`, `/auth/*` are never affected
5. **Paid/admin users** — never see any overlay

## Architecture: Layout-Level PaywallProvider

A single `<PaywallProvider>` context wraps the product pages layout. It owns all state and renders overlays. Individual pages are completely unaware of the paywall.

### State

| State | Storage | Description |
|-------|---------|-------------|
| `pageViews` | `sessionStorage` (`piq-paywall-views`) | Set of unique product-page URLs visited this session |
| `isBlocked` | Derived | `user === null && pageViews.size >= 5` |
| `nagVisible` | React state | `tier === 'free' && 5-min timer fired` |

### Location

- New file: `packages/frontend/lib/entitlements/PaywallProvider.tsx`
- Mounted in `app/providers.tsx` inside `EntitlementsProvider`
- Uses `useAuth()` for auth state, `useEntitlements()` for tier, `usePathname()` for route tracking

### Page-View Counting

- On each route change via `usePathname()`, record the pathname in a `Set` stored in sessionStorage
- Only count paths starting with `/maps`, `/graphs`, `/markets`, `/scores`, `/reports`
- Exclude `/reports/sample` and `/reports/shared`

### Timer (Free Users)

- `setInterval` of 5 minutes, starts on mount when tier is `free`
- Resets when user dismisses
- Clears on unmount or if user upgrades mid-session

## UI Components

### Overlay A: `AnonPaywallOverlay` (Non-Dismissible)

Full-screen overlay for anonymous users after 5 page views.

- **Scrim:** `fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm`
- **Card:** Centered, `max-w-md`, `rounded-[28px]`, `bg-surface-container-high`, `shadow-lg`
- **Content:**
  1. PropertyIQ logo mark
  2. Headline: "Create your free account to continue"
  3. Subtext: "You've explored 5 pages — sign up in seconds to keep going"
  4. Three value prop bullets with Material Symbols icons
  5. Primary CTA: "Sign Up Free" -> `/auth/sign-up`
  6. Secondary: "Already have an account? Log in" -> `/auth/sign-in`
- **No dismiss button.** No pricing. Goal is account creation.

### Overlay B: `FreeUserUpgradeModal` (Dismissible)

Upgrade modal for free authenticated users, every 5 minutes.

- **Scrim:** Same as above
- **Card:** Same styling but with X close button (top-right)
- **Animation:** `duration-400` M3 fade-in
- **Content:**
  1. Accent icon (lock or sparkles)
  2. Headline: "Unlock the full PropertyIQ experience"
  3. Brief value pitch
  4. Feature comparison: 4-5 rows, Free vs Pro
  5. Primary CTA: "Upgrade to Pro" -> `startCheckout('pro', 'monthly')`
  6. Secondary: "View all plans" -> `/pricing`
- **Dismiss:** X button or click outside

### Shared Behavior

- Portal-rendered to `document.body`
- Lock body scroll when visible
- Fire `trackPaywallEvent` on view and CTA click
- Respect `?tier=pro` dev override (never show if simulated tier is paid)

## Integration & Edge Cases

| Scenario | Behavior |
|----------|----------|
| Anon clears sessionStorage | Counter resets, gets 5 more pages |
| User signs up mid-session | Auth state changes, hard block disappears instantly |
| User upgrades to Pro | Entitlements refresh, nag modal stops, timer clears |
| `/reports/sample`, `/reports/shared/*` | Excluded from counting, never trigger overlays |
| `/pricing` while blocked | Not a product page, no overlay |
| Dev override `?tier=pro` | Overlays suppressed |
| Tab open for hours (free user) | Timer fires every 5 min, dismiss resets clock |
| Admin users | Never shown overlays |

## Cleanup: Remove Conflicting Systems

### Files to DELETE:
1. `packages/frontend/app/components/SignUpWall.tsx` — disabled 340-line full-screen sign-up wall with own view counter
2. `packages/frontend/components/entitlements/SignupPromptBanner.tsx` — dead floating banner, never mounted
3. `packages/frontend/lib/entitlements/anonymousViews.ts` — dead storage engine for SignupPromptBanner

### References to REMOVE:
4. `components/entitlements/index.ts` — remove `SignupPromptBanner` export
5. `app/layout.tsx` — remove commented-out `SignUpWall` import and usage

### Storage keys cleaned up:
- `piq-anon-market-views` (sessionStorage, dead)
- `piq-signup-prompt-dismissed` (sessionStorage, dead)
- `piq_page_views` (localStorage, dead)

### What stays untouched:
All feature-level gates (`PaywallOverlay`, `BlurredTeaser`, `ScorePaywall`, `GeoLockCard`, `ScoreBreakdownGate`, inline upgrade modals in `MetricItem`, `GeoLevelPills`, etc.) — these gate specific content and don't conflict.

## New Files

| File | Purpose |
|------|---------|
| `lib/entitlements/PaywallProvider.tsx` | Context provider with page-view counting, timer, and overlay rendering |
| `lib/entitlements/usePaywallPageTracking.ts` | Hook: sessionStorage page-view set management |
| `components/entitlements/AnonPaywallOverlay.tsx` | Full-screen sign-up overlay |
| `components/entitlements/FreeUserUpgradeModal.tsx` | Dismissible upgrade modal |

## No Backend Changes

The existing Stripe checkout flow (`POST /api/billing/checkout`) and entitlements system handle everything. No new endpoints, database changes, or backend logic needed.
