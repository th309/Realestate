# Onboarding Tutorial System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a two-phase onboarding system (welcome wizard + guided tooltip tour) that triggers on first login, collects user preferences, walks through key features, and persists completion state.

**Architecture:** Custom React context + components. Welcome wizard collects profile data (4 screens), then a 9-step tooltip tour navigates across /map → /scores → /graphs → /market/[id] → /reports. State persisted in `user_profiles` table via Supabase. No external dependencies.

**Tech Stack:** React 19, Next.js 16 App Router, Supabase (PostgreSQL), TanStack React Query, Tailwind CSS 4, M3 design system.

**Design Doc:** `docs/plans/2026-03-04-onboarding-tutorial-design.md`

---

## Task 1: Database Migration — Add Onboarding Columns

**Files:**

- Create: Supabase migration (run via Supabase dashboard or SQL editor)

**Step 1: Run the migration SQL**

Execute in Supabase SQL Editor (production + staging):

```sql
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS user_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS investment_goal text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS experience_level text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS preferred_markets jsonb DEFAULT NULL;

COMMENT ON COLUMN user_profiles.onboarding_completed_at IS 'Set when onboarding tour is started/dismissed. NULL = show tour.';
COMMENT ON COLUMN user_profiles.user_type IS 'homebuyer | investor | agent | researcher';
COMMENT ON COLUMN user_profiles.investment_goal IS 'buy_home | rental_income | fix_flip | appreciation | exploring';
COMMENT ON COLUMN user_profiles.experience_level IS 'new | intermediate | professional';
COMMENT ON COLUMN user_profiles.preferred_markets IS 'Array of {geoLevel, geoId, name} objects';
```

**Step 2: Verify columns exist**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name IN ('onboarding_completed_at', 'user_type', 'investment_goal', 'experience_level', 'preferred_markets');
```

Expected: 5 rows, all nullable.

**Step 3: Commit a note**

```bash
git add -A && git commit -m "docs: note onboarding columns added to user_profiles"
```

---

## Task 2: Data Layer — Onboarding Fetcher

**Files:**

- Create: `packages/frontend/lib/data/fetchers/onboarding.ts`
- Modify: `packages/frontend/lib/data/fetchers/index.ts`
- Modify: `packages/frontend/lib/data/index.ts` (add exports after line ~254)

**Reference patterns:**

- `packages/frontend/lib/data/fetchers/base.ts` — `fetchAPI`, `fetchAPIWithParams` pattern
- `packages/frontend/lib/data/fetchers/email-preferences.ts` — similar profile-update fetcher

**Step 1: Create the onboarding fetcher**

Create `packages/frontend/lib/data/fetchers/onboarding.ts`:

```typescript
/**
 * ONBOARDING FETCHERS
 *
 * Functions for reading and updating onboarding state and user preferences
 * stored in the user_profiles table.
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface OnboardingState {
  onboarding_completed_at: string | null;
  user_type: string | null;
  investment_goal: string | null;
  experience_level: string | null;
  preferred_markets: Array<{
    geoLevel: string;
    geoId: string;
    name: string;
  }> | null;
}

/**
 * Fetch current onboarding state from user_profiles.
 */
export async function fetchOnboardingState(): Promise<OnboardingState | null> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "onboarding_completed_at, user_type, investment_goal, experience_level, preferred_markets",
    )
    .eq("id", user.id)
    .single();

  if (error || !data) return null;
  return data as OnboardingState;
}

/**
 * Mark onboarding as completed (set timestamp). Call when tour starts or is dismissed.
 */
export async function completeOnboarding(): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("user_profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);
}

/**
 * Reset onboarding state so the tour triggers again.
 */
export async function resetOnboarding(): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("user_profiles")
    .update({ onboarding_completed_at: null })
    .eq("id", user.id);
}

/**
 * Save user preferences from the welcome wizard.
 */
