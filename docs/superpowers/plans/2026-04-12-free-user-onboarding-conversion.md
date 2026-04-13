# Free-User Onboarding & Conversion System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the passive 9-step onboarding tour with a 4-step action-gated guided flow, add a 14-day reverse trial for all signups, and build conversion infrastructure (personalized paywalls, celebrations, beacons, social proof, behavioral emails).

**Architecture:** Hybrid onboarding flow — `/get-started` route for persona + search, then spotlight overlay on real pages (`/market`, `/reports`) for interactive steps. Reverse trial leverages the existing `user_trials` + `trial_config` infrastructure. Behavioral emails replace the calendar-based drip. All new UI follows M3 design system with PropertyIQ brand palette.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind 4, NestJS 11, Supabase (PostgreSQL), Redis (ioredis), React Query 5, Resend (email), canvas-confetti (celebrations)

**Spec:** `docs/superpowers/specs/2026-04-12-free-user-onboarding-conversion-design.md`

---

## File Structure

### New Files

```
packages/frontend/
  app/get-started/
    page.tsx                          # /get-started route — persona + search
    PersonaCards.tsx                   # "What brings you here?" card grid
    OnboardingSearch.tsx               # Search bar with personalized placeholder
  app/onboarding/
    BreathingSpotlight.tsx             # Replaces TourOverlay — animated spotlight
    ConnectedTooltip.tsx               # Replaces TourTooltip — arrow + spring animation
    OnboardingProgressBar.tsx          # Thin gradient progress bar
    onboarding-steps.ts               # 4 action-gated step definitions (replaces tour-steps.ts)
    celebrations.ts                    # Confetti + score animation utilities
  app/dashboard/
    components/
      SampleReportCard.tsx             # Post-trial sample report teaser
      ProgressChecklist.tsx            # Persistent 5-item checklist widget
  app/components/
    beacons/
      Beacon.tsx                       # Pulsing dot + tooltip on hover
      BeaconProvider.tsx               # Context for beacon state + trigger logic
    social-proof/
      SocialProofBadge.tsx             # "1,247 investors tracking Austin" display
    paywall/
      PersonalizedPaywall.tsx          # Dynamic usage-stats upgrade modal
  lib/data/fetchers/
    usage-stats.ts                     # Frontend fetcher for usage stats
    social-proof.ts                    # Frontend fetcher for social proof data

packages/backend/
  src/
    onboarding/
      onboarding.module.ts             # NestJS module for onboarding
      onboarding.service.ts            # Auto-start trial, track checklist, etc.
      onboarding.controller.ts         # Endpoints: POST /api/onboarding/start-trial, etc.
    email/
      behavioral-trigger.service.ts    # Event-driven email trigger service
    social-proof/
      social-proof.module.ts           # NestJS module
      social-proof.service.ts          # Aggregation cron + query
      social-proof.controller.ts       # GET /api/analytics/social-proof/:geoLevel/:geoId

packages/emails/emails/
  behavioral-welcome.tsx               # Welcome + guided flow reminder
  behavioral-inactive.tsx              # Trending markets for inactive users
  behavioral-explorer.tsx              # Investor education for active explorers
  behavioral-paywall-hit.tsx           # Personalized feature email
  behavioral-trial-warning.tsx         # Trial expiring (Day 10 + Day 13)
  behavioral-trial-expired.tsx         # Trial ended + free report reminder
  behavioral-post-trial.tsx            # Free report credit reminder (Day 21)
```

### Modified Files

```
packages/frontend/
  app/onboarding/TourProvider.tsx       # Refactored: new phases, action-gated steps
  app/onboarding/useTourState.ts        # Extended: new fields (onboarding_market, checklist)
  app/dashboard/page.tsx                # Add SampleReportCard + ProgressChecklist
  app/market/[id]/components/ScoreColumn.tsx  # Add data-tour attribute
  app/providers.tsx                     # Add BeaconProvider
  lib/data/fetchers/onboarding.ts       # Extended: new state fields
  lib/entitlements/EntitlementsContext.tsx  # Consume trial.daysRemaining for badge
  src/components/layout/Header.tsx      # Add trial countdown badge
  middleware.ts                         # Add /get-started to PROTECTED_PREFIXES

packages/backend/
  src/entitlements/entitlements.module.ts  # Import OnboardingModule
  src/email/drip.service.ts               # Disable calendar drip for trial users
  src/email/email.module.ts               # Register BehavioralTriggerService
```

---

## Task 1: Database Migration — New Columns and Tables

**Files:**

- Create: `scripts/migrations/120-onboarding-conversion-schema.sql`

This migration adds columns to `user_profiles` for tracking onboarding state, and creates two new tables for social proof and email triggers.

- [ ] **Step 1: Write the migration SQL**

```sql
-- scripts/migrations/120-onboarding-conversion-schema.sql
-- Onboarding & Conversion System Schema Changes

-- ─── user_profiles: new columns ───
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_market JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS onboarding_checklist JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dismissed_beacons JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS usage_stats JSONB DEFAULT '{"markets_viewed":0,"scores_checked":0,"reports_generated":0}'::jsonb,
  ADD COLUMN IF NOT EXISTS free_report_credits INTEGER DEFAULT 1;

COMMENT ON COLUMN user_profiles.onboarding_market IS 'Market selected during guided onboarding: {geoLevel, geoId, name}';
COMMENT ON COLUMN user_profiles.onboarding_checklist IS 'Array of completed checklist task IDs';
COMMENT ON COLUMN user_profiles.dismissed_beacons IS 'Array of dismissed beacon IDs';
COMMENT ON COLUMN user_profiles.usage_stats IS 'Aggregated usage counters for personalized paywall';
COMMENT ON COLUMN user_profiles.free_report_credits IS 'Remaining free report credits post-trial (default 1)';

-- ─── market_engagement_stats: social proof aggregation ───
CREATE TABLE IF NOT EXISTS market_engagement_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_level TEXT NOT NULL,
  geo_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  view_count INTEGER DEFAULT 0,
  score_check_count INTEGER DEFAULT 0,
  report_count INTEGER DEFAULT 0,
  tracking_user_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (geo_level, geo_id, date)
);

CREATE INDEX idx_engagement_stats_geo ON market_engagement_stats (geo_level, geo_id, date DESC);

-- RLS
ALTER TABLE market_engagement_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read engagement stats"
  ON market_engagement_stats FOR SELECT TO authenticated USING (true);
GRANT SELECT ON market_engagement_stats TO authenticated;
GRANT ALL ON market_engagement_stats TO service_role;

-- ─── email_triggers: behavioral email dedup ───
CREATE TABLE IF NOT EXISTS email_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  trigger_name TEXT NOT NULL,
  fired_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE (user_id, trigger_name)
);

CREATE INDEX idx_email_triggers_user ON email_triggers (user_id);

ALTER TABLE email_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only for email_triggers"
  ON email_triggers FOR ALL TO service_role USING (true);
GRANT ALL ON email_triggers TO service_role;
```

- [ ] **Step 2: Run the migration**

```bash
cd packages/backend
npx supabase db push --db-url "$DATABASE_URL" < ../../scripts/migrations/120-onboarding-conversion-schema.sql
```

Verify columns exist:

```bash
npx supabase db push --db-url "$DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name IN ('onboarding_market', 'onboarding_checklist', 'dismissed_beacons', 'usage_stats', 'free_report_credits');"
```

Expected: 5 rows returned.

- [ ] **Step 3: Enable trial_config**

The `trial_config` table already exists with `is_enabled = false`, `duration_days = 14`, `trial_tier = 'pro'`. Enable it:

```sql
UPDATE trial_config SET is_enabled = true, show_banner = true WHERE id = (SELECT id FROM trial_config LIMIT 1);
```

- [ ] **Step 4: Commit**

```bash
git add scripts/migrations/120-onboarding-conversion-schema.sql
git commit -m "feat(db): add onboarding conversion schema �� user_profiles columns, engagement stats, email triggers"
```

---

## Task 2: Auto-Start Reverse Trial on Signup

**Files:**

- Create: `packages/backend/src/onboarding/onboarding.module.ts`
- Create: `packages/backend/src/onboarding/onboarding.service.ts`
- Create: `packages/backend/src/onboarding/onboarding.controller.ts`
- Modify: `packages/backend/src/app.module.ts` (import OnboardingModule)

The existing `TrialService.startTrial()` inserts into `user_trials` and is admin-guarded. We need a public endpoint that authenticated users can call once (during the guided flow) to auto-start their trial.

- [ ] **Step 1: Write the test for OnboardingService**

```typescript
// packages/backend/src/onboarding/onboarding.service.spec.ts
import { Test, TestingModule } from "@nestjs/testing";
import { OnboardingService } from "./onboarding.service";
import { SUPABASE_CLIENT } from "../supabase/supabase.service";

describe("OnboardingService", () => {
  let service: OnboardingService;
  const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: SUPABASE_CLIENT, useValue: mockSupabase },
      ],
    }).compile();
    service = module.get(OnboardingService);
    jest.clearAllMocks();
  });

  describe("ensureTrialStarted", () => {
    it("should start trial if no active trial exists", async () => {
      // No existing trial
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });
      // trial_config
      mockSupabase.single.mockResolvedValueOnce({
        data: { duration_days: 14, trial_tier: "pro", is_enabled: true },
        error: null,
      });
      // insert trial
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: "trial-1",
          user_id: "user-1",
          tier: "pro",
          expires_at: "2026-04-26T00:00:00Z",
        },
        error: null,
      });

      const result = await service.ensureTrialStarted("user-1");
      expect(result).toEqual(expect.objectContaining({ tier: "pro" }));
    });

    it("should return existing trial if one is active", async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: {
          id: "trial-1",
          tier: "pro",
          expires_at: "2026-04-26T00:00:00Z",
        },
        error: null,
      });

      const result = await service.ensureTrialStarted("user-1");
      expect(result).toEqual(expect.objectContaining({ tier: "pro" }));
    });
  });

  describe("saveOnboardingMarket", () => {
    it("should save market to user_profiles", async () => {
      mockSupabase.eq.mockResolvedValueOnce({ error: null });

      await service.saveOnboardingMarket("user-1", {
        geoLevel: "metro",
        geoId: "12420",
        name: "Austin, TX",
      });

      expect(mockSupabase.from).toHaveBeenCalledWith("user_profiles");
    });
  });

  describe("incrementUsageStat", () => {
    it("should increment the specified stat", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          usage_stats: {
            markets_viewed: 3,
            scores_checked: 0,
            reports_generated: 0,
          },
        },
        error: null,
      });
      mockSupabase.eq.mockResolvedValueOnce({ error: null });

      await service.incrementUsageStat("user-1", "markets_viewed");

      expect(mockSupabase.from).toHaveBeenCalledWith("user_profiles");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/backend && npx jest src/onboarding/onboarding.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './onboarding.service'`

