# Onboarding Tutorial System Design

**Date:** 2026-03-04
**Status:** Approved

## Overview

First-time user onboarding system for PropertyIQ. Combines a **welcome wizard** (profile personalization) with a **guided tooltip tour** (feature education). Triggers automatically on first login, tracks completion state in Supabase, and is re-accessible from the Help menu.

## Goals

- **Reduce churn:** Get users to the "aha moment" fast
- **Educate:** Walk through map, scores, graphs, AI assessment, and reports
- **Personalize:** Collect user type, goals, experience, and market preferences upfront
- No upsell during the tour — purely educational

## Two-Phase Flow

### Phase 1: Welcome Wizard (Centered Modal, 4 Screens)

Appears immediately after first login, before the user sees the dashboard.

| Screen | Question                    | Options                                                                       | Saves to `user_profiles`    |
| ------ | --------------------------- | ----------------------------------------------------------------------------- | --------------------------- |
| 1      | What describes you best?    | First-time homebuyer, Investor, Agent/Broker, Researcher                      | `user_type`                 |
| 2      | What's your goal?           | Buy a home, Rental income, Fix & flip, Long-term appreciation, Just exploring | `investment_goal`           |
| 3      | How experienced are you?    | New to RE, Some experience, Professional                                      | `experience_level`          |
| 4      | Which markets interest you? | Search + pick up to 3 (reuses existing search component)                      | `preferred_markets` (jsonb) |

- Each screen has a progress bar and "Skip" option
- Skipping a question saves `null` for that field
- After screen 4, transitions into the guided tooltip tour

### Phase 2: Guided Tooltip Tour (9 Steps)

Single continuous flow across pages. Navigates the user automatically.

| #   | Page           | Target Element        | Title                              | Body                                                                                                                                                                                               |
| --- | -------------- | --------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/map`         | Welcome (no anchor)   | **Welcome to PropertyIQ**          | "Let's take a quick tour of the platform. We'll show you how to explore markets, understand scores, and use our analysis tools. Takes about 2 minutes."                                            |
| 2   | `/map`         | Search bar            | **Search Any Market**              | "Type a city, ZIP code, or metro area to jump straight to the market you're interested in."                                                                                                        |
| 3   | `/map`         | Metric sidebar        | **Explore Market Data**            | "Choose from 30+ metrics like Home Value, Rent Index, and Market Heat to color-code the map. Switch geography levels to zoom into the data."                                                       |
| 4   | `/map`         | Map region            | **Dive Into a Market**             | "Click any region on the map to see detailed stats and PropertyIQ scores for that area."                                                                                                           |
| 5   | `/scores`      | Score widget          | **PropertyIQ Scores**              | "Every market gets a score from 0-100. HomeReady measures homebuyer opportunity. InvestorEdge measures rental investment potential. The letter badge shows data confidence."                       |
| 6   | `/graphs`      | Chart area            | **Interactive Charts**             | "Visualize trends over time for any metric. Compare regions, spot patterns, and track how markets are changing."                                                                                   |
| 7   | `/market/[id]` | AI assessment section | **AI-Powered Market Intelligence** | "This is what sets PropertyIQ apart. Our AI analyzes dozens of data points to give you a plain-English assessment of any market — opportunities, risks, and outlook. No other platform does this." |
| 8   | `/reports`     | Reports page          | **Market Reports**                 | "Generate detailed reports for any market. Reports combine scores, trends, and key metrics into a shareable document."                                                                             |
| 9   | (final)        | No anchor             | **You're All Set!**                | "That's the essentials. Explore on your own — you can restart this tour anytime from the Help menu."                                                                                               |

**Step 7 note:** Navigates to a demo market (user's preferred market from wizard, or default like Dallas-Fort Worth) before highlighting the AI assessment.

**Step 7 visual emphasis:** Larger tooltip (`max-w-lg`) with `border-l-4 border-primary` accent border to signal this is the differentiating feature.

## Architecture

### File Structure

```
packages/frontend/app/onboarding/
  TourProvider.tsx       # React context: manages wizard/tour state, step navigation
  TourOverlay.tsx        # Full-screen dimming overlay with spotlight cutout
  TourTooltip.tsx        # M3-styled tooltip (title, body, step dots, Back/Next/Skip)
  WelcomeWizard.tsx      # 4-screen profile wizard modal
  tour-steps.ts          # Step definitions (target selector, title, body, page route)
  useTourState.ts        # Hook: fetches/persists onboarding state from user_profiles