export async function saveOnboardingPreferences(
  preferences: Partial<
    Pick<
      OnboardingState,
      "user_type" | "investment_goal" | "experience_level" | "preferred_markets"
    >
  >,
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("user_profiles").update(preferences).eq("id", user.id);
}
```

**Step 2: Export from fetchers index**

Add to `packages/frontend/lib/data/fetchers/index.ts`:

```typescript
export {
  fetchOnboardingState,
  completeOnboarding,
  resetOnboarding,
  saveOnboardingPreferences,
} from "./onboarding";
export type { OnboardingState } from "./onboarding";
```

**Step 3: Export from data layer barrel**

Add to `packages/frontend/lib/data/index.ts` in the FETCHERS section (after the last fetcher export block, around line 254):

```typescript
// Onboarding
export {
  fetchOnboardingState,
  completeOnboarding,
  resetOnboarding,
  saveOnboardingPreferences,
} from "./fetchers";
export type { OnboardingState } from "./fetchers";
```

**Step 4: Verify build**

```bash
cd packages/frontend && npx next build --no-lint 2>&1 | head -30
```

Expected: No import/export errors.

**Step 5: Commit**

```bash
git add packages/frontend/lib/data/fetchers/onboarding.ts packages/frontend/lib/data/fetchers/index.ts packages/frontend/lib/data/index.ts
git commit -m "feat(onboarding): add data layer fetchers for onboarding state and preferences"
```

---

## Task 3: Tour State Hook — `useTourState`

**Files:**

- Create: `packages/frontend/app/onboarding/useTourState.ts`

**Dependencies:** Task 2 (onboarding fetcher)

**Step 1: Create the hook**

Create `packages/frontend/app/onboarding/useTourState.ts`:

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchOnboardingState,
  completeOnboarding,
  resetOnboarding,
  saveOnboardingPreferences,
} from "@/lib/data";
import type { OnboardingState } from "@/lib/data";

const ONBOARDING_QUERY_KEY = ["onboarding-state"];

export function useTourState() {
  const queryClient = useQueryClient();

  const { data: onboardingState, isLoading } = useQuery({
    queryKey: ONBOARDING_QUERY_KEY,
    queryFn: fetchOnboardingState,
    staleTime: Infinity,
  });

  const completeMutation = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY }),
  });

  const resetMutation = useMutation({
    mutationFn: resetOnboarding,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY }),
  });

  const savePreferencesMutation = useMutation({
    mutationFn: saveOnboardingPreferences,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY }),
  });

  const shouldShowTour =
    !isLoading &&
    onboardingState !== null &&
    onboardingState.onboarding_completed_at === null;

  return {
    onboardingState,
    isLoading,
    shouldShowTour,
    markComplete: completeMutation.mutate,
    resetTour: resetMutation.mutate,
    savePreferences: savePreferencesMutation.mutate,
  };
}
```

**Step 2: Commit**

```bash
git add packages/frontend/app/onboarding/useTourState.ts
git commit -m "feat(onboarding): add useTourState hook for onboarding persistence"
```

---

## Task 4: Tour Step Definitions

**Files:**

- Create: `packages/frontend/app/onboarding/tour-steps.ts`

**Step 1: Define all tour steps**

Create `packages/frontend/app/onboarding/tour-steps.ts`:

```typescript
export interface TourStep {
  id: string;
  route: string | null; // null = no navigation needed, string = navigate to this route
  targetSelector: string | null; // null = centered modal (no anchor)
  title: string;
  body: string;
  placement: "top" | "bottom" | "left" | "right" | "center";
  highlight?: boolean; // Extra emphasis (larger tooltip, accent border)
}

/**
 * Default demo market for step 7 (AI assessment).
 * Overridden by user's preferred_markets[0] if available.
 */
export const DEFAULT_DEMO_MARKET = {
  slug: "dallas-fort-worth-tx",
  name: "Dallas-Fort Worth, TX",
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    route: "/map",
    targetSelector: null,
    title: "Welcome to PropertyIQ",
    body: "Let's take a quick tour of the platform. We'll show you how to explore markets, understand scores, and use our analysis tools. Takes about 2 minutes.",
    placement: "center",
  },
  {
    id: "search-bar",
    route: null,
    targetSelector: '[data-tour="search-bar"]',
    title: "Search Any Market",
    body: "Type a city, ZIP code, or metro area to jump straight to the market you're interested in.",
    placement: "bottom",
  },
  {
    id: "metric-sidebar",
    route: null,
    targetSelector: '[data-tour="metric-sidebar"]',
    title: "Explore Market Data",
    body: "Choose from 30+ metrics like Home Value, Rent Index, and Market Heat to color-code the map. Switch geography levels to zoom into the data.",
    placement: "right",
  },
  {
    id: "map-region",
    route: null,
    targetSelector: '[data-tour="map-area"]',
    title: "Dive Into a Market",
    body: "Click any region on the map to see detailed stats and PropertyIQ scores for that area.",
    placement: "top",
  },
  {
    id: "scores",
    route: "/scores",
    targetSelector: '[data-tour="score-cards"]',
    title: "PropertyIQ Scores",
    body: "Every market gets a score from 0-100. HomeReady measures homebuyer opportunity. InvestorEdge measures rental investment potential. The letter badge shows data confidence.",
    placement: "bottom",
  },
  {
    id: "graphs",
    route: "/graphs",
    targetSelector: '[data-tour="chart-area"]',
    title: "Interactive Charts",
    body: "Visualize trends over time for any metric. Compare regions, spot patterns, and track how markets are changing.",
    placement: "bottom",
  },
  {
    id: "ai-assessment",
    route: null, // Route is dynamic — set at runtime based on preferred market
    targetSelector: '[data-tour="ai-assessment"]',
    title: "AI-Powered Market Intelligence",
    body: "This is what sets PropertyIQ apart. Our AI analyzes dozens of data points to give you a plain-English assessment of any market — opportunities, risks, and outlook. No other platform does this.",
    placement: "top",
    highlight: true,
  },
  {
    id: "reports",
    route: "/reports",
    targetSelector: '[data-tour="reports-section"]',
    title: "Market Reports",
    body: "Generate detailed reports for any market. Reports combine scores, trends, and key metrics into a shareable document.",
    placement: "bottom",
  },
  {
    id: "complete",
    route: null,
    targetSelector: null,
    title: "You're All Set!",
    body: "That's the essentials. Explore on your own — you can restart this tour anytime from the Help menu.",
    placement: "center",
  },
];
```