- [ ] **Step 3: Implement OnboardingService**

```typescript
// packages/backend/src/onboarding/onboarding.service.ts
import { Injectable, Inject, Logger } from "@nestjs/common";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase.service";

export interface OnboardingMarket {
  geoLevel: string;
  geoId: string;
  name: string;
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Ensure the user has an active reverse trial. If one already exists, return it.
   * If not, create a new one using trial_config settings.
   */
  async ensureTrialStarted(userId: string) {
    // Check for existing active trial
    const { data: existing } = await this.supabase
      .from("user_trials")
      .select("id, tier, expires_at")
      .eq("user_id", userId)
      .is("converted_at", null)
      .is("cancelled_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (existing) {
      this.logger.debug(`User ${userId} already has active trial`);
      return existing;
    }

    // Get trial config
    const { data: config } = await this.supabase
      .from("trial_config")
      .select("duration_days, trial_tier, is_enabled")
      .single();

    if (!config?.is_enabled) {
      this.logger.warn("Trial system is disabled in trial_config");
      return null;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.duration_days);

    const { data: trial, error } = await this.supabase
      .from("user_trials")
      .insert({
        user_id: userId,
        tier: config.trial_tier,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      // UNIQUE constraint violation = trial already exists (race condition)
      if (error.code === "23505") {
        this.logger.debug(
          `Trial already exists for ${userId} (race condition)`,
        );
        const { data: raced } = await this.supabase
          .from("user_trials")
          .select("id, tier, expires_at")
          .eq("user_id", userId)
          .is("converted_at", null)
          .is("cancelled_at", null)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        return raced;
      }
      this.logger.error(
        `Failed to start trial for ${userId}: ${error.message}`,
      );
      return null;
    }

    this.logger.log(
      `Started ${config.duration_days}-day ${config.trial_tier} trial for ${userId}`,
    );
    return trial;
  }

  async saveOnboardingMarket(userId: string, market: OnboardingMarket) {
    await this.supabase
      .from("user_profiles")
      .update({ onboarding_market: market })
      .eq("id", userId);
  }

  async updateChecklist(userId: string, completedTaskId: string) {
    const { data } = await this.supabase
      .from("user_profiles")
      .select("onboarding_checklist")
      .eq("id", userId)
      .single();

    const current: string[] = data?.onboarding_checklist ?? [];
    if (current.includes(completedTaskId)) return;

    await this.supabase
      .from("user_profiles")
      .update({ onboarding_checklist: [...current, completedTaskId] })
      .eq("id", userId);
  }

  async incrementUsageStat(
    userId: string,
    stat: "markets_viewed" | "scores_checked" | "reports_generated",
  ) {
    const { data } = await this.supabase
      .from("user_profiles")
      .select("usage_stats")
      .eq("id", userId)
      .single();

    const stats = data?.usage_stats ?? {
      markets_viewed: 0,
      scores_checked: 0,
      reports_generated: 0,
    };
    stats[stat] = (stats[stat] || 0) + 1;

    await this.supabase
      .from("user_profiles")
      .update({ usage_stats: stats })
      .eq("id", userId);
  }

  async dismissBeacon(userId: string, beaconId: string) {
    const { data } = await this.supabase
      .from("user_profiles")
      .select("dismissed_beacons")
      .eq("id", userId)
      .single();

    const current: string[] = data?.dismissed_beacons ?? [];
    if (current.includes(beaconId)) return;

    await this.supabase
      .from("user_profiles")
      .update({ dismissed_beacons: [...current, beaconId] })
      .eq("id", userId);
  }

  async getUsageStats(userId: string) {
    const { data } = await this.supabase
      .from("user_profiles")
      .select(
        "usage_stats, onboarding_checklist, dismissed_beacons, onboarding_market, free_report_credits",
      )
      .eq("id", userId)
      .single();

    return data;
  }
}
```

- [ ] **Step 4: Create OnboardingController**

```typescript
// packages/backend/src/onboarding/onboarding.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  UseGuards,
  Param,
} from "@nestjs/common";
import { OnboardingService, OnboardingMarket } from "./onboarding.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("api/onboarding")
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post("start-trial")
  async startTrial(@Headers("x-user-id") userId: string) {
    const trial = await this.onboardingService.ensureTrialStarted(userId);
    return { success: true, data: trial };
  }

  @Post("save-market")
  async saveMarket(
    @Headers("x-user-id") userId: string,
    @Body() market: OnboardingMarket,
  ) {
    await this.onboardingService.saveOnboardingMarket(userId, market);
    return { success: true };
  }

  @Post("checklist/:taskId")
  async completeChecklistTask(
    @Headers("x-user-id") userId: string,
    @Param("taskId") taskId: string,
  ) {
    await this.onboardingService.updateChecklist(userId, taskId);
    return { success: true };
  }

  @Post("usage/:stat")
  async incrementUsage(
    @Headers("x-user-id") userId: string,
    @Param("stat")
    stat: "markets_viewed" | "scores_checked" | "reports_generated",
  ) {
    await this.onboardingService.incrementUsageStat(userId, stat);
    return { success: true };
  }

  @Post("beacon/:beaconId/dismiss")
  async dismissBeacon(
    @Headers("x-user-id") userId: string,
    @Param("beaconId") beaconId: string,
  ) {
    await this.onboardingService.dismissBeacon(userId, beaconId);
    return { success: true };
  }

  @Get("state")
  async getState(@Headers("x-user-id") userId: string) {
    const data = await this.onboardingService.getUsageStats(userId);
    return { success: true, data };
  }
}
```

- [ ] **Step 5: Create OnboardingModule and register**

```typescript
// packages/backend/src/onboarding/onboarding.module.ts
import { Module } from "@nestjs/common";
import { OnboardingService } from "./onboarding.service";
import { OnboardingController } from "./onboarding.controller";
import { SupabaseModule } from "../supabase/supabase.module";

@Module({
  imports: [SupabaseModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
```

Add to `app.module.ts` imports array:

```typescript
// In packages/backend/src/app.module.ts — add to imports array
import { OnboardingModule } from "./onboarding/onboarding.module";
// ... in @Module({ imports: [ ..., OnboardingModule ] })
```

- [ ] **Step 6: Run tests and verify**

```bash
cd packages/backend && npx jest src/onboarding/onboarding.service.spec.ts --no-coverage
```

Expected: All 3 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/src/onboarding/
git commit -m "feat(backend): add onboarding service — auto-start reverse trial, usage tracking, checklist"
```

---

## Task 3: Trial Countdown Badge in Navigation

**Files:**

- Modify: `packages/frontend/src/components/layout/Header.tsx`
- Create: `packages/frontend/src/components/layout/TrialBadge.tsx`

- [ ] **Step 1: Create TrialBadge component**

```tsx
// packages/frontend/src/components/layout/TrialBadge.tsx
"use client";

import { useEntitlements } from "@/lib/entitlements";

export function TrialBadge() {
  const { trial } = useEntitlements();

  if (!trial?.active || trial.daysRemaining == null) return null;

  const urgency =
    trial.daysRemaining <= 3
      ? "bg-error/10 text-error"
      : trial.daysRemaining <= 7
        ? "bg-warning/10 text-warning"
        : "bg-primary/10 text-primary";

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${urgency} transition-colors duration-200`}
    >
      <span className="font-mono">{trial.daysRemaining}d</span>
      <span className="hidden sm:inline">Pro Trial</span>
    </span>
  );
}
```

- [ ] **Step 2: Add TrialBadge to Header**

In `packages/frontend/src/components/layout/Header.tsx`, find the right side of the header bar (near the user profile button) and add the badge. Look for the section that renders user actions (sign in / profile). Add `<TrialBadge />` before the profile button:

```tsx
import { TrialBadge } from "./TrialBadge";

// Inside the header JSX, in the right-side actions area:
<TrialBadge />;
```

- [ ] **Step 3: Verify in browser**

```bash
cd packages/frontend && npm run dev
```

Navigate to the app while authenticated with a trial user. The badge should appear with the countdown.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/src/components/layout/TrialBadge.tsx packages/frontend/src/components/layout/Header.tsx
git commit -m "feat(ui): add trial countdown badge to navigation header"
```

---

## Task 4: BreathingSpotlight Component

**Files:**

- Create: `packages/frontend/app/onboarding/BreathingSpotlight.tsx`

Replaces `TourOverlay.tsx`. Uses `backdrop-filter: blur` instead of hard black, adds pulsing glow animation, and smoothly morphs between targets.

- [ ] **Step 1: Create BreathingSpotlight**

```tsx
// packages/frontend/app/onboarding/BreathingSpotlight.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius: number;
}

interface BreathingSpotlightProps {
  targetSelector: string | null;
  visible: boolean;
  onClick?: () => void;
}

const PADDING = 12;

