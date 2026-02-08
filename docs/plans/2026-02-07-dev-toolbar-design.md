# Dev Toolbar Design

## Purpose

A floating development toolbar for PropertyIQ that provides tier/auth simulation and admin navigation on every page during development and staging.

## Requirements

- Simulate user tiers (free, pro, enterprise, admin) to see the site as different user types
- Simulate auth state (anonymous vs authenticated) to test paywall CTAs
- Quick access to admin pages from any page
- Live display of current entitlements state for the page being viewed
- Resource access checker for ad-hoc entitlement lookups

## Activation

Two methods, used together:

1. **Development** (`NODE_ENV === 'development'`): Toolbar appears automatically
2. **Staging/Preview**: URL param `?devtools=<key>` activates the toolbar for the browser session. Key is configured via `NEXT_PUBLIC_DEVTOOLS_KEY` env var (defaults to `"dev"` in development). Persisted in `sessionStorage`

## Architecture

- Single component: `packages/frontend/components/dev/DevToolbar.tsx`
- Imported in `app/layout.tsx` via `next/dynamic` with `ssr: false`
- Reads/writes existing `simulatedTier` / `setSimulatedTier` from `EntitlementsContext`
- New `simulatedAuth` state in `EntitlementsContext` for auth override
- No new API routes — all client-side state overrides

## UI Design

### Bottom Bar (Collapsed — Always Visible)

A fixed strip (~40px) at the bottom of the viewport:

```
┌─────────────────────────────────────────────────────────┐
│ [PRO] [Authed]  metric:home_value→full  feature:scores→none    [⚙] [▲] │
│  tier   auth         current page resources              admin expand │
└─────────────────────────────────────────────────────────┘
```

- **Position**: Fixed bottom, `z-50`, `bg-surface-container-highest/95`, top border
- **Left**: Tier badge (colored chip, clickable to quick-cycle tiers) + auth status icon/text
- **Center**: Compact resource access summary for current page
- **Right**: Admin gear icon (links to `/dev/admin/entitlements`) + expand chevron

### Expanded Panel (~300px tall)

Slides up from the bottom bar. Three columns:

#### Left — Simulation Controls
- **Tier Switcher**: Segmented control with Free / Pro / Enterprise / Admin
  - Calls `setSimulatedTier()` which triggers entitlements re-fetch with `?tier=` override
- **Auth Toggle**: Anonymous / Authenticated switch
  - Overrides Supabase session check in paywall CTA components
- **Reset Button**: Clears all overrides, returns to real user state

#### Center — Live State Display
- Current tier (from API or simulated)
- Trial status (active/inactive, days remaining)
- Resource access table (scrollable):
  - Resource key
  - Access level: green=full, yellow=preview, red=none
  - Preview limit (if applicable)
  - Tier required (if gated)

#### Right — Admin Navigation + Tools
- Quick links to all admin pages:
  - Overview (`/dev/admin/entitlements`)
  - Tier Config (`/dev/admin/entitlements/tiers`)
  - User Management (`/dev/admin/entitlements/users`)
  - Trial Settings (`/dev/admin/entitlements/trial`)
  - Analytics (`/dev/admin/entitlements/analytics`)
- **Resource Checker**: Text input to type any resource ID and see its access level for the current simulated tier

## Color Scheme (M3 Tokens)

- Bar background: `bg-surface-container-highest` with 95% opacity
- Tier badges: Free=`outline-variant`, Pro=`primary`, Enterprise=`tertiary`, Admin=`error`
- Access levels: Full=`on-surface` (green tint), Preview=`tertiary` (amber tint), None=`error`

## Integration Points

- `EntitlementsContext.tsx`: Wire `simulatedTier`/`setSimulatedTier` (already exist), add `simulatedAuth`/`setSimulatedAuth`
- `PaywallOverlay.tsx`, `ScorePaywall.tsx`, `InsightsPaywall.tsx`: Read `simulatedAuth` override for CTA logic
- `app/layout.tsx`: Conditionally render `DevToolbar` via dynamic import
- `usePathname()`: Track current page for resource display