**Step 2: Commit**

```bash
git add packages/frontend/app/onboarding/tour-steps.ts
git commit -m "feat(onboarding): add tour step definitions for 9-step guided tour"
```

---

## Task 5: Tour Overlay Component

**Files:**

- Create: `packages/frontend/app/onboarding/TourOverlay.tsx`

**Step 1: Build the spotlight overlay**

Create `packages/frontend/app/onboarding/TourOverlay.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';

interface TourOverlayProps {
  targetSelector: string | null;
  visible: boolean;
  onClick?: () => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;
const BORDER_RADIUS = 12;

export function TourOverlay({ targetSelector, visible, onClick }: TourOverlayProps) {
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);

  useEffect(() => {
    if (!visible || !targetSelector) {
      setSpotlight(null);
      return;
    }

    const updateSpotlight = () => {
      const el = document.querySelector(targetSelector);
      if (!el) {
        setSpotlight(null);
        return;
      }

      const rect = el.getBoundingClientRect();
      setSpotlight({
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      });

      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    // Initial position + reposition on scroll/resize
    updateSpotlight();
    const rafId = requestAnimationFrame(updateSpotlight);
    window.addEventListener('resize', updateSpotlight);
    window.addEventListener('scroll', updateSpotlight, true);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight, true);
    };
  }, [targetSelector, visible]);

  if (!visible) return null;

  // No target = full overlay (centered modal mode)
  if (!spotlight) {
    return (
      <div
        className="fixed inset-0 z-[9998] bg-black/60 transition-opacity duration-400"
        onClick={onClick}
      />
    );
  }

  // Spotlight cutout using box-shadow
  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none transition-all duration-400">
      {/* Clickable backdrop */}
      <div className="absolute inset-0 pointer-events-auto" onClick={onClick} />
      {/* Spotlight cutout */}
      <div
        className="absolute pointer-events-none transition-all duration-400"
        style={{
          top: spotlight.top,
          left: spotlight.left,
          width: spotlight.width,
          height: spotlight.height,
          borderRadius: BORDER_RADIUS,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
        }}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add packages/frontend/app/onboarding/TourOverlay.tsx
git commit -m "feat(onboarding): add spotlight overlay component with box-shadow cutout"
```

---

## Task 6: Tour Tooltip Component

**Files:**

- Create: `packages/frontend/app/onboarding/TourTooltip.tsx`

**Step 1: Build the M3-styled tooltip**

Create `packages/frontend/app/onboarding/TourTooltip.tsx`:

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import type { TourStep } from './tour-steps';