export function BreathingSpotlight({
  targetSelector,
  visible,
  onClick,
}: BreathingSpotlightProps) {
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const prevRect = useRef<SpotlightRect | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const measureTarget = useCallback(() => {
    if (!targetSelector) {
      setSpotlight(null);
      return;
    }

    const el = document.querySelector(targetSelector);
    if (!el) {
      setSpotlight(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    const computed = getComputedStyle(el);
    const br = parseFloat(computed.borderRadius) || 12;

    const next: SpotlightRect = {
      top: rect.top - PADDING,
      left: rect.left - PADDING,
      width: rect.width + PADDING * 2,
      height: rect.height + PADDING * 2,
      borderRadius: br + 4,
    };

    prevRect.current = next;
    setSpotlight(next);

    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [targetSelector]);

  useEffect(() => {
    if (!visible) return;

    measureTarget();
    const rafId = requestAnimationFrame(measureTarget);
    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);

    let pollInterval: ReturnType<typeof setInterval> | null = null;
    if (targetSelector) {
      let attempts = 0;
      pollInterval = setInterval(() => {
        attempts++;
        const el = document.querySelector(targetSelector);
        if (el || attempts > 20) {
          if (el) measureTarget();
          if (pollInterval) clearInterval(pollInterval);
        }
      }, 200);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [visible, targetSelector, measureTarget]);

  if (!visible) return null;

  // Full-screen dimmed backdrop when no target
  if (!spotlight) {
    return (
      <div
        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm transition-opacity duration-400"
        onClick={onClick}
      />
    );
  }

  return (
    <>
      {/* SVG mask: transparent cutout over blurred backdrop */}
      <svg
        ref={svgRef}
        className="fixed inset-0 z-[9998] w-full h-full pointer-events-none"
        style={{ backdropFilter: "blur(3px)" }}
      >
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={spotlight.left}
              y={spotlight.top}
              width={spotlight.width}
              height={spotlight.height}
              rx={spotlight.borderRadius}
              fill="black"
              className="transition-all duration-400 ease-[cubic-bezier(0.4,0,0.2,1)]"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.45)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Pulsing glow ring */}
      <div
        className="fixed z-[9998] pointer-events-none animate-[breathe_2s_ease-in-out_infinite]"
        style={{
          top: spotlight.top - 4,
          left: spotlight.left - 4,
          width: spotlight.width + 8,
          height: spotlight.height + 8,
          borderRadius: spotlight.borderRadius + 4,
          boxShadow:
            "0 0 20px 4px rgba(57,73,171,0.3), 0 0 40px 8px rgba(57,73,171,0.15)",
          transition: "all 400ms cubic-bezier(0.4,0,0.2,1)",
        }}
      />

      {/* Click handler overlay (everything except the spotlight) */}
      <div
        className="fixed inset-0 z-[9998] cursor-pointer"
        onClick={onClick}
        style={{
          clipPath: `polygon(
            0% 0%, 100% 0%, 100% 100%, 0% 100%,
            0% ${spotlight.top}px,
            ${spotlight.left}px ${spotlight.top}px,
            ${spotlight.left}px ${spotlight.top + spotlight.height}px,
            0% ${spotlight.top + spotlight.height}px
          )`,
        }}
      />

      {/* Global breathe keyframe (injected once) */}
      <style>{`
        @keyframes breathe {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
        }
      `}</style>
    </>
  );
}
```

- [ ] **Step 2: Verify renders without errors**

```bash
cd packages/frontend && npx tsc --noEmit --pretty 2>&1 | head -20
```

Expected: No errors in `BreathingSpotlight.tsx`.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/onboarding/BreathingSpotlight.tsx
git commit -m "feat(ui): add BreathingSpotlight component — animated backdrop-blur spotlight with glow"
```

---

## Task 5: ConnectedTooltip Component

**Files:**

- Create: `packages/frontend/app/onboarding/ConnectedTooltip.tsx`

Replaces `TourTooltip.tsx`. Adds a pointer arrow, spring entrance animation, and action-oriented copy. Supports action-gated mode (no Next button).

- [ ] **Step 1: Create ConnectedTooltip**

```tsx
// packages/frontend/app/onboarding/ConnectedTooltip.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import type { OnboardingStep } from "./onboarding-steps";

interface ConnectedTooltipProps {
  step: OnboardingStep;
  currentIndex: number;
  totalSteps: number;
  onDismiss: () => void;
}

interface Position {
  top: number;
  left: number;
  arrowSide: "top" | "bottom" | "left" | "right";
}

const TOOLTIP_WIDTH = 360;
const GAP = 16;
const ARROW_SIZE = 8;

export function ConnectedTooltip({
  step,
  currentIndex,
  totalSteps,
  onDismiss,
}: ConnectedTooltipProps) {
  const [position, setPosition] = useState<Position | null>(null);
  const [show, setShow] = useState(false);
  const [showDismiss, setShowDismiss] = useState(false);
  const isCentered = step.placement === "center" || !step.targetSelector;

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
    const tooltipHeight = 160;
    let top = 0;
    let left = 0;
    let arrowSide: Position["arrowSide"] = "top";

    switch (step.placement) {
      case "bottom":
        top = rect.bottom + GAP + ARROW_SIZE;
        left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
        arrowSide = "top";
        break;
      case "top":
        top = rect.top - tooltipHeight - GAP - ARROW_SIZE;
        left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
        arrowSide = "bottom";
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + GAP + ARROW_SIZE;
        arrowSide = "left";
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - TOOLTIP_WIDTH - GAP - ARROW_SIZE;
        arrowSide = "right";
        break;
    }

    // Clamp to viewport
    left = Math.max(16, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));

    setPosition({ top, left, arrowSide });
  }, [step, isCentered]);

  useEffect(() => {
    calculatePosition();
    const rafId = requestAnimationFrame(calculatePosition);
    window.addEventListener("resize", calculatePosition);
    window.addEventListener("scroll", calculatePosition, true);

    // Spring entrance delay
    const showTimer = setTimeout(() => setShow(true), 50);

    // "Do this later" appears after 10s
    const dismissTimer = setTimeout(() => setShowDismiss(true), 10000);

    // Poll for target
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    if (!isCentered && step.targetSelector) {
      let attempts = 0;
      pollInterval = setInterval(() => {
        attempts++;
        const el = document.querySelector(step.targetSelector!);
        if (el || attempts > 20) {
          if (el) calculatePosition();
          if (pollInterval) clearInterval(pollInterval);
        }
      }, 200);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", calculatePosition);
      window.removeEventListener("scroll", calculatePosition, true);
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [calculatePosition, isCentered, step.targetSelector]);

  const arrowStyles: Record<string, string> = {
    top: "left-1/2 -translate-x-1/2 -top-2 border-b-[var(--surface-container-high)] border-l-transparent border-r-transparent border-t-transparent",
    bottom:
      "left-1/2 -translate-x-1/2 -bottom-2 border-t-[var(--surface-container-high)] border-l-transparent border-r-transparent border-b-transparent",
    left: "top-1/2 -translate-y-1/2 -left-2 border-r-[var(--surface-container-high)] border-t-transparent border-b-transparent border-l-transparent",
    right:
      "top-1/2 -translate-y-1/2 -right-2 border-l-[var(--surface-container-high)] border-t-transparent border-b-transparent border-r-transparent",
  };

  const springTransform = show
    ? "scale(1) translateY(0)"
    : "scale(0.95) translateY(8px)";

  const content = (
    <div className="relative">
      <h3 className="text-lg font-medium text-on-surface mb-1.5">
        {step.title}
      </h3>
      <p className="text-sm text-on-surface-variant leading-relaxed mb-4">
        {step.body}
      </p>

      <div className="flex items-center justify-between">
        {/* Progress bar (not dots) */}
        <div className="flex-1 mr-4">
          <div className="h-[3px] bg-outline-variant/30 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-400 ease-out"
              style={{
                width: `${((currentIndex + 1) / totalSteps) * 100}%`,
                background: "linear-gradient(90deg, var(--primary), #00c853)",
              }}
            />
          </div>
        </div>

        {/* "Do this later" — appears after 10s, replaces "Skip" */}
        {showDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs text-on-surface-variant/60 hover:text-on-surface-variant transition-colors duration-200"
          >
            Do this later
          </button>
        )}
      </div>
    </div>
  );

  if (isCentered) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
        <div
          className="max-w-sm w-full mx-4 pointer-events-auto bg-surface-container-high rounded-[28px] shadow-lg p-8"
          style={{
            transform: springTransform,
            opacity: show ? 1 : 0,
            transition:
              "transform 400ms cubic-bezier(0.34,1.56,0.64,1), opacity 300ms ease-out",
          }}
        >
          {content}
        </div>
      </div>
    );
  }

  if (!position) return null;

  return (
    <div
      className="fixed z-[9999] pointer-events-auto bg-surface-container-high rounded-2xl shadow-lg p-5"
      style={{
        top: position.top,
        left: position.left,
        width: TOOLTIP_WIDTH,
        transform: springTransform,
        opacity: show ? 1 : 0,
        transition:
          "transform 400ms cubic-bezier(0.34,1.56,0.64,1), opacity 300ms ease-out",
      }}
    >
      {/* Arrow */}
      <div
        className={`absolute w-0 h-0 border-[8px] ${arrowStyles[position.arrowSide]}`}
      />
      {content}
    </div>
  );
}
```

- [ ] **Step 2: Verify type-checks**

```bash
cd packages/frontend && npx tsc --noEmit --pretty 2>&1 | grep -i "connectedtooltip\|onboarding-steps" | head -10
```

This will initially fail because `onboarding-steps.ts` doesn't exist yet. That's expected — it's created in Task 7.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/onboarding/ConnectedTooltip.tsx
git commit -m "feat(ui): add ConnectedTooltip component — pointer arrow, spring animation, action-gated"
```

---

## Task 6: Onboarding Step Definitions + Progress Bar

**Files:**

- Create: `packages/frontend/app/onboarding/onboarding-steps.ts`
- Create: `packages/frontend/app/onboarding/OnboardingProgressBar.tsx`
- Create: `packages/frontend/app/onboarding/celebrations.ts`

- [ ] **Step 1: Define onboarding step types and steps**

```typescript
// packages/frontend/app/onboarding/onboarding-steps.ts

export interface OnboardingStep {
  id: string;
  route: string | null;
  targetSelector: string | null;
  title: string;
  body: string;
  placement: "top" | "bottom" | "left" | "right" | "center";
  /** If set, user must interact with this selector to advance (no Next button) */
  actionSelector?: string;
  /** Event name that triggers advancement (e.g., "click", "submit") */
  actionEvent?: string;
  /** Persona-specific body text overrides */
  personaBody?: Record<string, string>;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "persona-search",
    route: "/get-started",
    targetSelector: null,
    title: "Let's find your first market",
    body: "Search for a city, metro, or ZIP you're interested in.",
    placement: "center",
  },
  {
    id: "view-score",
    route: null, // Dynamic — set by TourProvider from onboarding_market
    targetSelector: '[data-tour="propertyiq-score"]',
    title: "Your market's PropertyIQ Score",
    body: "This score measures market demand relative to the state average. Higher is stronger.",
    placement: "right",
    actionSelector: '[data-tour="propertyiq-score"]',
    actionEvent: "click",
    personaBody: {
      investor:
        "This is your investment signal — higher scores mean stronger demand and competition.",
      homebuyer:
        "This shows market opportunity — how competitive this area is for buyers right now.",
      agent:
        "Use this score to identify hot markets and advise your clients on timing.",
    },
  },
  {
    id: "generate-report",
    route: "/reports",
    targetSelector: '[data-tour="reports-generate-btn"]',
    title: "Generate your free AI report",
    body: "Get a detailed market analysis powered by PropertyIQ's AI — scores, trends, and insights.",
    placement: "bottom",
    actionSelector: '[data-tour="reports-generate-btn"]',
    actionEvent: "click",
  },
  {
    id: "upgrade-cta",
    route: null,
    targetSelector: null,
    title: "You're set up with Pro access",
    body: "You have 14 days of full Pro — unlimited reports, ZIP-level data, market alerts, and AI chat. Explore everything.",
    placement: "center",
  },
];
```

- [ ] **Step 2: Create OnboardingProgressBar**

```tsx
// packages/frontend/app/onboarding/OnboardingProgressBar.tsx
"use client";

interface OnboardingProgressBarProps {
  currentStep: number;
  totalSteps: number;
  visible: boolean;
}

export function OnboardingProgressBar({
  currentStep,
  totalSteps,
  visible,
}: OnboardingProgressBarProps) {
  if (!visible) return null;

  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="fixed top-0 left-0 right-0 z-[10000] h-[3px]">
      <div
        className="h-full rounded-r-full transition-all duration-600 ease-out"
        style={{
          width: `${progress}%`,
          background: "linear-gradient(90deg, var(--primary), #00c853)",
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Create celebration utilities**

```typescript
// packages/frontend/app/onboarding/celebrations.ts

/**
 * Trigger a confetti burst at the center of the viewport.
 * Uses canvas-confetti (must be installed: npm i canvas-confetti).
 */
export async function triggerConfetti() {
  const confetti = (await import("canvas-confetti")).default;
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#3949ab", "#5c6bc0", "#00c853", "#c5cae9"],
    disableForReducedMotion: true,
  });
}

/**
 * Animate a score counter from 0 to target value.
 * Returns a cleanup function.
 */
export function animateScoreCounter(
  element: HTMLElement,
  target: number,
  durationMs = 600,
): () => void {
  const start = performance.now();
  let rafId: number;

  const tick = (now: number) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / durationMs, 1);
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(eased * target);
    element.textContent = String(current);

    if (progress < 1) {
      rafId = requestAnimationFrame(tick);
    }
  };

  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}
```

- [ ] **Step 4: Install canvas-confetti**

```bash
cd packages/frontend && npm install canvas-confetti && npm install -D @types/canvas-confetti
```

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/app/onboarding/onboarding-steps.ts packages/frontend/app/onboarding/OnboardingProgressBar.tsx packages/frontend/app/onboarding/celebrations.ts packages/frontend/package.json packages/frontend/package-lock.json
git commit -m "feat(ui): add onboarding step definitions, progress bar, and celebration utilities"
```

---

## Task 7: /get-started Page

**Files:**

- Create: `packages/frontend/app/get-started/page.tsx`
- Create: `packages/frontend/app/get-started/PersonaCards.tsx`
- Create: `packages/frontend/app/get-started/OnboardingSearch.tsx`
- Modify: `packages/frontend/middleware.ts` (add to PROTECTED_PREFIXES)

- [ ] **Step 1: Create PersonaCards component**

```tsx
// packages/frontend/app/get-started/PersonaCards.tsx
"use client";

import { useState } from "react";

const PERSONAS = [
  {
    value: "homebuyer",
    label: "First-time Homebuyer",
    icon: "🏠",
    searchPlaceholder: "Search for a city you'd like to live in...",
  },
  {
    value: "investor",
    label: "Real Estate Investor",
    icon: "📈",
    searchPlaceholder: "Search for your first investment market...",
  },
  {
    value: "agent",
    label: "Agent / Broker",
    icon: "🤝",
    searchPlaceholder: "Search for your farm area...",
  },
  {
    value: "researcher",
    label: "Market Researcher",
    icon: "🔍",
    searchPlaceholder: "Search for any market to analyze...",
  },
] as const;

interface PersonaCardsProps {
  onSelect: (persona: string, placeholder: string) => void;
}

export function PersonaCards({ onSelect }: PersonaCardsProps) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-6 text-center">
      <div>
        <h1 className="text-3xl font-light text-on-surface">
          What brings you here?
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          We'll tailor your experience
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
        {PERSONAS.map((p) => (
          <button
            key={p.value}
            onClick={() => {
              setSelected(p.value);
              onSelect(p.value, p.searchPlaceholder);
            }}
            className={`rounded-xl border-2 p-5 text-center transition-all duration-200 ${
              selected === p.value
                ? "border-primary bg-primary/8 scale-[1.02]"
                : "border-outline-variant bg-surface hover:border-outline hover:scale-[1.01]"
            }`}
          >
            <span className="text-3xl block" role="img" aria-label={p.label}>
              {p.icon}
            </span>
            <span className="mt-2 text-sm font-medium text-on-surface block">
              {p.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create OnboardingSearch component**

```tsx
// packages/frontend/app/get-started/OnboardingSearch.tsx
"use client";

import { useRef, useEffect } from "react";
import { SearchWidget } from "@/app/map/components/SearchWidget";

interface OnboardingSearchProps {
  placeholder: string;
  onMarketSelect: (market: {
    geoLevel: string;
    geoId: string;
    name: string;
  }) => void;
}

export function OnboardingSearch({
  placeholder,
  onMarketSelect,
}: OnboardingSearchProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus the search input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const input = containerRef.current?.querySelector("input");
      input?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-4 text-center animate-[fadeIn_400ms_ease-out]">
      <h2 className="text-xl font-light text-on-surface">Find your market</h2>

      <div ref={containerRef} className="max-w-lg mx-auto">
        <SearchWidget
          placeholder={placeholder}
          onSelect={(result) => {
            onMarketSelect({
              geoLevel: result.type || "metro",
              geoId: result.id,
              name: result.name,
            });
          }}
          autoFocus
        />
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 3: Create /get-started page**

```tsx
// packages/frontend/app/get-started/page.tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { PersonaCards } from "./PersonaCards";
import { OnboardingSearch } from "./OnboardingSearch";
import { saveOnboardingPreferences } from "@/lib/data/fetchers/onboarding";

type Phase = "persona" | "search";

export default function GetStartedPage() {
  const [phase, setPhase] = useState<Phase>("persona");
  const [searchPlaceholder, setSearchPlaceholder] = useState(
    "Search for a city...",
  );
  const { user } = useAuth();
  const router = useRouter();

  const handlePersonaSelect = useCallback(
    async (persona: string, placeholder: string) => {
      // Save user_type to profile
      await saveOnboardingPreferences({ user_type: persona });
      setSearchPlaceholder(placeholder);

      // Brief delay for visual feedback, then show search
      setTimeout(() => setPhase("search"), 300);
    },
    [],
  );

  const handleMarketSelect = useCallback(
    async (market: { geoLevel: string; geoId: string; name: string }) => {
      // Save onboarding market + start trial via backend
      const userId = user?.id;
      if (userId) {
        await fetch("/api/onboarding/save-market", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": userId,
          },
          body: JSON.stringify(market),
        });

        await fetch("/api/onboarding/start-trial", {
          method: "POST",
          headers: { "x-user-id": userId },
        });
      }

      // Navigate to market page — TourProvider takes over with spotlight
      router.push(
        `/market/${market.geoId}?type=${market.geoLevel}&onboarding=true`,
      );
    },
    [user, router],
  );

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {phase === "persona" && <PersonaCards onSelect={handlePersonaSelect} />}
        {phase === "search" && (
          <OnboardingSearch
            placeholder={searchPlaceholder}
            onMarketSelect={handleMarketSelect}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add /get-started to protected routes in middleware**

In `packages/frontend/middleware.ts`, find the `PROTECTED_PREFIXES` array and add `/get-started`:

```typescript
// Add to PROTECTED_PREFIXES array
"/get-started",
```

- [ ] **Step 5: Verify the page renders**

```bash
cd packages/frontend && npm run dev
```

Navigate to `http://localhost:3000/get-started` while authenticated. Verify:

1. Four persona cards appear
2. Clicking one transitions to search
3. Search placeholder matches persona

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/get-started/ packages/frontend/middleware.ts
git commit -m "feat: add /get-started page — persona selection + market search for onboarding"
```

---

## Task 8: Refactor TourProvider for Action-Gated Flow

**Files:**

- Modify: `packages/frontend/app/onboarding/TourProvider.tsx`
- Modify: `packages/frontend/app/onboarding/useTourState.ts`
- Modify: `packages/frontend/lib/data/fetchers/onboarding.ts`
- Modify: `packages/frontend/app/market/[id]/components/ScoreColumn.tsx` (add data-tour)

This is the most complex task. The TourProvider changes from a passive 9-step tour to a 4-step action-gated flow that integrates with `/get-started` and real product pages.

- [ ] **Step 1: Extend onboarding fetcher with new fields**

```typescript
// In packages/frontend/lib/data/fetchers/onboarding.ts
// Update the OnboardingState interface to include new fields:

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
  onboarding_market: {
    geoLevel: string;
    geoId: string;
    name: string;
  } | null;
  onboarding_checklist: string[];
  free_report_credits: number;
}

// Update the select in fetchOnboardingState():
// Change the .select() string to include new columns:
// "onboarding_completed_at, user_type, investment_goal, experience_level, preferred_markets, onboarding_market, onboarding_checklist, free_report_credits"
```

- [ ] **Step 2: Add data-tour attribute to ScoreColumn**

In `packages/frontend/app/market/[id]/components/ScoreColumn.tsx`, find the main score card wrapper `<motion.div>` and add:

```tsx
data-tour="propertyiq-score"
```

Also add to the reports Generate button in `packages/frontend/app/reports/page.tsx`, find the `<motion.button onClick={handleGenerate}...>` and add:

```tsx
data-tour="reports-generate-btn"
```

- [ ] **Step 3: Rewrite TourProvider**

Replace the contents of `packages/frontend/app/onboarding/TourProvider.tsx`:

```tsx
// packages/frontend/app/onboarding/TourProvider.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTourState } from "./useTourState";
import { ONBOARDING_STEPS } from "./onboarding-steps";
import type { OnboardingStep } from "./onboarding-steps";
import { BreathingSpotlight } from "./BreathingSpotlight";
import { ConnectedTooltip } from "./ConnectedTooltip";
import { OnboardingProgressBar } from "./OnboardingProgressBar";
import { triggerConfetti } from "./celebrations";

type TourPhase = "idle" | "guided";

interface TourContextValue {
  isActive: boolean;
  currentStep: OnboardingStep | null;
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
  const { onboardingState, isLoading, markComplete, resetTour } =
    useTourState();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<TourPhase>("idle");
  const [stepIndex, setStepIndex] = useState(1); // Start at 1 — step 0 is /get-started
  const [navigating, setNavigating] = useState(false);
  const actionListenerRef = useRef<(() => void) | null>(null);

  // Detect onboarding=true param (set by /get-started after market selection)
  useEffect(() => {
    if (searchParams?.get("onboarding") === "true" && phase === "idle") {
      setPhase("guided");
      setStepIndex(1); // Step 1: view-score
    }
  }, [searchParams, phase]);

  // Reset on signout
  useEffect(() => {
    if (!user && phase !== "idle") {
      setPhase("idle");
      setStepIndex(1);
    }
  }, [user, phase]);

  // Set up action listeners for action-gated steps
  useEffect(() => {
    // Clean up previous listener
    if (actionListenerRef.current) {
      actionListenerRef.current();
      actionListenerRef.current = null;
    }

    if (phase !== "guided") return;

    const step = ONBOARDING_STEPS[stepIndex];
    if (!step?.actionSelector || !step.actionEvent) return;

    const setupListener = () => {
      const el = document.querySelector(step.actionSelector!);
      if (!el) return;

      const handler = () => {
        // Advance to next step
        if (step.id === "generate-report") {
          // Celebration on report generation
          triggerConfetti();
        }

        if (stepIndex < ONBOARDING_STEPS.length - 1) {
          const nextStep = ONBOARDING_STEPS[stepIndex + 1];
          if (nextStep.route && pathname !== nextStep.route) {
            setNavigating(true);
            router.push(nextStep.route);
            setTimeout(() => {
              setNavigating(false);
              setStepIndex(stepIndex + 1);
            }, 1000);
          } else {
            setStepIndex(stepIndex + 1);
          }
        } else {
          // Last step — mark complete
          markComplete();
          setPhase("idle");
        }
      };

      el.addEventListener(step.actionEvent!, handler, { once: true });

      actionListenerRef.current = () => {
        el.removeEventListener(step.actionEvent!, handler);
      };
    };

    // Poll for element (may not be rendered yet after navigation)
    let attempts = 0;
    const pollId = setInterval(() => {
      attempts++;
      const el = document.querySelector(step.actionSelector!);
      if (el) {
        setupListener();
        clearInterval(pollId);
      }
      if (attempts > 30) clearInterval(pollId);
    }, 200);

    return () => {
      clearInterval(pollId);
      if (actionListenerRef.current) {
        actionListenerRef.current();
        actionListenerRef.current = null;
      }
    };
  }, [phase, stepIndex, pathname, router, markComplete]);

  const handleDismiss = useCallback(() => {
    markComplete();
    setPhase("idle");
  }, [markComplete]);

  const restartTourHandler = useCallback(() => {
    resetTour();
    setStepIndex(0);
    router.push("/get-started");
  }, [resetTour, router]);

  const currentStep = phase === "guided" ? ONBOARDING_STEPS[stepIndex] : null;

  // Resolve persona-specific body text
  const resolvedStep = currentStep
    ? {
        ...currentStep,
        body:
          currentStep.personaBody?.[onboardingState?.user_type ?? ""] ??
          currentStep.body,
      }
    : null;

  return (
    <TourContext.Provider
      value={{
        isActive: phase !== "idle",
        currentStep: resolvedStep,
        restartTour: restartTourHandler,
      }}
    >
      {children}

      <OnboardingProgressBar
        currentStep={stepIndex}
        totalSteps={ONBOARDING_STEPS.length}
        visible={phase === "guided"}
      />

      {phase === "guided" && resolvedStep && !navigating && (
        <>
          <BreathingSpotlight
            targetSelector={resolvedStep.targetSelector}
            visible
            onClick={resolvedStep.actionSelector ? undefined : handleDismiss}
          />
          <ConnectedTooltip
            step={resolvedStep}
            currentIndex={stepIndex}
            totalSteps={ONBOARDING_STEPS.length}
            onDismiss={handleDismiss}
          />
        </>
      )}
    </TourContext.Provider>
  );
}
```

- [ ] **Step 4: Update useTourState to handle new redirect logic**

The `shouldShowTour` logic now redirects to `/get-started` instead of showing a wizard. In `useTourState.ts`, the existing `shouldShowTour` remains the same (checks `onboarding_completed_at === null`), but consumers use it to redirect rather than show a modal.

- [ ] **Step 5: Verify the full flow**

```bash
cd packages/frontend && npm run dev
```

1. Navigate to `/get-started` → select persona → search market → should redirect to `/market/:id?onboarding=true`
2. Spotlight should appear on the score card
3. Click score card → should advance to reports step (or next step)

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/app/onboarding/TourProvider.tsx packages/frontend/app/onboarding/useTourState.ts packages/frontend/lib/data/fetchers/onboarding.ts packages/frontend/app/market/[id]/components/ScoreColumn.tsx packages/frontend/app/reports/page.tsx
git commit -m "feat: refactor TourProvider — 4-step action-gated flow with breathing spotlight"
```

---

## Task 9: Sample Report Card on Dashboard

**Files:**

- Create: `packages/frontend/app/dashboard/components/SampleReportCard.tsx`
- Modify: `packages/frontend/app/dashboard/page.tsx`

Shows a teaser report card for post-trial free users using their onboarding market (or Rochester, NY fallback).

- [ ] **Step 1: Create SampleReportCard**

```tsx
// packages/frontend/app/dashboard/components/SampleReportCard.tsx
"use client";

import Link from "next/link";
import { useEntitlements } from "@/lib/entitlements";
import { useScoreData } from "@/lib/data";

const FALLBACK_MARKET = {
  geoLevel: "metro" as const,
  geoId: "40380",
  name: "Rochester, NY",
};

interface SampleReportCardProps {
  onboardingMarket: {
    geoLevel: string;
    geoId: string;
    name: string;
  } | null;
}

export function SampleReportCard({ onboardingMarket }: SampleReportCardProps) {
  const { trial, tier } = useEntitlements();

  // Only show for post-trial free users
  if (trial?.active || tier !== "free") return null;

  const market = onboardingMarket ?? FALLBACK_MARKET;
  const { data: scoreData } = useScoreData(market.geoLevel, market.geoId);
  const score = scoreData?.score ?? null;

  return (
    <div className="bg-surface-container rounded-2xl border border-outline-variant/30 overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-on-surface">
            Sample Report: {market.name}
          </h3>
          {score != null && (
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold font-mono text-primary">
                  {score}
                </span>
              </div>
            </div>
          )}
        </div>

        <p className="text-sm text-on-surface-variant leading-relaxed mb-4">
          See what a full PropertyIQ AI report looks like — market analysis,
          investment insights, and trend forecasts powered by real-time data.
        </p>

        {/* Inline upgrade CTAs */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
            <span className="text-xs text-primary font-medium">Pro</span>
            <span className="text-xs text-on-surface-variant">
              Unlock monthly trend updates for {market.name}
            </span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
            <span className="text-xs text-primary font-medium">Pro</span>
            <span className="text-xs text-on-surface-variant">
              Get ZIP-level analysis and competitive breakdown
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/reports?market=${market.geoId}&type=${market.geoLevel}`}
            className="flex-1 text-center py-2.5 px-4 rounded-full bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Generate Free Report
          </Link>
          <Link
            href="/upgrade"
            className="py-2.5 px-4 rounded-full border border-primary text-primary text-sm font-medium hover:bg-primary/8 transition-colors"
          >
            Upgrade
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add to dashboard page**

In `packages/frontend/app/dashboard/page.tsx`, import `SampleReportCard` and add it above the existing `OnboardingBanner`. The card reads `onboarding_market` from the onboarding state (already fetched in the dashboard).

```tsx
import { SampleReportCard } from "./components/SampleReportCard";

// In the JSX, add before/instead of OnboardingBanner for post-trial users:
<SampleReportCard
  onboardingMarket={onboardingState?.onboarding_market ?? null}
/>;
```

- [ ] **Step 3: Verify in browser**

Navigate to `/dashboard` as a free (post-trial) user. The sample report card should appear.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/dashboard/components/SampleReportCard.tsx packages/frontend/app/dashboard/page.tsx
git commit -m "feat(dashboard): add sample report card for post-trial free users"
```

---

## Task 10: Progress Checklist Widget

**Files:**

- Create: `packages/frontend/app/dashboard/components/ProgressChecklist.tsx`
- Modify: `packages/frontend/app/dashboard/page.tsx`

- [ ] **Step 1: Create ProgressChecklist**

```tsx
// packages/frontend/app/dashboard/components/ProgressChecklist.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

const CHECKLIST_ITEMS = [
  {
    id: "create_account",
    label: "Create account",
    href: null,
    autoComplete: true,
  },
  {
    id: "search_market",
    label: "Search your first market",
    href: "/get-started",
  },
  { id: "view_score", label: "View a PropertyIQ Score", href: "/market" },
  { id: "compare_markets", label: "Compare two markets", href: "/market" },
  {
    id: "generate_report",
    label: "Generate a market report",
    href: "/reports",
  },
] as const;

interface ProgressChecklistProps {
  completedTasks: string[];
}

export function ProgressChecklist({ completedTasks }: ProgressChecklistProps) {
  const [dismissed, setDismissed] = useState(false);

  // Always count "create_account" as done
  const completed = new Set([...completedTasks, "create_account"]);
  const totalDone = completed.size;
  const total = CHECKLIST_ITEMS.length;
  const progress = (totalDone / total) * 100;
  const allDone = totalDone === total;

  if (dismissed || allDone) return null;

  return (
    <div className="bg-surface-container rounded-2xl border border-outline-variant/30 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-on-surface">Getting Started</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-primary">
            {Math.round(progress)}%
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="text-on-surface-variant/40 hover:text-on-surface-variant text-xs"
            aria-label="Dismiss checklist"
          >
            ×
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-outline-variant/20 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-[#00c853] rounded-full transition-all duration-600 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {CHECKLIST_ITEMS.map((item) => {
          const isDone = completed.has(item.id);
          const content = (
            <div
              key={item.id}
              className={`flex items-center gap-2.5 text-sm ${
                isDone
                  ? "text-on-surface-variant line-through"
                  : "text-on-surface"
              }`}
            >
              <span
                className={isDone ? "text-[#00c853]" : "text-outline-variant"}
              >
                {isDone ? "✓" : "○"}
              </span>
              {item.label}
            </div>
          );

          if (!isDone && item.href) {
            return (
              <Link
                key={item.id}
                href={item.href}
                className="block hover:bg-surface-container-high rounded-lg px-2 py-1 -mx-2 transition-colors"
              >
                {content}
              </Link>
            );
          }

          return (
            <div key={item.id} className="px-2 py-1 -mx-2">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add to dashboard**

In `packages/frontend/app/dashboard/page.tsx`, render `ProgressChecklist` in the sidebar or after the heading:

```tsx
import { ProgressChecklist } from "./components/ProgressChecklist";

// In JSX:
<ProgressChecklist
  completedTasks={onboardingState?.onboarding_checklist ?? []}
/>;
```

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/app/dashboard/components/ProgressChecklist.tsx packages/frontend/app/dashboard/page.tsx
git commit -m "feat(dashboard): add persistent progress checklist widget"
```

---

## Task 11: Personalized Paywall Modal

**Files:**

- Create: `packages/frontend/app/components/paywall/PersonalizedPaywall.tsx`

- [ ] **Step 1: Create PersonalizedPaywall**

```tsx
// packages/frontend/app/components/paywall/PersonalizedPaywall.tsx
"use client";

import Link from "next/link";

interface UsageStats {
  markets_viewed: number;
  scores_checked: number;
  reports_generated: number;
}

interface PersonalizedPaywallProps {
  usageStats: UsageStats;
  featureBlocked?: string;
  onDismiss: () => void;
}

export function PersonalizedPaywall({
  usageStats,
  featureBlocked,
  onDismiss,
}: PersonalizedPaywallProps) {
  const hasActivity =
    usageStats.markets_viewed > 0 ||
    usageStats.scores_checked > 0 ||
    usageStats.reports_generated > 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-surface-container-high rounded-[28px] shadow-lg p-8">
        {featureBlocked && (
          <p className="text-xs text-on-surface-variant mb-4">
            This feature requires a Pro subscription
          </p>
        )}

        <h2 className="text-xl font-medium text-on-surface mb-2">
          {hasActivity
            ? "Keep your market intelligence flowing"
            : "Unlock the full PropertyIQ experience"}
        </h2>

        {/* Dynamic usage stats */}
        {hasActivity && (
          <div className="flex gap-4 my-5 py-4 border-y border-outline-variant/20">
            <div className="text-center flex-1">
              <div className="text-2xl font-bold font-mono text-[#00c853]">
                {usageStats.markets_viewed}
              </div>
              <div className="text-[10px] text-on-surface-variant mt-1">
                Markets
                <br />
                analyzed
              </div>
            </div>
            <div className="text-center flex-1">
              <div className="text-2xl font-bold font-mono text-primary">
                {usageStats.scores_checked}
              </div>
              <div className="text-[10px] text-on-surface-variant mt-1">
                Scores
                <br />
                viewed
              </div>
            </div>
            <div className="text-center flex-1">
              <div className="text-2xl font-bold font-mono text-warning">
                {usageStats.reports_generated}
              </div>
              <div className="text-[10px] text-on-surface-variant mt-1">
                Reports
                <br />
                generated
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 mt-6">
          <Link
            href="/upgrade"
            className="w-full text-center py-3 px-6 rounded-full bg-primary text-on-primary font-medium hover:bg-primary/90 transition-colors"
          >
            Upgrade to Pro — $29/mo
          </Link>
          <button
            onClick={onDismiss}
            className="w-full text-center py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/frontend/app/components/paywall/PersonalizedPaywall.tsx
git commit -m "feat(ui): add personalized paywall modal with dynamic usage stats"
```

---

## Task 12: Contextual Beacons System

**Files:**

- Create: `packages/frontend/app/components/beacons/Beacon.tsx`
- Create: `packages/frontend/app/components/beacons/BeaconProvider.tsx`
- Modify: `packages/frontend/app/providers.tsx`

- [ ] **Step 1: Create Beacon component**

```tsx
// packages/frontend/app/components/beacons/Beacon.tsx
"use client";

import { useState } from "react";

interface BeaconProps {
  id: string;
  targetSelector: string;
  tooltip: string;
  href?: string;
  onDismiss: (id: string) => void;
}

export function Beacon({
  id,
  targetSelector,
  tooltip,
  href,
  onDismiss,
}: BeaconProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);

  // Position relative to target element
  useState(() => {
    const el = document.querySelector(targetSelector);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({
      top: rect.top - 4,
      right: window.innerWidth - rect.right - 4,
    });
  });

  if (!position) return null;

  const handleClick = () => {
    onDismiss(id);
    if (href) {
      window.location.href = href;
    }
  };

  return (
    <div
      className="fixed z-[100]"
      style={{ top: position.top, right: position.right }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        onClick={handleClick}
        className="w-3 h-3 rounded-full bg-primary animate-[beacon_2s_ease-in-out_infinite] cursor-pointer"
        aria-label={tooltip}
      />

      {showTooltip && (
        <div className="absolute right-0 top-5 bg-surface-container-high text-on-surface text-xs rounded-lg px-3 py-2 shadow-md whitespace-nowrap">
          {tooltip}
        </div>
      )}

      <style>{`
        @keyframes beacon {
          0%, 100% { transform: scale(1); opacity: 0.6; box-shadow: 0 0 0 0 rgba(57,73,171,0.4); }
          50% { transform: scale(1.3); opacity: 1; box-shadow: 0 0 8px 4px rgba(57,73,171,0.2); }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Create BeaconProvider**

```tsx
// packages/frontend/app/components/beacons/BeaconProvider.tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useAuth } from "@/lib/auth";
import { Beacon } from "./Beacon";

interface BeaconDef {
  id: string;
  trigger: string; // checklist task that must be completed to show this beacon
  targetSelector: string;
  tooltip: string;
  href?: string;
}

const BEACON_DEFS: BeaconDef[] = [
  {
    id: "compare-markets",
    trigger: "view_score",
    targetSelector: '[data-beacon="compare-markets"]',
    tooltip: "See how this market stacks up against others",
    href: "/market",
  },
  {
    id: "time-series",
    trigger: "search_market",
    targetSelector: '[data-beacon="time-series"]',
    tooltip: "Track how this metric has changed over time",
    href: "/graphs",
  },
  {
    id: "share-report",
    trigger: "generate_report",
    targetSelector: '[data-beacon="share-report"]',
    tooltip: "Share this report with your team or clients",
  },
];

interface BeaconContextValue {
  dismissBeacon: (id: string) => void;
}

const BeaconContext = createContext<BeaconContextValue>({
  dismissBeacon: () => {},
});

export const useBeacons = () => useContext(BeaconContext);

export function BeaconProvider({
  children,
  completedTasks,
  dismissedBeacons,
}: {
  children: React.ReactNode;
  completedTasks: string[];
  dismissedBeacons: string[];
}) {
  const { user } = useAuth();
  const [localDismissed, setLocalDismissed] = useState<Set<string>>(
    new Set(dismissedBeacons),
  );

  const dismissBeacon = useCallback(
    async (id: string) => {
      setLocalDismissed((prev) => new Set([...prev, id]));
      if (user?.id) {
        fetch(`/api/onboarding/beacon/${id}/dismiss`, {
          method: "POST",
          headers: { "x-user-id": user.id },
        });
      }
    },
    [user],
  );

  const completedSet = new Set(completedTasks);
  const activeBeacons = BEACON_DEFS.filter(
    (b) => completedSet.has(b.trigger) && !localDismissed.has(b.id),
  );

  return (
    <BeaconContext.Provider value={{ dismissBeacon }}>
      {children}
      {activeBeacons.map((b) => (
        <Beacon
          key={b.id}
          id={b.id}
          targetSelector={b.targetSelector}
          tooltip={b.tooltip}
          href={b.href}
          onDismiss={dismissBeacon}
        />
      ))}
    </BeaconContext.Provider>
  );
}
```

- [ ] **Step 3: Wire BeaconProvider into app providers**

In `packages/frontend/app/providers.tsx`, add `BeaconProvider` inside the provider chain (after `EntitlementsProvider`). It needs onboarding state, so it should consume `useTourState` or receive props from a parent that does.

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/components/beacons/ packages/frontend/app/providers.tsx
git commit -m "feat(ui): add contextual beacon system with trigger-based activation"
```

---

## Task 13: Social Proof Backend

**Files:**

- Create: `packages/backend/src/social-proof/social-proof.module.ts`
- Create: `packages/backend/src/social-proof/social-proof.service.ts`
- Create: `packages/backend/src/social-proof/social-proof.controller.ts`

- [ ] **Step 1: Create SocialProofService**

```typescript
// packages/backend/src/social-proof/social-proof.service.ts
import { Injectable, Inject, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase.service";
import { RedisLockService } from "../redis/redis-lock.service";

@Injectable()
export class SocialProofService {
  private readonly logger = new Logger(SocialProofService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly lockService: RedisLockService,
  ) {}

  async getStats(geoLevel: string, geoId: string) {
    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
      .toISOString()
      .split("T")[0];

    const { data } = await this.supabase
      .from("market_engagement_stats")
      .select(
        "view_count, score_check_count, report_count, tracking_user_count",
      )
      .eq("geo_level", geoLevel)
      .eq("geo_id", geoId)
      .gte("date", thirtyDaysAgo)
      .lte("date", today);

    if (!data?.length)
      return { views: 0, scoreChecks: 0, reports: 0, tracking: 0 };

    return {
      views: data.reduce((sum, r) => sum + (r.view_count || 0), 0),
      scoreChecks: data.reduce((sum, r) => sum + (r.score_check_count || 0), 0),
      reports: data.reduce((sum, r) => sum + (r.report_count || 0), 0),
      tracking: Math.max(...data.map((r) => r.tracking_user_count || 0)),
    };
  }

  /** Nightly aggregation: counts events from user_events into market_engagement_stats */
  @Cron("0 2 * * *") // 2 AM UTC daily
  async aggregateDailyStats() {
    const lockAcquired = await this.lockService.acquire(
      "cron:social-proof-aggregate",
      300,
    );
    if (!lockAcquired) return;

    try {
      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .split("T")[0];

      // Aggregate page views by market from user_events
      const { data: events } = await this.supabase.rpc(
        "aggregate_market_engagement",
        { target_date: yesterday },
      );

      if (events?.length) {
        await this.supabase
          .from("market_engagement_stats")
          .upsert(events, { onConflict: "geo_level,geo_id,date" });
      }

      this.logger.log(
        `Aggregated ${events?.length ?? 0} market stats for ${yesterday}`,
      );
    } finally {
      await this.lockService.release("cron:social-proof-aggregate");
    }
  }
}
```

- [ ] **Step 2: Create SocialProofController**

```typescript
// packages/backend/src/social-proof/social-proof.controller.ts
import { Controller, Get, Param } from "@nestjs/common";
import { SocialProofService } from "./social-proof.service";

@Controller("api/analytics/social-proof")
export class SocialProofController {
  constructor(private readonly socialProofService: SocialProofService) {}

  @Get(":geoLevel/:geoId")
  async getStats(
    @Param("geoLevel") geoLevel: string,
    @Param("geoId") geoId: string,
  ) {
    const stats = await this.socialProofService.getStats(geoLevel, geoId);
    return { success: true, data: stats };
  }
}
```

- [ ] **Step 3: Create SocialProofModule and register**

```typescript
// packages/backend/src/social-proof/social-proof.module.ts
import { Module } from "@nestjs/common";
import { SocialProofService } from "./social-proof.service";
import { SocialProofController } from "./social-proof.controller";
import { SupabaseModule } from "../supabase/supabase.module";
import { RedisModule } from "../redis/redis.module";

@Module({
  imports: [SupabaseModule, RedisModule],
  controllers: [SocialProofController],
  providers: [SocialProofService],
})
export class SocialProofModule {}
```

Add to `app.module.ts` imports.

- [ ] **Step 4: Commit**

```bash
git add packages/backend/src/social-proof/
git commit -m "feat(backend): add social proof service — daily aggregation cron + API endpoint"
```

---

## Task 14: Social Proof Frontend

**Files:**

- Create: `packages/frontend/app/components/social-proof/SocialProofBadge.tsx`
- Create: `packages/frontend/lib/data/fetchers/social-proof.ts`

- [ ] **Step 1: Create social proof fetcher**

```typescript
// packages/frontend/lib/data/fetchers/social-proof.ts
import { apiClient } from "@/lib/data/api-client";

export interface SocialProofStats {
  views: number;
  scoreChecks: number;
  reports: number;
  tracking: number;
}

export async function fetchSocialProof(
  geoLevel: string,
  geoId: string,
): Promise<SocialProofStats> {
  const res = await apiClient.get(
    `/api/analytics/social-proof/${geoLevel}/${geoId}`,
  );
  return res.data;
}
```

- [ ] **Step 2: Create SocialProofBadge**

```tsx
// packages/frontend/app/components/social-proof/SocialProofBadge.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchSocialProof } from "@/lib/data/fetchers/social-proof";

interface SocialProofBadgeProps {
  geoLevel: string;
  geoId: string;
  variant: "tracking" | "score_checks" | "reports";
}

const LABELS: Record<string, (n: number) => string> = {
  tracking: (n) => `${n.toLocaleString()} investors tracking this market`,
  score_checks: (n) => `Viewed ${n.toLocaleString()} times this month`,
  reports: (n) => `${n.toLocaleString()} reports generated this month`,
};

export function SocialProofBadge({
  geoLevel,
  geoId,
  variant,
}: SocialProofBadgeProps) {
  const { data } = useQuery({
    queryKey: ["social-proof", geoLevel, geoId],
    queryFn: () => fetchSocialProof(geoLevel, geoId),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  if (!data) return null;

  const count =
    variant === "tracking"
      ? data.tracking
      : variant === "score_checks"
        ? data.scoreChecks
        : data.reports;

  if (count < 10) return null; // Don't show tiny numbers

  return (
    <span className="text-xs text-on-surface-variant/60">
      {LABELS[variant](count)}
    </span>
  );
}
```

- [ ] **Step 3: Export from lib/data**

Add exports to `packages/frontend/lib/data/index.ts`:

```typescript
export { fetchSocialProof } from "./fetchers/social-proof";
export type { SocialProofStats } from "./fetchers/social-proof";
```

- [ ] **Step 4: Commit**

```bash
git add packages/frontend/app/components/social-proof/ packages/frontend/lib/data/fetchers/social-proof.ts packages/frontend/lib/data/index.ts
git commit -m "feat(ui): add social proof badge component with API fetcher"
```

---

## Task 15: Behavioral Email Trigger Service

**Files:**

- Create: `packages/backend/src/email/behavioral-trigger.service.ts`
- Create: `packages/emails/emails/behavioral-welcome.tsx`
- Create: `packages/emails/emails/behavioral-inactive.tsx`
- Create: `packages/emails/emails/behavioral-trial-warning.tsx`
- Create: `packages/emails/emails/behavioral-trial-expired.tsx`
- Modify: `packages/backend/src/email/email.module.ts`

- [ ] **Step 1: Create BehavioralTriggerService**

```typescript
// packages/backend/src/email/behavioral-trigger.service.ts
import { Injectable, Inject, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_CLIENT } from "../supabase/supabase.service";
import { EmailService } from "./email.service";
import { RedisLockService } from "../redis/redis-lock.service";
import {
  BehavioralWelcome,
  BehavioralInactive,
  BehavioralTrialWarning,
  BehavioralTrialExpired,
} from "@propertyiq/emails";
import React from "react";

interface TriggerConfig {
  name: string;
  query: () => Promise<
    Array<{
      userId: string;
      email: string;
      name: string;
      metadata: Record<string, unknown>;
    }>
  >;
  template: (props: Record<string, unknown>) => React.ReactElement;
  subject: string | ((meta: Record<string, unknown>) => string);
}

@Injectable()
export class BehavioralTriggerService {
  private readonly logger = new Logger(BehavioralTriggerService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly emailService: EmailService,
    private readonly lockService: RedisLockService,
  ) {}

  /** Check and fire behavioral triggers every hour */
  @Cron("0 * * * *")
  async processTriggersHourly() {
    const lockAcquired = await this.lockService.acquire(
      "cron:behavioral-triggers",
      300,
    );
    if (!lockAcquired) return;

    try {
      await this.fireInactive24h();
      await this.fireTrialDay10();
      await this.fireTrialDay13();
      await this.fireTrialExpired();
    } finally {
      await this.lockService.release("cron:behavioral-triggers");
    }
  }

  private async hasFired(
    userId: string,
    triggerName: string,
  ): Promise<boolean> {
    const { data } = await this.supabase
      .from("email_triggers")
      .select("id")
      .eq("user_id", userId)
      .eq("trigger_name", triggerName)
      .maybeSingle();
    return !!data;
  }

  private async markFired(
    userId: string,
    triggerName: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.supabase.from("email_triggers").insert({
      user_id: userId,
      trigger_name: triggerName,
      metadata: metadata ?? {},
    });
  }

  private async fireInactive24h() {
    // Users who signed up 24-48h ago with no search/score events
    const cutoffStart = new Date(Date.now() - 48 * 3600000).toISOString();
    const cutoffEnd = new Date(Date.now() - 24 * 3600000).toISOString();

    const { data: candidates } = await this.supabase
      .from("user_profiles")
      .select("id, email, display_name")
      .gte("created_at", cutoffStart)
      .lte("created_at", cutoffEnd)
      .is("onboarding_completed_at", null);

    if (!candidates?.length) return;

    for (const user of candidates) {
      if (await this.hasFired(user.id, "inactive_24h")) continue;

      await this.emailService.sendEmail({
        to: user.email,
        subject: "Here are this week's top trending markets",
        react: React.createElement(BehavioralInactive, {
          name: user.display_name || "there",
          loginUrl: `${process.env.FRONTEND_URL}/market`,
        }),
        userId: user.id,
        emailType: "behavioral_inactive_24h",
      });

      await this.markFired(user.id, "inactive_24h");
    }
  }

  private async fireTrialDay10() {
    const day10 = new Date(Date.now() + 4 * 86400000); // 4 days from now
    const day10Start = new Date(day10.setHours(0, 0, 0, 0)).toISOString();
    const day10End = new Date(day10.setHours(23, 59, 59, 999)).toISOString();

    const { data: trials } = await this.supabase
      .from("user_trials")
      .select("user_id, expires_at")
      .gte("expires_at", day10Start)
      .lte("expires_at", day10End)
      .is("converted_at", null)
      .is("cancelled_at", null);

    if (!trials?.length) return;

    for (const trial of trials) {
      if (await this.hasFired(trial.user_id, "trial_day_10")) continue;

      const { data: profile } = await this.supabase
        .from("user_profiles")
        .select("email, display_name, usage_stats")
        .eq("id", trial.user_id)
        .single();

      if (!profile?.email) continue;

      const stats = profile.usage_stats ?? {
        markets_viewed: 0,
        scores_checked: 0,
        reports_generated: 0,
      };

      await this.emailService.sendEmail({
        to: profile.email,
        subject: `You've analyzed ${stats.markets_viewed} markets. Pro ends in 4 days.`,
        react: React.createElement(BehavioralTrialWarning, {
          name: profile.display_name || "there",
          daysLeft: 4,
          marketsViewed: stats.markets_viewed,
          scoresChecked: stats.scores_checked,
          reportsGenerated: stats.reports_generated,
          upgradeUrl: `${process.env.FRONTEND_URL}/upgrade`,
        }),
        userId: trial.user_id,
        emailType: "behavioral_trial_day10",
      });

      await this.markFired(trial.user_id, "trial_day_10", { stats });
    }
  }

  private async fireTrialDay13() {
    // Similar to Day 10 but fires 1 day before expiry
    const day13 = new Date(Date.now() + 1 * 86400000);
    const day13Start = new Date(day13.setHours(0, 0, 0, 0)).toISOString();
    const day13End = new Date(day13.setHours(23, 59, 59, 999)).toISOString();

    const { data: trials } = await this.supabase
      .from("user_trials")
      .select("user_id, expires_at")
      .gte("expires_at", day13Start)
      .lte("expires_at", day13End)
      .is("converted_at", null)
      .is("cancelled_at", null);

    if (!trials?.length) return;

    for (const trial of trials) {
      if (await this.hasFired(trial.user_id, "trial_day_13")) continue;

      const { data: profile } = await this.supabase
        .from("user_profiles")
        .select("email, display_name, usage_stats")
        .eq("id", trial.user_id)
        .single();

      if (!profile?.email) continue;

      const stats = profile.usage_stats ?? {
        markets_viewed: 0,
        scores_checked: 0,
        reports_generated: 0,
      };

      await this.emailService.sendEmail({
        to: profile.email,
        subject: "Last day tomorrow. Here's what you'll lose.",
        react: React.createElement(BehavioralTrialWarning, {
          name: profile.display_name || "there",
          daysLeft: 1,
          marketsViewed: stats.markets_viewed,
          scoresChecked: stats.scores_checked,
          reportsGenerated: stats.reports_generated,
          upgradeUrl: `${process.env.FRONTEND_URL}/upgrade`,
        }),
        userId: trial.user_id,
        emailType: "behavioral_trial_day13",
      });

      await this.markFired(trial.user_id, "trial_day_13", { stats });
    }
  }

  private async fireTrialExpired() {
    const yesterday = new Date(Date.now() - 86400000);
    const ydayStart = new Date(yesterday.setHours(0, 0, 0, 0)).toISOString();
    const ydayEnd = new Date(yesterday.setHours(23, 59, 59, 999)).toISOString();

    const { data: trials } = await this.supabase
      .from("user_trials")
      .select("user_id, expires_at")
      .gte("expires_at", ydayStart)
      .lte("expires_at", ydayEnd)
      .is("converted_at", null)
      .is("cancelled_at", null);

    if (!trials?.length) return;

    for (const trial of trials) {
      if (await this.hasFired(trial.user_id, "trial_expired")) continue;

      const { data: profile } = await this.supabase
        .from("user_profiles")
        .select("email, display_name, onboarding_market")
        .eq("id", trial.user_id)
        .single();

      if (!profile?.email) continue;

      const marketName =
        profile.onboarding_market?.name ?? "your favorite market";

      await this.emailService.sendEmail({
        to: profile.email,
        subject: "Your Pro access ended. You still have 1 free report.",
        react: React.createElement(BehavioralTrialExpired, {
          name: profile.display_name || "there",
          marketName,
          reportUrl: `${process.env.FRONTEND_URL}/reports`,
          upgradeUrl: `${process.env.FRONTEND_URL}/upgrade`,
        }),
        userId: trial.user_id,
        emailType: "behavioral_trial_expired",
      });

      await this.markFired(trial.user_id, "trial_expired");
    }
  }
}
```

- [ ] **Step 2: Create email templates (behavioral-welcome, behavioral-inactive, behavioral-trial-warning, behavioral-trial-expired)**

These follow the same React Email pattern as existing templates in `packages/emails/emails/`. Each uses the shared `Layout` component and `BrandedButton`. Create minimal templates — the exact copy can be refined later.

```tsx
// packages/emails/emails/behavioral-inactive.tsx
import { Layout, BrandedButton } from "../components";

interface Props {
  name: string;
  loginUrl: string;
}

export function BehavioralInactive({ name, loginUrl }: Props) {
  return (
    <Layout>
      <h1>Hey {name}, markets are moving</h1>
      <p>
        You haven't explored PropertyIQ yet — here are this week's top trending
        markets.
      </p>
      <BrandedButton href={loginUrl}>Explore Trending Markets</BrandedButton>
    </Layout>
  );
}

export default BehavioralInactive;
```

Create similar templates for `behavioral-welcome.tsx`, `behavioral-trial-warning.tsx`, and `behavioral-trial-expired.tsx` following the same pattern.

- [ ] **Step 3: Register BehavioralTriggerService in EmailModule**

In `packages/backend/src/email/email.module.ts`, add `BehavioralTriggerService` to providers.

- [ ] **Step 4: Export new templates from packages/emails/index.ts**

```typescript
export { BehavioralWelcome } from "./emails/behavioral-welcome";
export { BehavioralInactive } from "./emails/behavioral-inactive";
export { BehavioralTrialWarning } from "./emails/behavioral-trial-warning";
export { BehavioralTrialExpired } from "./emails/behavioral-trial-expired";
```

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/email/behavioral-trigger.service.ts packages/emails/emails/behavioral-*.tsx packages/emails/index.ts packages/backend/src/email/email.module.ts
git commit -m "feat(email): add behavioral trigger service — replaces calendar drip with event-driven emails"
```

---

## Task 16: Disable Calendar Drip for Trial Users

**Files:**

- Modify: `packages/backend/src/email/drip.service.ts`

The existing calendar-based drip should not fire for users who have an active reverse trial (they get behavioral emails instead).

- [ ] **Step 1: Add trial check to drip processing**

In `packages/backend/src/email/drip.service.ts`, inside the processing loop for each drip day, add a check before sending:

```typescript
// Before sending each drip email, check if user has an active trial
const { data: activeTrial } = await this.supabase
  .from("user_trials")
  .select("id")
  .eq("user_id", user.id)
  .is("converted_at", null)
  .is("cancelled_at", null)
  .gt("expires_at", new Date().toISOString())
  .maybeSingle();

if (activeTrial) {
  // Skip calendar drip — behavioral triggers handle trial users
  continue;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/backend/src/email/drip.service.ts
git commit -m "fix(email): skip calendar drip for users with active reverse trial"
```

---

## Task 17: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Build both packages**

```bash
cd packages/frontend && npm run build
cd packages/backend && npm run build
```

Both should complete without errors.

- [ ] **Step 2: Run backend tests**

```bash
cd packages/backend && npx jest --no-coverage --passWithNoTests 2>&1 | tail -20
```

- [ ] **Step 3: Run frontend type check**

```bash
cd packages/frontend && npx tsc --noEmit --pretty
```

- [ ] **Step 4: Verify guided flow end-to-end**

Start dev servers:

```bash
cd packages/backend && npm run start:dev &
cd packages/frontend && npm run dev &
```

1. Sign up as new user → redirect to `/get-started`
2. Select "Real Estate Investor" → search bar appears
3. Type "Austin" → select "Austin, TX" from autocomplete
4. Should redirect to `/market/12420?type=metro&onboarding=true`
5. Breathing spotlight appears on score card
6. Click score card → navigates to `/reports` with spotlight on Generate button
7. Click Generate → confetti burst, report generates
8. Upgrade CTA modal appears: "You have 14 days of Pro"
9. Dashboard shows progress checklist at 60% (3/5 tasks done)

- [ ] **Step 5: Verify trial badge**

Check navigation bar shows "14d Pro Trial" badge.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for onboarding conversion flow"
```

---

## Summary: Task Dependencies

```
Task 1 (DB Migration)
  └─→ Task 2 (Backend: OnboardingService + trial auto-start)
  └─→ Task 13 (Social Proof Backend)
  └─→ Task 15 (Behavioral Email Service)

Task 4 (BreathingSpotlight)  ─┐
Task 5 (ConnectedTooltip)    ─┤
Task 6 (Steps + Progress Bar) ┤─→ Task 8 (Refactor TourProvider)
Task 7 (/get-started page)   ─┘

Task 2 ─→ Task 3 (Trial Badge in Nav)
Task 2 ─→ Task 11 (Personalized Paywall)

Task 8 ─→ Task 9 (Sample Report Card)
Task 8 ─→ Task 10 (Progress Checklist)
Task 8 ─→ Task 12 (Beacons)

Task 13 ─→ Task 14 (Social Proof Frontend)

Task 15 ─→ Task 16 (Disable Calendar Drip)

All ─→ Task 17 (Integration Verification)
```

Tasks within the same dependency group can be parallelized.

---

## Self-Review Corrections

The following issues were found during self-review. **The implementing engineer MUST address these during implementation.** They are listed here rather than patched inline to keep the plan readable.

### Critical Fixes (Blocking)

**1. Entitlements already handle trials — no code changes needed.**
The existing `EntitlementsService.getActiveTrial()` (in `packages/backend/src/entitlements/entitlements.service.ts:180-203`) already queries `user_trials` for active trials and overrides the user's tier to the trial tier. Task 2's `ensureTrialStarted()` inserts into `user_trials`, which the existing entitlements code picks up automatically. The `TrialInfo` type (`{ active, daysRemaining, tier }`) is already returned in the entitlements response and consumed by `useEntitlements()` on the frontend. **No entitlements code changes are needed for the reverse trial to work.**

**2. `saveOnboardingPreferences` already exists.**
The function is defined at `packages/frontend/lib/data/fetchers/onboarding.ts:67-82`. Task 7's import is valid. However, Task 8 must update the `.select()` query in `fetchOnboardingState()` to include the new columns — this is specified but the exact code should be verified.

**3. Fix `apiClient` import in Task 14 (social-proof.ts).**
The codebase does not have `@/lib/data/api-client`. Replace the import with the actual API client pattern used in the project. Check `packages/frontend/lib/data/fetchers/` for the correct import (likely a base fetcher that wraps `fetch` with the API URL and headers).

**4. Fix direct `fetch()` calls in Task 7 (/get-started/page.tsx).**
The `/get-started/page.tsx` makes raw `fetch("/api/onboarding/...")` calls. This violates CLAUDE.md Section 5 (all data fetching through `@/lib/data`). Create fetcher functions in `packages/frontend/lib/data/fetchers/onboarding.ts`:

```typescript
export async function startOnboardingTrial(): Promise<void> {
  /* POST /api/onboarding/start-trial */
}
export async function saveOnboardingMarket(
  market: OnboardingMarket,
): Promise<void> {
  /* POST /api/onboarding/save-market */
}
```

Then import and call these from the page component.

**5. Add `aggregate_market_engagement` RPC function to migration.**
Task 13's `SocialProofService` calls `this.supabase.rpc('aggregate_market_engagement', ...)`. Add this Postgres function to the migration in Task 1:

```sql
CREATE OR REPLACE FUNCTION aggregate_market_engagement(target_date DATE)
RETURNS TABLE (geo_level TEXT, geo_id TEXT, date DATE, view_count INT, score_check_count INT, report_count INT, tracking_user_count INT)
LANGUAGE sql STABLE AS $$
  SELECT
    (properties->>'geo_level')::text AS geo_level,
    (properties->>'geo_id')::text AS geo_id,
    target_date AS date,
    COUNT(*) FILTER (WHERE event_action = 'page_view') AS view_count,
    COUNT(*) FILTER (WHERE event_action = 'score_view') AS score_check_count,
    COUNT(*) FILTER (WHERE event_action = 'report_generate') AS report_count,
    COUNT(DISTINCT user_id) AS tracking_user_count
  FROM user_events
  WHERE created_at::date = target_date
    AND properties->>'geo_level' IS NOT NULL
    AND properties->>'geo_id' IS NOT NULL
  GROUP BY properties->>'geo_level', properties->>'geo_id';
$$;
```

**6. Fix Step 2 route: `/reports` → `/reports` (correct as-is).**
The spec says `/reports/builder`, but the Generate button actually lives on `/reports` (the main reports page at `packages/frontend/app/reports/page.tsx:683`). The plan is correct; the spec route is slightly wrong. The implementing engineer should verify which page has the Generate button and spotlight that.

### Coverage Gaps (Add During Implementation)

**7. Missing email triggers (5 of 9).**
Task 15 implements 4 triggers. The implementing engineer should add these 5 to `BehavioralTriggerService`:

- `welcome` — fire immediately on signup (in `ensureTrialStarted` or signup webhook)
- `active_explorer` — 3+ scores in a session → education email (1h delay, requires session tracking)
- `report_generated` — immediate email on first report generation
- `paywall_hit` — 2h after encountering upgrade prompt (requires paywall event tracking)
- `post_trial_7d` — 7 days after trial expiry, if not converted and has free credit

**8. Missing celebration events.**
Task 8 only implements confetti on report generation. Add:

- First score viewed: score ring fill animation (CSS `conic-gradient` transition) + bridge CTA "See how this compares → Compare Markets"
- Checklist complete: all checkmarks bloom simultaneously + "Set up market alerts → Alerts page"
- 5th market viewed: subtle achievement badge toast + "Generate a report"

**9. Old files not deleted.**
After the new flow is working, delete:

- `packages/frontend/app/onboarding/WelcomeWizard.tsx`
- `packages/frontend/app/onboarding/TourOverlay.tsx`
- `packages/frontend/app/onboarding/TourTooltip.tsx`
- `packages/frontend/app/onboarding/tour-steps.ts`

**10. Missing beacon: "Market Alerts" after checklist completion.**
Add to `BEACON_DEFS` in Task 12:

```typescript
{ id: "market-alerts", trigger: "all_complete", targetSelector: '[data-beacon="market-alerts"]', tooltip: "Get notified when this market moves", href: "/alerts" }
```

**11. Greyed-out features post-trial + free_report_credits decrement.**
After trial expires, features the user actually used should appear greyed with "Unlock" badges. This requires:

- Tracking which feature categories were used during trial (extend `usage_stats` JSONB)
- A post-trial dashboard state that renders greyed feature cards
- Decrementing `free_report_credits` on report generation (add to report generation service)

**12. In-app trial notifications (Day 10, 13, 14).**
The plan only sends emails. Add in-app banner/modal components that check `trial.daysRemaining` from `useEntitlements()` and show contextual messages on the dashboard.

**13. Wire SocialProofBadge into 4 locations.**
After creating the component (Task 14), add it to:

- Market page header (`packages/frontend/app/market/[id]/MarketDashboard.tsx`)
- Score card (`packages/frontend/app/market/[id]/components/ScoreColumn.tsx`)
- Upgrade modal (PersonalizedPaywall from Task 11)
- Report builder (`packages/frontend/app/reports/page.tsx`)