packages/frontend/lib/data/fetchers/
  onboarding.ts          # fetchOnboardingState(), completeOnboarding(), resetOnboarding()
                         # fetchUserPreferences(), updateUserPreferences()
```

### State Flow

1. User completes signup → auth callback redirects to `/map`
2. `TourProvider` (wrapped in root Providers) checks `user_profiles.onboarding_completed_at`
3. If `null` → show Welcome Wizard (Phase 1)
4. Wizard saves preferences to `user_profiles` on each screen
5. After wizard → start guided tooltip tour (Phase 2)
6. `onboarding_completed_at` is set **immediately when tour starts** (not on completion)
7. Skip/dismiss at any point → tour closes, timestamp already persisted, never auto-triggers again
8. "Restart Tutorial" from Help menu → resets column to `null`, navigates to `/map`

### Persistence: No Resume

- Single `onboarding_completed_at` timestamp — no step tracking
- If user restarts, tour begins from step 1 (wizard is skipped since preferences are already saved)

## Database Changes

New columns on `user_profiles` table:

| Column                    | Type          | Default | Purpose                                |
| ------------------------- | ------------- | ------- | -------------------------------------- |
| `onboarding_completed_at` | `timestamptz` | `null`  | Tour seen/dismissed flag               |
| `user_type`               | `text`        | `null`  | Homebuyer, investor, agent, researcher |
| `investment_goal`         | `text`        | `null`  | Primary RE goal                        |
| `experience_level`        | `text`        | `null`  | New, intermediate, professional        |
| `preferred_markets`       | `jsonb`       | `null`  | Array of `{ geoLevel, geoId, name }`   |

## Visual Design (M3)

### Tooltip Component

- Background: `bg-surface-container-high`
- Shape: `rounded-[28px]` (M3 Extra Large)
- Elevation: `shadow-lg`
- Title: `text-xl font-medium` (M3 Title Large)
- Body: `text-base text-on-surface-variant` (M3 Body Large)
- Step indicator: dot row (filled = current, outlined = remaining)
- Buttons: `rounded-full` — "Back" (text), "Next" (filled primary), "Skip tour" (text, subdued)
- Max width: `max-w-md` (step 7: `max-w-lg` with `border-l-4 border-primary`)

### Spotlight Overlay

- `fixed inset-0 z-50` with `bg-black/60`
- Cutout around target element via CSS `clip-path` or box-shadow
- `duration-400` transition between targets (M3 medium motion)

### Welcome/Completion Steps (No Anchor)

- Centered modal style on screen with overlay behind
- Same card styling as tooltips

### Welcome Wizard Screens

- Centered modal, `max-w-lg`, `rounded-[28px]`
- Progress bar at top (4 segments)
- Radio buttons / search input styled per M3
- "Skip" text button, "Continue" filled primary button

## Positioning

- No external library — uses `getBoundingClientRect()` + absolute positioning
- Matches existing popover pattern in the codebase
- `element.scrollIntoView({ behavior: 'smooth' })` for off-screen targets

## Restart from Help

- Add "Restart Tutorial" button to `/help` page
- Calls `resetOnboarding()` then `router.push('/map')`
- Tour re-triggers from step 1 (wizard skipped if preferences exist)

## Future Personalization (Not v1)

These columns enable future features without additional schema changes:

- Default map view centered on preferred markets
- HomeReady vs InvestorEdge shown first based on user type/goal
- Simplified vs detailed tooltips based on experience level
- Auto-suggested alerts for preferred markets

## Dependencies

- No external packages required
- Uses existing: React context, `useAuth()`, `useRouter()`, search component, data layer