interface TourTooltipProps {
  step: TourStep;
  currentIndex: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

interface Position {
  top: number;
  left: number;
}

export function TourTooltip({
  step,
  currentIndex,
  totalSteps,
  onNext,
  onBack,
  onSkip,
}: TourTooltipProps) {
  const [position, setPosition] = useState<Position | null>(null);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalSteps - 1;
  const isCentered = step.placement === 'center' || !step.targetSelector;

  const calculatePosition = useCallback(() => {
    if (isCentered || !step.targetSelector) {
      setPosition(null);
      return;
    }

    const el = document.querySelector(step.targetSelector);
    if (!el) {
      setPosition(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    const tooltipWidth = step.highlight ? 512 : 448; // max-w-lg : max-w-md
    const tooltipHeight = 200; // approximate
    const gap = 16;

    let top = 0;
    let left = 0;

    switch (step.placement) {
      case 'bottom':
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'top':
        top = rect.top - tooltipHeight - gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + gap;
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - gap;
        break;
    }

    // Clamp to viewport
    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));

    setPosition({ top, left });
  }, [step, isCentered]);

  useEffect(() => {
    calculatePosition();
    const rafId = requestAnimationFrame(calculatePosition);
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition, true);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition, true);
    };
  }, [calculatePosition]);

  const maxWidthClass = step.highlight ? 'max-w-lg' : 'max-w-md';
  const accentBorder = step.highlight ? 'border-l-4 border-primary' : '';

  // Centered modal style (welcome + completion steps)
  if (isCentered) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
        <div
          className={`${maxWidthClass} w-full mx-4 pointer-events-auto bg-surface-container-high rounded-[28px] shadow-lg p-8 ${accentBorder} animate-in fade-in zoom-in-95 duration-300`}
        >
          <TooltipContent
            step={step}
            currentIndex={currentIndex}
            totalSteps={totalSteps}
            isFirst={isFirst}
            isLast={isLast}
            onNext={onNext}
            onBack={onBack}
            onSkip={onSkip}
          />
        </div>
      </div>
    );
  }

  // Anchored tooltip style
  if (!position) return null;

  return (
    <div
      className={`fixed z-[9999] ${maxWidthClass} w-full pointer-events-auto bg-surface-container-high rounded-[28px] shadow-lg p-6 ${accentBorder} animate-in fade-in slide-in-from-bottom-2 duration-300`}
      style={{ top: position.top, left: position.left }}
    >
      <TooltipContent
        step={step}
        currentIndex={currentIndex}
        totalSteps={totalSteps}
        isFirst={isFirst}
        isLast={isLast}
        onNext={onNext}
        onBack={onBack}
        onSkip={onSkip}
      />
    </div>
  );
}

function TooltipContent({
  step,
  currentIndex,
  totalSteps,
  isFirst,
  isLast,
  onNext,
  onBack,
  onSkip,
}: {
  step: TourStep;
  currentIndex: number;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      <h3 className="text-xl font-medium text-on-surface mb-2">{step.title}</h3>
      <p className="text-base text-on-surface-variant leading-relaxed mb-6">{step.body}</p>

      {/* Step dots */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                i === currentIndex
                  ? 'bg-primary'
                  : i < currentIndex
                    ? 'bg-primary/40'
                    : 'bg-outline-variant'
              }`}
            />
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {!isLast && (
            <button
              onClick={onSkip}
              className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface rounded-full transition-colors duration-200"
            >
              Skip tour
            </button>
          )}
          {!isFirst && (
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm font-medium text-primary hover:bg-primary/8 rounded-full transition-colors duration-200"
            >
              Back
            </button>
          )}
          <button
            onClick={onNext}
            className="px-6 py-2 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 rounded-full transition-colors duration-200"
          >
            {isLast ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </>
  );
}
```

**Step 2: Commit**

```bash
git add packages/frontend/app/onboarding/TourTooltip.tsx
git commit -m "feat(onboarding): add M3-styled tour tooltip with positioned and centered modes"
```

---

## Task 7: Welcome Wizard Component

**Files:**

- Create: `packages/frontend/app/onboarding/WelcomeWizard.tsx`

**Reference:** Reuses `fetchGeographySearch` from `@/lib/data` for market search in screen 4.

**Step 1: Build the 4-screen wizard**

Create `packages/frontend/app/onboarding/WelcomeWizard.tsx`:

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { fetchGeographySearch } from '@/lib/data/fetchers/search';
import type { GeographySearchResult } from '@/lib/data/fetchers/search';

interface WelcomeWizardProps {
  onComplete: (preferences: WizardPreferences) => void;
  onSkip: () => void;
}

export interface WizardPreferences {
  user_type: string | null;
  investment_goal: string | null;
  experience_level: string | null;
  preferred_markets: Array<{ geoLevel: string; geoId: string; name: string }> | null;
}

const USER_TYPES = [
  { value: 'homebuyer', label: 'First-time Homebuyer', icon: '🏠' },
  { value: 'investor', label: 'Real Estate Investor', icon: '📈' },
  { value: 'agent', label: 'Agent / Broker', icon: '🤝' },
  { value: 'researcher', label: 'Market Researcher', icon: '🔍' },
];

const INVESTMENT_GOALS = [
  { value: 'buy_home', label: 'Buy a home to live in' },
  { value: 'rental_income', label: 'Rental income' },
  { value: 'fix_flip', label: 'Fix & flip' },
  { value: 'appreciation', label: 'Long-term appreciation' },
  { value: 'exploring', label: 'Just exploring' },
];

const EXPERIENCE_LEVELS = [
  { value: 'new', label: 'New to real estate', description: 'Learning the basics' },
  { value: 'intermediate', label: 'Some experience', description: 'Done a few deals or researched markets' },
  { value: 'professional', label: 'Professional', description: 'Active investor, agent, or analyst' },
];

const TOTAL_SCREENS = 4;

export function WelcomeWizard({ onComplete, onSkip }: WelcomeWizardProps) {
  const [screen, setScreen] = useState(0);
  const [userType, setUserType] = useState<string | null>(null);
  const [investmentGoal, setInvestmentGoal] = useState<string | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<string | null>(null);
  const [selectedMarkets, setSelectedMarkets] = useState<Array<{ geoLevel: string; geoId: string; name: string }>>([]);

  const handleContinue = () => {
    if (screen < TOTAL_SCREENS - 1) {
      setScreen(screen + 1);
    } else {
      onComplete({
        user_type: userType,
        investment_goal: investmentGoal,
        experience_level: experienceLevel,
        preferred_markets: selectedMarkets.length > 0 ? selectedMarkets : null,
      });
    }
  };

  const handleBack = () => {
    if (screen > 0) setScreen(screen - 1);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Modal */}
      <div className="relative max-w-lg w-full mx-4 bg-surface-container-high rounded-[28px] shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Progress bar */}
        <div className="h-1 bg-surface-container">
          <div
            className="h-full bg-primary transition-all duration-400"
            style={{ width: `${((screen + 1) / TOTAL_SCREENS) * 100}%` }}
          />
        </div>

        <div className="p-8">
          {screen === 0 && (
            <WizardScreen
              title="What describes you best?"
              subtitle="This helps us tailor your experience."
            >
              <div className="grid grid-cols-2 gap-3">
                {USER_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setUserType(type.value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                      userType === type.value
                        ? 'border-primary bg-primary/8 text-on-surface'
                        : 'border-outline-variant bg-surface hover:border-outline text-on-surface-variant'
                    }`}
                  >
                    <span className="text-2xl">{type.icon}</span>
                    <span className="text-sm font-medium text-center">{type.label}</span>
                  </button>
                ))}
              </div>
            </WizardScreen>
          )}

          {screen === 1 && (
            <WizardScreen
              title="What's your goal?"
              subtitle="We'll highlight the most relevant data for you."
            >
              <div className="flex flex-col gap-2">
                {INVESTMENT_GOALS.map((goal) => (
                  <button
                    key={goal.value}
                    onClick={() => setInvestmentGoal(goal.value)}
                    className={`px-4 py-3 rounded-xl border-2 text-left text-sm font-medium transition-all duration-200 ${
                      investmentGoal === goal.value
                        ? 'border-primary bg-primary/8 text-on-surface'
                        : 'border-outline-variant bg-surface hover:border-outline text-on-surface-variant'
                    }`}
                  >
                    {goal.label}
                  </button>
                ))}
              </div>
            </WizardScreen>
          )}

          {screen === 2 && (
            <WizardScreen
              title="How experienced are you?"
              subtitle="We'll adjust how much detail we show."
            >
              <div className="flex flex-col gap-3">
                {EXPERIENCE_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => setExperienceLevel(level.value)}
                    className={`px-4 py-4 rounded-xl border-2 text-left transition-all duration-200 ${
                      experienceLevel === level.value
                        ? 'border-primary bg-primary/8'
                        : 'border-outline-variant bg-surface hover:border-outline'
                    }`}
                  >
                    <div className="text-sm font-medium text-on-surface">{level.label}</div>
                    <div className="text-xs text-on-surface-variant mt-0.5">{level.description}</div>
                  </button>
                ))}
              </div>
            </WizardScreen>
          )}

          {screen === 3 && (
            <WizardScreen
              title="Which markets interest you?"
              subtitle="Pick up to 3. You can always change this later."
            >
              <MarketPicker
                selectedMarkets={selectedMarkets}
                onSelect={(market) => {
                  if (selectedMarkets.length < 3) {
                    setSelectedMarkets([...selectedMarkets, market]);
                  }
                }}
                onRemove={(geoId) => {
                  setSelectedMarkets(selectedMarkets.filter((m) => m.geoId !== geoId));
                }}
              />
            </WizardScreen>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={onSkip}
              className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface rounded-full transition-colors duration-200"
            >
              Skip
            </button>
            <div className="flex gap-2">
              {screen > 0 && (
                <button
                  onClick={handleBack}
                  className="px-4 py-2 text-sm font-medium text-primary hover:bg-primary/8 rounded-full transition-colors duration-200"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleContinue}
                className="px-6 py-2 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 rounded-full transition-colors duration-200"
              >
                {screen === TOTAL_SCREENS - 1 ? 'Start Tour' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WizardScreen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-2xl font-medium text-on-surface mb-1">{title}</h2>
      <p className="text-sm text-on-surface-variant mb-6">{subtitle}</p>
      {children}
    </div>
  );
}

function MarketPicker({
  selectedMarkets,
  onSelect,
  onRemove,
}: {
  selectedMarkets: Array<{ geoLevel: string; geoId: string; name: string }>;
  onSelect: (market: { geoLevel: string; geoId: string; name: string }) => void;
  onRemove: (geoId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeographySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    fetchGeographySearch(query, { type: 'metro', limit: 5, signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setResults(data.filter((r) => !selectedMarkets.some((m) => m.geoId === r.geography_id)));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [query, selectedMarkets]);

  return (
    <div>
      {/* Selected markets */}
      {selectedMarkets.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedMarkets.map((market) => (
            <span
              key={market.geoId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/8 text-primary text-sm font-medium rounded-full"
            >
              {market.name}
              <button
                onClick={() => onRemove(market.geoId)}
                className="hover:text-error transition-colors"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      {selectedMarkets.length < 3 && (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a city or metro area..."
            className="w-full h-12 px-4 bg-surface border-2 border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none transition-colors duration-200"
          />

          {/* Results dropdown */}
          {results.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-high border border-outline-variant rounded-xl shadow-lg overflow-hidden z-10">
              {results.map((result) => (
                <button
                  key={result.geography_id}
                  onClick={() => {
                    onSelect({
                      geoLevel: result.geography_type,
                      geoId: result.geography_id,
                      name: result.name + (result.state_code ? `, ${result.state_code}` : ''),
                    });
                    setQuery('');
                    setResults([]);
                  }}
                  className="w-full px-4 py-3 text-left text-sm text-on-surface hover:bg-surface-container transition-colors"
                >
                  {result.name}{result.state_code ? `, ${result.state_code}` : ''}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-outline-variant border-t-primary rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add packages/frontend/app/onboarding/WelcomeWizard.tsx
git commit -m "feat(onboarding): add 4-screen welcome wizard with market search"
```

---

## Task 8: Tour Provider — Orchestration

**Files:**

- Create: `packages/frontend/app/onboarding/TourProvider.tsx`
- Create: `packages/frontend/app/onboarding/index.ts` (barrel export)

**Dependencies:** Tasks 3, 4, 5, 6, 7

**Step 1: Build the provider**

Create `packages/frontend/app/onboarding/TourProvider.tsx`:

```typescript
'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useTourState } from './useTourState';
import { TOUR_STEPS, DEFAULT_DEMO_MARKET } from './tour-steps';
import type { TourStep } from './tour-steps';
import { TourOverlay } from './TourOverlay';
import { TourTooltip } from './TourTooltip';
import { WelcomeWizard } from './WelcomeWizard';
import type { WizardPreferences } from './WelcomeWizard';

type TourPhase = 'idle' | 'wizard' | 'tour';

interface TourContextValue {
  isActive: boolean;
  currentStep: TourStep | null;
  restartTour: () => void;
}

const TourContext = createContext<TourContextValue>({
  isActive: false,
  currentStep: null,
  restartTour: () => {},
});

export const useTour = () => useContext(TourContext);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { shouldShowTour, isLoading, markComplete, savePreferences, resetTour, onboardingState } = useTourState();
  const router = useRouter();
  const pathname = usePathname();

  const [phase, setPhase] = useState<TourPhase>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [navigating, setNavigating] = useState(false);

  // Auto-trigger tour for first-time users
  useEffect(() => {
    if (!authLoading && !isLoading && user && shouldShowTour && phase === 'idle') {
      setPhase('wizard');
    }
  }, [authLoading, isLoading, user, shouldShowTour, phase]);

  const resolveStepRoute = useCallback((step: TourStep): string | null => {
    if (step.id === 'ai-assessment') {
      const preferredMarket = onboardingState?.preferred_markets?.[0];
      if (preferredMarket) {
        return `/market/${preferredMarket.geoId}`;
      }
      return `/markets/${DEFAULT_DEMO_MARKET.slug}`;
    }
    return step.route;
  }, [onboardingState]);

  const navigateToStep = useCallback(async (index: number) => {
    const step = TOUR_STEPS[index];
    const route = resolveStepRoute(step);

    if (route && pathname !== route) {
      setNavigating(true);
      router.push(route);
      // Wait for navigation to complete and DOM to settle
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setNavigating(false);
    }

    setStepIndex(index);
  }, [pathname, router, resolveStepRoute]);

  const handleWizardComplete = useCallback((preferences: WizardPreferences) => {
    savePreferences(preferences);
    markComplete();
    setPhase('tour');
    setStepIndex(0);
    navigateToStep(0);
  }, [savePreferences, markComplete, navigateToStep]);

  const handleWizardSkip = useCallback(() => {
    markComplete();
    setPhase('idle');
  }, [markComplete]);

  const handleNext = useCallback(() => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      navigateToStep(stepIndex + 1);
    } else {
      setPhase('idle');
    }
  }, [stepIndex, navigateToStep]);

  const handleBack = useCallback(() => {
    if (stepIndex > 0) {
      navigateToStep(stepIndex - 1);
    }
  }, [stepIndex, navigateToStep]);

  const handleSkip = useCallback(() => {
    setPhase('idle');
  }, []);

  const restartTour = useCallback(() => {
    resetTour();
    setStepIndex(0);
    setPhase('wizard');
  }, [resetTour]);

  const currentStep = phase === 'tour' ? TOUR_STEPS[stepIndex] : null;

  return (
    <TourContext.Provider value={{ isActive: phase !== 'idle', currentStep, restartTour }}>
      {children}

      {/* Welcome Wizard */}
      {phase === 'wizard' && (
        <WelcomeWizard onComplete={handleWizardComplete} onSkip={handleWizardSkip} />
      )}

      {/* Guided Tour */}
      {phase === 'tour' && currentStep && !navigating && (
        <>
          <TourOverlay
            targetSelector={currentStep.targetSelector}
            visible
            onClick={handleSkip}
          />
          <TourTooltip
            step={currentStep}
            currentIndex={stepIndex}
            totalSteps={TOUR_STEPS.length}
            onNext={handleNext}
            onBack={handleBack}
            onSkip={handleSkip}
          />
        </>
      )}
    </TourContext.Provider>
  );
}
```

**Step 2: Create barrel export**

Create `packages/frontend/app/onboarding/index.ts`:

```typescript
export { TourProvider, useTour } from "./TourProvider";
```

**Step 3: Commit**

```bash
git add packages/frontend/app/onboarding/TourProvider.tsx packages/frontend/app/onboarding/index.ts
git commit -m "feat(onboarding): add TourProvider orchestrating wizard + tooltip tour phases"
```

---

## Task 9: Wire TourProvider Into App

**Files:**

- Modify: `packages/frontend/app/providers.tsx` (line 110–111, wrap inside AuthProvider)

**Step 1: Add TourProvider to the provider tree**

In `packages/frontend/app/providers.tsx`, add the import and wrap:

```typescript
// Add import at top
import { TourProvider } from '@/app/onboarding';

// Modify the Providers component (lines 108-112):
// BEFORE:
//   <AuthProvider>
//     <EntitlementsProvider>
//       <PaywallProvider>{children}</PaywallProvider>
//     </EntitlementsProvider>
//   </AuthProvider>

// AFTER:
<AuthProvider>
  <TourProvider>
    <EntitlementsProvider>
      <PaywallProvider>{children}</PaywallProvider>
    </EntitlementsProvider>
  </TourProvider>
</AuthProvider>
```

TourProvider goes inside AuthProvider (needs auth context) and outside EntitlementsProvider (doesn't need entitlements).

**Step 2: Verify build**

```bash
cd packages/frontend && npx next build --no-lint 2>&1 | head -30
```

Expected: Clean build.

**Step 3: Commit**

```bash
git add packages/frontend/app/providers.tsx
git commit -m "feat(onboarding): wire TourProvider into app provider tree"
```

---

## Task 10: Add `data-tour` Attributes to Target Elements

**Files:**

- Modify: `packages/frontend/app/map/page.tsx` — add `data-tour` to search bar, sidebar, map area
- Modify: `packages/frontend/app/scores/page.tsx` — add `data-tour` to score cards
- Modify: `packages/frontend/app/graphs/components/GraphsPageV2/GraphsPageV2.tsx` — add `data-tour` to chart area
- Modify: `packages/frontend/app/reports/page.tsx` (or equivalent) — add `data-tour` to reports section
- Modify: Market page AI assessment section — add `data-tour` to AI assessment

**Step 1: Add data-tour attributes**

For each file, find the relevant container element and add a `data-tour` attribute. These are minimal, non-breaking changes — just adding a data attribute to existing elements.

Map page (`app/map/page.tsx`):

- Search bar container: add `data-tour="search-bar"` to the `SearchWidget` wrapper div
- Sidebar: add `data-tour="metric-sidebar"` to the `Sidebar` wrapper
- Map area: add `data-tour="map-area"` to the map container div

Scores page (`app/scores/page.tsx`):

- Score cards grid: add `data-tour="score-cards"` to the grid container

Graphs page (`app/graphs/components/GraphsPageV2/GraphsPageV2.tsx`):

- Chart area: add `data-tour="chart-area"` to the chart container

Reports page:

- Reports section: add `data-tour="reports-section"` to the main content area

Market page AI assessment:

- AI assessment section: add `data-tour="ai-assessment"` to the AI analysis container

**Step 2: Verify build and no visual changes**

```bash
cd packages/frontend && npx next build --no-lint 2>&1 | head -30
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(onboarding): add data-tour attributes to tour target elements"
```

---

## Task 11: Help Page — Restart Tutorial Button

**Files:**

- Modify: `packages/frontend/app/help/page.tsx` (add button before FAQ section, around line 85)

**Step 1: Add restart button**

Add a "Restart Tutorial" section to the help page, before the FAQ section:

```typescript
'use client';

import { useTour } from '@/app/onboarding';
import { useRouter } from 'next/navigation';

// Inside the help page component, before FAQ section:
function RestartTutorialSection() {
  const { restartTour } = useTour();
  const router = useRouter();

  const handleRestart = () => {
    restartTour();
    router.push('/map');
  };

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-xl p-6 mb-8">
      <h3 className="text-lg font-medium text-on-surface mb-2">Platform Tutorial</h3>
      <p className="text-sm text-on-surface-variant mb-4">
        Take a guided tour of PropertyIQ's key features. The tutorial covers market search, scores, charts, AI assessment, and reports.
      </p>
      <button
        onClick={handleRestart}
        className="px-6 py-2 text-sm font-medium text-on-primary bg-primary hover:bg-primary/90 rounded-full transition-colors duration-200"
      >
        Restart Tutorial
      </button>
    </div>
  );
}
```

Note: If `/help` is currently a Server Component, it will need `'use client'` added or the restart button extracted as a Client Component and imported.

**Step 2: Verify build**

```bash
cd packages/frontend && npx next build --no-lint 2>&1 | head -30
```

**Step 3: Commit**

```bash
git add packages/frontend/app/help/page.tsx
git commit -m "feat(onboarding): add restart tutorial button to help page"
```

---

## Task 12: Manual Integration Test

**Steps:**

1. **Start local dev servers** (frontend on 3000, backend on 3001)
2. **Create a new test user** via sign-up flow
3. **Verify wizard triggers** on redirect to `/map`
4. **Complete wizard** — check all 4 screens render, selections save to Supabase
5. **Verify tour starts** after wizard — check each of the 9 steps:
   - Steps 1-4: Map page (welcome, search, sidebar, map click)
   - Step 5: Navigates to `/scores`
   - Step 6: Navigates to `/graphs`
   - Step 7: Navigates to `/markets/[slug]` (AI assessment highlighted)
   - Step 8: Navigates to `/reports`
   - Step 9: Completion modal
6. **Verify skip behavior** — dismiss mid-tour, confirm tour doesn't appear on next login
7. **Verify restart** — go to `/help`, click "Restart Tutorial", confirm tour triggers again
8. **Check Supabase** — verify `onboarding_completed_at`, `user_type`, `investment_goal`, `experience_level`, `preferred_markets` columns are populated

**Step 2: Commit final verification note**

```bash
git add -A && git commit -m "feat(onboarding): complete onboarding tutorial system"
```

---

## Summary

| Task | Description                                | Est. Complexity |
| ---- | ------------------------------------------ | --------------- |
| 1    | Database migration (5 columns)             | Low             |
| 2    | Data layer fetchers                        | Low             |
| 3    | useTourState hook                          | Low             |
| 4    | Tour step definitions                      | Low             |
| 5    | Tour overlay (spotlight)                   | Medium          |
| 6    | Tour tooltip (M3 styled)                   | Medium          |
| 7    | Welcome wizard (4 screens + market search) | High            |
| 8    | TourProvider (orchestration)               | High            |
| 9    | Wire into app providers                    | Low             |
| 10   | Add data-tour attributes to pages          | Low             |
| 11   | Help page restart button                   | Low             |
| 12   | Manual integration test                    | Medium          |
