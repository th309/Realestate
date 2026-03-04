# AI & UX Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add ambient AI insights, personalized onboarding + match scores, content/SEO engine, email strategy, and custom research briefs to PropertyIQ.

**Architecture:** Monthly batch AI generation (DeepSeek) cached in `market_insights` table, user preferences driving a client-computed Match Score, new report template type for agentic research briefs, React Email templates for drip/digest/alert emails via Resend, and dynamic OG image generation for social sharing.

**Tech Stack:** NestJS (backend modules + cron), React/Next.js (frontend), DeepSeek via OpenAI SDK (batch AI), Claude via Anthropic SDK (tool-use for research briefs), Resend (email), React Email (templates), `@vercel/og` (social cards), Supabase (DB + auth)

**Design Doc:** `docs/plans/2026-03-04-ai-ux-enhancement-design.md`

**Verification Standard:** No feature is complete until verified with real production data. No mocks, no stubs. See design doc "Verification Standard" section.

---

## Phase 1: Foundation (Ambient Intelligence + Onboarding Emails)

### Task 1: Create `market_insights` database table

**Files:**

- Create: `packages/backend/src/insights/migrations/create-market-insights-table.sql`

**Steps:**

1. Write the migration SQL:

```sql
CREATE TABLE IF NOT EXISTS market_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id TEXT NOT NULL,
  geo_level TEXT NOT NULL CHECK (geo_level IN ('state', 'metro', 'county', 'zip')),
  insight_type TEXT NOT NULL CHECK (insight_type IN ('market_take', 'score_explanation', 'trend_interpretation', 'market_overview', 'archetype_match')),
  content TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'deepseek-chat',
  archetype_id TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  scoring_run_id TEXT,
  UNIQUE(region_id, geo_level, insight_type, archetype_id)
);

CREATE INDEX idx_market_insights_lookup ON market_insights(region_id, geo_level, insight_type);
CREATE INDEX idx_market_insights_expiry ON market_insights(expires_at);
```

2. Run the migration against staging Supabase via the SQL editor or `psql`.

3. Verify the table exists:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'market_insights' ORDER BY ordinal_position;
```

4. Commit:

```bash
git add packages/backend/src/insights/migrations/create-market-insights-table.sql
git commit -m "feat(insights): add market_insights table for cached AI insights"
```

---

### Task 2: Create InsightGeneration backend module — scaffold

**Files:**

- Create: `packages/backend/src/insights/insights.module.ts`
- Create: `packages/backend/src/insights/insights.service.ts`
- Create: `packages/backend/src/insights/insights.controller.ts`
- Create: `packages/backend/src/insights/insight-prompts.ts`
- Create: `packages/backend/src/insights/insights.types.ts`
- Modify: `packages/backend/src/app.module.ts` — add InsightsModule to imports

**Steps:**

1. Create `insights.types.ts` with types:

```typescript
export type InsightType =
  | "market_take"
  | "score_explanation"
  | "trend_interpretation"
  | "market_overview"
  | "archetype_match";
export type GeoLevel = "state" | "metro" | "county" | "zip";

export interface MarketInsight {
  id: string;
  region_id: string;
  geo_level: GeoLevel;
  insight_type: InsightType;
  content: string;
  model: string;
  archetype_id: string | null;
  generated_at: string;
  expires_at: string;
}

export interface InsightContext {
  region_name: string;
  region_id: string;
  geo_level: GeoLevel;
  scores: {
    homeready: number | null;
    investoredge: number | null;
    market_health: number | null;
  };
  score_components: Record<string, { status: string; value: number }>;
  key_metrics: Record<
    string,
    { value: number; yoy_change: number | null; format: string }
  >;
  benchmarks: {
    state_avg: Record<string, number>;
    national_avg: Record<string, number>;
  };
}
```

2. Create `insight-prompts.ts` with prompt templates per insight type. Each template accepts an `InsightContext` and returns a prompt string. Key templates:

- `market_take`: 2-sentence market take referencing score, top component driver, and one benchmark comparison
- `score_explanation`: 1-sentence "why this score" keyed to top 2 score components
- `trend_interpretation`: 1-2 sentences interpreting a specific metric trend vs state/national
- `market_overview`: 3-4 sentence market summary for landing pages (longer form)

All prompts MUST instruct the model to use ONLY the data provided — no fabrication.

3. Create `insights.service.ts` following the existing DeepSeek pattern from `packages/backend/src/reports/claude.service.ts`:

```typescript
@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);
  private aiClient: OpenAI | null = null;
  private readonly aiModel: string;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
    private readonly scoringService: ScoringService,
    private readonly metricResolution: MetricResolutionService,
  ) {
    // Initialize DeepSeek client (same pattern as claude.service.ts lines 36-56)
    const deepseekKey = this.configService.get<string>("DEEPSEEK_API_KEY");
    this.aiModel =
      this.configService.get<string>("AI_MODEL") || "deepseek-chat";
    if (deepseekKey) {
      this.aiClient = new OpenAI({
        apiKey: deepseekKey,
        baseURL:
          this.configService.get<string>("AI_BASE_URL") ||
          "https://api.deepseek.com/v1",
      });
    }
  }

  // Core methods:
  // getInsight(regionId, geoLevel, insightType, archetypeId?) — check cache, return if fresh, generate on-demand if stale
  // generateBatchInsights(geoLevel) — generate all insights for all regions at a geo level
  // buildInsightContext(regionId, geoLevel) — gather scores + metrics + benchmarks into InsightContext
  // generateSingleInsight(context, insightType) — call DeepSeek with prompt template
}
```

Key implementation details:

- `getInsight()`: Query `market_insights` WHERE region_id + geo_level + insight_type + expires_at > NOW(). If found, return cached. If not, call `generateSingleInsight()`, upsert to DB, return.
- `generateBatchInsights()`: Fetch all scores for a geo level via `scoringService`, iterate and generate. Use `Promise.allSettled` with concurrency limit of 5 to avoid rate limiting.
- `buildInsightContext()`: Use `metricResolution.resolveMetricBatch()` for key metrics (home_value, rent_index, unemployment_rate, days_on_market, inventory, home_value_yoy, population_growth). Use `scoringService.getScore()` for scores + components.

4. Create `insights.controller.ts`:

```typescript
@Controller("api/insights")
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get(":geoLevel/:regionId")
  async getInsight(
    @Param("geoLevel") geoLevel: string,
    @Param("regionId") regionId: string,
    @Query("type") insightType: string = "market_take",
    @Query("archetype") archetypeId?: string,
  ): Promise<{ content: string; generated_at: string; model: string }> {
    return this.insightsService.getInsight(
      regionId,
      geoLevel,
      insightType,
      archetypeId,
    );
  }

  @Post("generate-batch")
  @UseGuards(AdminGuard)
  async generateBatch(
    @Body("geoLevel") geoLevel: string,
  ): Promise<{ generated: number; failed: number; duration_ms: number }> {
    return this.insightsService.generateBatchInsights(geoLevel);
  }
}
```

5. Create `insights.module.ts`:

```typescript
@Module({
  imports: [
    SupabaseModule,
    ConfigModule,
    ScoringModule,
    MetricResolutionModule,
  ],
  controllers: [InsightsController],
  providers: [InsightsService],
  exports: [InsightsService],
})
export class InsightsModule {}
```

6. Add `InsightsModule` to `app.module.ts` imports array.

7. Build backend to verify no compilation errors:

```bash
cd packages/backend && npm run build
```

8. Commit:

```bash
git add packages/backend/src/insights/ packages/backend/src/app.module.ts
git commit -m "feat(insights): scaffold InsightsModule with service, controller, prompts, types"
```

---

### Task 3: Implement InsightsService — context building and AI generation

**Files:**

- Modify: `packages/backend/src/insights/insights.service.ts`
- Modify: `packages/backend/src/insights/insight-prompts.ts`

**Steps:**

1. Implement `buildInsightContext()` using real service calls:
   - Call `scoringService.getScore(regionId, geoLevel)` for all 3 score types
   - Call `metricResolution.resolveMetricBatch(['home_value', 'rent_index', 'unemployment_rate', 'days_on_market', 'for_sale_inventory', 'home_value_yoy', 'population_growth', 'median_income'], geoLevel, regionId)`
   - Query national/state benchmarks via `metricResolution.resolveMetricBatch()` at state and national levels
   - Assemble into `InsightContext`

2. Implement `generateSingleInsight()`:
   - Get prompt from `insight-prompts.ts` for the given insight type
   - Interpolate `InsightContext` into prompt
   - Call `this.aiClient.chat.completions.create({ model: this.aiModel, max_tokens: 200, messages: [{ role: 'user', content: prompt }] })`
   - Return content string

3. Implement `getInsight()` with cache check + on-demand generation:
   - Query: `this.supabase.from('market_insights').select('*').eq('region_id', regionId).eq('geo_level', geoLevel).eq('insight_type', insightType).gt('expires_at', new Date().toISOString()).maybeSingle()`
   - If found, return cached content
   - If not, call `buildInsightContext()` → `generateSingleInsight()` → upsert to `market_insights` with `expires_at` 30 days from now → return

4. Implement `generateBatchInsights()`:
   - Fetch all region IDs for the geo level from scoring data: `this.supabase.from('propertyiq_scores').select('location_id').eq('geography', geoLevel)`
   - Process in batches of 5 concurrent using a semaphore/pool pattern
   - For each: `buildInsightContext()` → generate `market_take` + `score_explanation` → upsert both
   - Track generated/failed counts, log progress every 50 regions

5. Build and test with a single metro:

```bash
cd packages/backend && npm run build
# Start backend, then test endpoint:
curl http://localhost:3001/api/insights/metro/31080?type=market_take
```

6. Verify the response contains real score values that match the database. Spot-check against `propertyiq_scores` table.

7. Commit:

```bash
git add packages/backend/src/insights/
git commit -m "feat(insights): implement context building and DeepSeek generation with caching"
```

---

### Task 4: Add frontend `useInsight` hook and fetcher

**Files:**

- Create: `packages/frontend/lib/data/fetchers/insights.ts`
- Create: `packages/frontend/lib/data/hooks/useInsight.ts`
- Modify: `packages/frontend/lib/data/fetchers/index.ts` — re-export
- Modify: `packages/frontend/lib/data/hooks/index.ts` — re-export
- Modify: `packages/frontend/lib/data/index.ts` — re-export

**Steps:**

1. Create fetcher `insights.ts` following the pattern in `fetchers/base.ts`:

```typescript
import { fetchAPI } from "./base";

export interface InsightData {
  content: string;
  generated_at: string;
  model: string;
}

export async function fetchInsight(
  geoLevel: string,
  regionId: string,
  insightType: string = "market_take",
  archetypeId?: string,
): Promise<InsightData | null> {
  try {
    const params = new URLSearchParams({ type: insightType });
    if (archetypeId) params.set("archetype", archetypeId);
    return await fetchAPI<InsightData>(
      `/api/insights/${geoLevel}/${regionId}?${params}`,
    );
  } catch {
    return null;
  }
}
```

2. Create hook `useInsight.ts` following the pattern in `useMetricData.ts`:

```typescript
"use client";
import { useQuery } from "@tanstack/react-query";
import { fetchInsight, type InsightData } from "@/lib/data";

const CACHE_TIME = 2 * 60 * 60 * 1000; // 2 hours (data is monthly, cache aggressively)

export function useInsight(
  geoLevel: string | null,
  regionId: string | null,
  insightType: string = "market_take",
  archetypeId?: string,
) {
  const { data, isLoading, error } = useQuery<InsightData | null>({
    queryKey: ["insight", geoLevel, regionId, insightType, archetypeId],
    queryFn: () => fetchInsight(geoLevel!, regionId!, insightType, archetypeId),
    enabled: !!geoLevel && !!regionId,
    staleTime: CACHE_TIME,
    gcTime: CACHE_TIME,
  });

  return {
    insight: data?.content ?? null,
    generatedAt: data?.generated_at ?? null,
    loading: isLoading,
    error: error as Error | null,
  };
}
```

3. Export from `fetchers/index.ts`, `hooks/index.ts`, and `lib/data/index.ts`.

4. Build frontend to verify:

```bash
cd packages/frontend && npm run build
```

5. Commit:

```bash
git add packages/frontend/lib/data/fetchers/insights.ts packages/frontend/lib/data/hooks/useInsight.ts packages/frontend/lib/data/fetchers/index.ts packages/frontend/lib/data/hooks/index.ts packages/frontend/lib/data/index.ts
git commit -m "feat(data-layer): add useInsight hook and fetchInsight fetcher"
```

---

### Task 5: Integrate ambient insights into map right panel

**Files:**

- Modify: `packages/frontend/app/map/hooks/useRightPanelData.ts` — add insight to return data
- Modify: Right panel component that renders selected region data (identify exact component from `useRightPanelData` consumers)

**Steps:**

1. Read the right panel rendering component to understand where insight text should appear. Find the consumer of `useRightPanelData` in the map components.

2. Add `useInsight` call inside the right panel data flow. The insight should appear between the score cards and the metric details — a subtle 2-sentence block with a small "AI Insight" label.

3. Wrap the insight block in `<EntitlementGate type="feature" id="ai_insights">` with:
   - Full content: full insight text
   - Fallback: first sentence only + "Upgrade to see full analysis" link
   - Use `loadingFallback` to prevent flash

4. Style the insight block following M3: `bg-surface-container-low rounded-xl p-4` with a small `text-label` "AI Insight" header and `text-body` content.

5. Test locally with the dev server running against staging data:
   - Select a metro on the map
   - Verify insight appears in right panel with real data
   - Verify the numbers in the insight match the score shown in the score card
   - Test as free user (should see truncated) and pro user (should see full)

6. Commit:

```bash
git commit -m "feat(map): show ambient AI insight in right panel for selected region"
```

---

### Task 6: Integrate ambient insights into score cards

**Files:**

- Modify: `packages/frontend/app/components/scoring/ScoreCard.tsx` — add "Why this score" line

**Steps:**

1. Read `ScoreCard.tsx` to understand the current layout.

2. Add a `useInsight(geoLevel, geoId, 'score_explanation')` call. Display the one-liner below the score badge/label, styled as `text-sm text-on-surface-variant italic`.

3. Wrap in `<EntitlementGate type="feature" id="ai_insights">` — free users see nothing (the one-liner is the premium tease), pro users see the explanation.

4. Test with real data: select a metro, verify the score explanation makes sense given the actual score components.

5. Commit:

```bash
git commit -m "feat(scoring): add 'Why this score' AI explanation to ScoreCard"
```

---

### Task 7: Configure entitlements for AI insights

**Steps:**

1. Add entitlement entries via the entitlements admin UI or directly in the entitlements configuration:
   - Feature: `ai_insights` — free: `preview`, pro: `full`, enterprise: `full`, admin: `full`
   - The `preview` level is used by `EntitlementGate` to show truncated content

2. Verify in browser: log in as free user → insight truncated. Log in as pro user → full insight.

3. Commit any config changes if they're code-based.

---

### Task 8: Phase 1A live verification — Ambient Intelligence

**Steps:**

1. Trigger batch generation for all metros:

```bash
curl -X POST http://localhost:3001/api/insights/generate-batch \
  -H "Content-Type: application/json" \
  -d '{"geoLevel": "metro"}' \
  -H "Authorization: Bearer <admin_token>"
```

2. Verify `market_insights` table has rows for ~900 metros with `insight_type = 'market_take'` and `insight_type = 'score_explanation'`.

3. Spot-check 10 metros: open each in the map, verify:
   - [ ] Insight text appears in right panel
   - [ ] Numbers mentioned in the insight match actual scores in the DB
   - [ ] Score explanation in ScoreCard references real component names
   - [ ] Free user sees truncated, pro sees full
   - [ ] No "undefined" or placeholder text anywhere

4. Check the `generated_at` and `expires_at` dates are reasonable (30 days from now).

---

### Task 9: Create onboarding drip email templates

**Files:**

- Create: `packages/emails/emails/onboarding-day0-welcome.tsx`
- Create: `packages/emails/emails/onboarding-day1-scores.tsx`
- Create: `packages/emails/emails/onboarding-day3-compare.tsx`
- Create: `packages/emails/emails/onboarding-day7-profile.tsx`
- Create: `packages/emails/emails/onboarding-day14-report.tsx`
- Modify: `packages/emails/index.ts` — export new templates

**Steps:**

1. Follow the existing template pattern from `packages/emails/emails/welcome.tsx`: use the shared `Layout` component, `BrandedButton`, and `EmailHeading` from `packages/emails/emails/components/`.

2. Create each template with personalization props: `{ name: string; loginUrl: string }`. Tone: conversational, first-name, brief. One CTA per email.
   - **Day 0:** "Welcome to PropertyIQ" — brief intro + CTA to explore the map
   - **Day 1:** "Here's how to read your scores" — explain HomeReady/InvestorEdge/MarketHealth in 3 short bullets + CTA to map
   - **Day 3:** "Compare markets side by side" — feature discovery + CTA to compare page
   - **Day 7:** "Get personalized recommendations" — drive quiz completion + CTA to quiz (will be built in Phase 2; for now link to map)
   - **Day 14:** "Your first market report is free" — drive report generation + CTA to reports

3. Preview each with `cd packages/emails && npm run dev` — verify rendering at http://localhost:3002.

4. Commit:

```bash
git add packages/emails/
git commit -m "feat(emails): add 5 onboarding drip email templates (day 0/1/3/7/14)"
```

---

### Task 10: Create drip email scheduling service

**Files:**

- Create: `packages/backend/src/email/drip.service.ts`
- Modify: `packages/backend/src/email/email.module.ts` — add DripService

**Steps:**

1. Create `drip.service.ts` that:
   - Has a `@Cron('0 9 * * *')` job (daily at 9 AM UTC) that checks which users need drip emails
   - Queries `user_profiles` for users who signed up in the relevant windows (0, 1, 3, 7, 14 days ago)
   - Cross-references `email_log` to avoid re-sending (check if email_type `onboarding_dayN` already sent to that user)
   - Calls `emailService.sendEmail()` with the appropriate React Email template
   - Logs each send to `email_log` with `email_type = 'onboarding_day0'`, etc.

2. Key logic:

```typescript
@Cron('0 9 * * *')
async processOnboardingDrip() {
  const dayConfigs = [
    { day: 0, emailType: 'onboarding_day0', template: 'day0-welcome' },
    { day: 1, emailType: 'onboarding_day1', template: 'day1-scores' },
    { day: 3, emailType: 'onboarding_day3', template: 'day3-compare' },
    { day: 7, emailType: 'onboarding_day7', template: 'day7-profile' },
    { day: 14, emailType: 'onboarding_day14', template: 'day14-report' },
  ];

  for (const config of dayConfigs) {
    const targetDate = subDays(new Date(), config.day);
    const startOfDay = startOfDayUTC(targetDate);
    const endOfDay = endOfDayUTC(targetDate);

    // Users who signed up on this day AND haven't received this email
    const { data: eligibleUsers } = await this.supabase
      .from('user_profiles')
      .select('id, email')
      .gte('created_at', startOfDay)
      .lt('created_at', endOfDay);

    // Filter out already-sent
    for (const user of eligibleUsers || []) {
      const { data: alreadySent } = await this.supabase
        .from('email_log')
        .select('id')
        .eq('user_id', user.id)
        .eq('email_type', config.emailType)
        .maybeSingle();

      if (!alreadySent) {
        await this.emailService.sendEmail({
          to: user.email,
          subject: DRIP_SUBJECTS[config.emailType],
          react: renderDripTemplate(config.template, { name: user.email.split('@')[0] }),
          userId: user.id,
          emailType: config.emailType,
        });
      }
    }
  }
}
```

3. Register `DripService` in `email.module.ts` providers.

4. Build backend to verify no compilation errors.

5. Commit:

```bash
git add packages/backend/src/email/drip.service.ts packages/backend/src/email/email.module.ts
git commit -m "feat(emails): add drip scheduling service with daily cron for onboarding sequence"
```

---

### Task 11: Phase 1B live verification — Onboarding Emails

**Steps:**

1. Manually trigger the drip service for a test user by temporarily adjusting the date filter or adding a manual trigger endpoint.

2. Verify:
   - [ ] All 5 emails send successfully via Resend to a real test email address
   - [ ] Email personalization renders correctly (first name, login URL)
   - [ ] `email_log` table has entries for each send
   - [ ] Re-running does NOT re-send (dedup check works)
   - [ ] Emails render correctly in Gmail/Outlook (check Resend dashboard for delivery status)

---

## Phase 2: Personalization (Quiz + Match Score + Dashboard)

### Task 12: Create `user_preferences` table

**Files:**

- Create: `packages/backend/src/preferences/migrations/create-user-preferences-table.sql`

**Steps:**

1. Write migration:

```sql
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal TEXT CHECK (goal IN ('first_time_buyer', 'relocating', 'investor_rental', 'investor_flip', 'exploring')),
  priorities TEXT[] DEFAULT '{}',
  budget_min INTEGER,
  budget_max INTEGER,
  location_preferences TEXT[] DEFAULT '{}',
  timeline TEXT CHECK (timeline IN ('under_6_months', '6_to_12_months', '1_to_2_years', 'researching')),
  archetype_id TEXT,
  quiz_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_archetype ON user_preferences(archetype_id);
```

2. Run against staging Supabase. Verify table exists.

3. Add RLS policy: users can only read/write their own row.

```sql
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id);
```

4. Commit:

```bash
git commit -m "feat(preferences): add user_preferences table with RLS"
```

---

### Task 13: Create UserPreferences backend module

**Files:**

- Create: `packages/backend/src/preferences/preferences.module.ts`
- Create: `packages/backend/src/preferences/preferences.service.ts`
- Create: `packages/backend/src/preferences/preferences.controller.ts`
- Create: `packages/backend/src/preferences/preferences.types.ts`
- Create: `packages/backend/src/preferences/archetype-mapper.ts`
- Modify: `packages/backend/src/app.module.ts` — add PreferencesModule

**Steps:**

1. Create types matching the DB schema.

2. Create `archetype-mapper.ts` that maps quiz answers to one of ~12 archetypes:
   - Archetype ID format: `{goal}_{primary_priority}_{budget_tier}` (e.g., `investor_rental_cashflow_200_400k`)
   - Map budget ranges to tiers: `under_200k`, `200_400k`, `400_600k`, `600k_1m`, `over_1m`
   - Use first priority from the priorities array as the primary

3. Create service with CRUD:
   - `getPreferences(userId)` — fetch from DB
   - `upsertPreferences(userId, data)` — upsert + compute `archetype_id` via archetype mapper + set `quiz_completed_at`
   - `getArchetypeId(userId)` — quick lookup for other services

4. Create controller:
   - `GET /api/preferences` — requires JwtAuthGuard, returns user's preferences
   - `PUT /api/preferences` — requires JwtAuthGuard, upserts preferences
   - Validate input with class-validator DTOs

5. Register in `app.module.ts`.

6. Build and test:

```bash
cd packages/backend && npm run build
```

7. Commit:

```bash
git commit -m "feat(preferences): add UserPreferences module with archetype mapping"
```

---

### Task 14: Create onboarding quiz UI

**Files:**

- Create: `packages/frontend/app/onboarding/page.tsx`
- Create: `packages/frontend/app/onboarding/components/QuizStep.tsx`
- Create: `packages/frontend/app/onboarding/components/QuizProgress.tsx`
- Create: `packages/frontend/app/onboarding/hooks/useQuiz.ts`
- Create: `packages/frontend/lib/data/fetchers/preferences.ts`
- Create: `packages/frontend/lib/data/hooks/usePreferences.ts`

**Steps:**

1. Create fetcher + hook for preferences (standard data layer pattern).

2. Create `useQuiz` hook that manages multi-step state:
   - Current step (0-4)
   - Answers object accumulating across steps
   - `next()`, `back()`, `submit()` methods
   - `submit()` calls `PUT /api/preferences` with all answers

3. Create `QuizStep` component: renders question text, option chips (M3 Filter Chips: `rounded-lg border-outline`), and next/back buttons. Each step gets its question config from a static array.

4. Create `QuizProgress` component: 5-dot progress indicator.

5. Create `page.tsx` that orchestrates the quiz flow. After completion, redirect to `/dashboard` (will be built in Task 18) or `/map` as interim.

6. Follow M3 design: centered card layout (`max-w-lg mx-auto`), `rounded-3xl bg-surface-container-low shadow-lg`, smooth transitions between steps (`duration-400`).

7. Test the full flow locally:
   - Navigate to `/onboarding`
   - Complete all 5 steps
   - Verify preferences saved to DB via Supabase dashboard
   - Verify `archetype_id` is populated

8. Commit:

```bash
git commit -m "feat(onboarding): add 5-step preference quiz with archetype mapping"
```

---

### Task 15: Build Market Match Score calculation

**Files:**

- Create: `packages/backend/src/preferences/market-match.service.ts`
- Create: `packages/backend/src/preferences/match-weights.ts`
- Modify: `packages/backend/src/preferences/preferences.module.ts` — add MarketMatchService
- Modify: `packages/backend/src/preferences/preferences.controller.ts` — add match endpoints

**Steps:**

1. Create `match-weights.ts` — maps user priorities to metric weights:

```typescript
export const PRIORITY_WEIGHTS: Record<string, Record<string, number>> = {
  affordability: {
    income_to_buy: 0.4,
    rent_as_pct_income: 0.3,
    years_to_save: 0.3,
  },
  growth: {
    home_value_yoy: 0.35,
    home_price_forecast: 0.35,
    population_growth: 0.3,
  },
  stability: {
    months_of_supply: 0.4,
    days_on_market: 0.3,
    price_stability: 0.3,
  },
  cashflow: {
    gross_yield: 0.4,
    cap_rate: 0.35,
    rent_index: 0.25,
  },
  job_market: {
    unemployment_rate: 0.35,
    job_growth: 0.35,
    income_growth: 0.3,
  },
};
```

2. Create `MarketMatchService`:
   - `calculateMatchScore(userId, geoLevel, regionId)` — fetch user prefs, fetch metrics via MetricResolutionService, compute weighted score
   - `calculateMatchScoresAll(userId, geoLevel)` — for all regions, return sorted array
   - `getTopMatches(userId, geoLevel, limit)` — top N matches

   Calculation:
   - Combine user's priorities into a merged weight map (normalize so weights sum to 1)
   - For each metric, get z-score across all regions (or use existing percentile from scoring)
   - Weighted sum → normalize to 0-100
   - Filter out regions outside budget range (compare home_value to user's budget_min/budget_max)
   - Filter by location preferences if set

3. Add endpoints:
   - `GET /api/preferences/match/:geoLevel/:regionId` — single region match score
   - `GET /api/preferences/match/:geoLevel/top?limit=10` — top matches

4. Build and test:

```bash
curl http://localhost:3001/api/preferences/match/metro/top?limit=10 \
  -H "Authorization: Bearer <user_token>"
```

5. Verify top 10 results make intuitive sense for the user's quiz answers.

6. Commit:

```bash
git commit -m "feat(preferences): add Market Match Score calculation with priority weighting"
```

---

### Task 16: Add frontend Market Match hook and map toggle

**Files:**

- Create: `packages/frontend/lib/data/fetchers/market-match.ts`
- Create: `packages/frontend/lib/data/hooks/useMarketMatch.ts`
- Modify: `packages/frontend/lib/data/fetchers/index.ts` — re-export
- Modify: `packages/frontend/lib/data/hooks/index.ts` — re-export
- Modify: `packages/frontend/lib/data/index.ts` — re-export
- Modify: Map page component to add "PIQ Score / Your Match" toggle

**Steps:**

1. Create fetcher and hook following standard patterns.

2. Add a toggle in the map toolbar (alongside geography pills) that switches between "PropertyIQ Score" and "Your Match Score". Use M3 Segmented Button pattern.

3. When "Your Match Score" is selected:
   - Fetch match scores for all regions at current geo level
   - Apply match scores to the choropleth (same color scale logic as PIQ scores)
   - Update legend to show "Market Match Score"
   - Right panel shows match score alongside PIQ scores

4. Toggle only visible if user has completed the quiz (`quiz_completed_at` is set). Otherwise show nothing.

5. Wrap in `<EntitlementGate type="feature" id="market_match">`:
   - Free: metro only
   - Pro: all geo levels

6. Test with real data and a real user who has completed the quiz.

7. Commit:

```bash
git commit -m "feat(map): add Market Match Score toggle with choropleth rendering"
```

---

### Task 17: Configure entitlements for quiz and match features

**Steps:**

1. Add entitlement entries via the admin system:
   - Feature: `onboarding_quiz` — all tiers: `full`
   - Feature: `market_match` — free: `preview` (metro only), pro: `full`, enterprise: `full`
   - Feature: `personalized_dashboard` — free: `preview` (top 3 only), pro: `full`
   - Feature: `markets_to_watch` — free: `none`, pro: `full`

2. Commit if code-based.

---

### Task 18: Build personalized dashboard page

**Files:**

- Create: `packages/frontend/app/dashboard/page.tsx`
- Create: `packages/frontend/app/dashboard/components/TopMarketsList.tsx`
- Create: `packages/frontend/app/dashboard/components/MarketsToWatch.tsx`
- Create: `packages/frontend/app/dashboard/components/WatchlistUpdates.tsx`
- Create: `packages/frontend/app/dashboard/components/ProfileSummary.tsx`

**Steps:**

1. Create `page.tsx` as a server component that checks if user has completed quiz. If not, show a banner prompting them to `/onboarding`. If yes, render the dashboard.

2. Create `ProfileSummary` — shows user's goal, priorities, budget, location prefs with "Edit" link to account settings or `/onboarding`.

3. Create `TopMarketsList` — calls `useMarketMatch` for top 10. Each item shows:
   - Rank number
   - Market name
   - Match score (colored ring) + PIQ score
   - AI explanation from `useInsight(geoLevel, regionId, 'archetype_match', archetypeId)`
   - "View" link to map with that region selected
   - Free users: top 3 visible, 4-10 blurred with upgrade CTA

4. Create `MarketsToWatch` — markets that recently improved toward the user's preferences. Call `useMarketMatch` with a "trending" flag or compute delta from previous month.

5. Create `WatchlistUpdates` — fetch user's watchlist, show score changes.

6. Layout: follow the wireframe from the design doc. M3 cards with `rounded-xl shadow-sm bg-surface-container-low`.

7. Test with real data:
   - Complete quiz as test user
   - Navigate to `/dashboard`
   - Verify top 10 markets show real scores and real AI explanations
   - Verify match scores are reasonable for the quiz answers

8. Commit:

```bash
git commit -m "feat(dashboard): add personalized dashboard with top markets, watchlist, and AI explanations"
```

---

### Task 19: Phase 2 live verification

**Steps:**

Verify the full personalization flow end-to-end:

- [ ] Quiz saves preferences to DB; archetype_id populated
- [ ] Preferences editable from account settings (add "Edit Preferences" link)
- [ ] Match score calculated for real user against all metros; top 10 results make intuitive sense
- [ ] Map choropleth toggles between PIQ score and Match score with real data
- [ ] Dashboard renders top 10 with real scores, real match values
- [ ] Archetype-based AI explanations reference actual metro names and real metric values
- [ ] Free user sees top 3 + blurred 4-10; Pro sees all 10
- [ ] "Markets to Watch" section shows markets with improving match scores

---

## Phase 3: Content & Growth (Market Pages + OG + Lead Magnet + Digest Email)

### Task 20: Add AI content to market landing pages

**Files:**

- Modify: `packages/frontend/app/markets/[slug]/MetroPageContent.tsx` — add AI overview section
- Modify: `packages/backend/src/insights/insight-prompts.ts` — add `market_overview` prompt template

**Steps:**

1. Add a `market_overview` prompt template (500-800 word market analysis) to `insight-prompts.ts`. Structure: Market Overview → Key Trends → Who Is This Market For → Outlook.

2. In `MetroPageContent.tsx`, add `useInsight(geoLevel, cbsaCode, 'market_overview')` call. Render the content below the score widgets in a new section.

3. Add structured data (JSON-LD) for the AI content to improve SEO.

4. Run batch generation for `market_overview` insight type for all metros.

5. Verify 10 market pages show accurate, data-grounded AI content.

6. Commit:

```bash
git commit -m "feat(markets): add AI-generated market overview to metro landing pages"
```

---

### Task 21: Add dynamic OG images

**Files:**

- Create: `packages/frontend/app/api/og/route.tsx` — OG image generation endpoint
- Modify: `packages/frontend/app/markets/[slug]/page.tsx` — dynamic OG image URL

**Steps:**

1. Install `@vercel/og` if not present. Create an API route that generates an OG image:
   - Accepts query params: `title`, `score`, `insight` (first sentence)
   - Renders: PropertyIQ logo + market name + score ring + one-liner insight
   - Returns PNG 1200x630

2. Update market page `generateMetadata()` to use dynamic OG image URL:

```typescript
images: [
  {
    url: `/api/og?title=${encodeURIComponent(metro.shortName)}&score=${score}`,
    width: 1200,
    height: 630,
  },
];
```

3. Test with social preview tools (Twitter Card Validator, LinkedIn Post Inspector).

4. Commit:

```bash
git commit -m "feat(og): add dynamic OG image generation for market pages"
```

---

### Task 22: Build free report lead magnet

**Files:**

- Create: `packages/frontend/app/markets/[slug]/components/LeadMagnetModal.tsx`
- Create: `packages/frontend/app/api/lead-magnet/route.ts` — email capture + PDF generation
- Modify: `packages/frontend/app/markets/[slug]/MetroPageContent.tsx` — add CTA button

**Steps:**

1. Create `LeadMagnetModal` — M3 dialog (`rounded-[28px] shadow-lg bg-surface-container-high`) with name + email fields and "Get Free Report" button.

2. Create API route that:
   - Validates email
   - Adds contact to Resend audience (use Resend contacts API)
   - Generates a lightweight 2-page PDF snapshot using the existing scores + metrics + cached market_overview insight
   - Sends PDF via Resend email attachment
   - Returns success

3. Add "Get Free Market Report" button to `MetroPageContent.tsx`.

4. Test: submit a real email, verify PDF arrives with real data.

5. Commit:

```bash
git commit -m "feat(markets): add free report lead magnet with email capture and PDF delivery"
```

---

### Task 23: Build monthly personalized digest email

**Files:**

- Create: `packages/emails/emails/monthly-digest.tsx`
- Create: `packages/backend/src/email/monthly-digest.service.ts`
- Modify: `packages/backend/src/email/email.module.ts`

**Steps:**

1. Create `monthly-digest.tsx` template following the design doc example. Props:

```typescript
interface MonthlyDigestProps {
  name: string;
  goal: string;
  priorities: string[];
  budgetRange: string;
  topMarkets: Array<{
    name: string;
    matchScore: number;
    piqScore: number;
    change: number;
  }>;
  watchlistMovers: Array<{
    name: string;
    oldScore: number;
    newScore: number;
    direction: "up" | "down";
  }>;
  marketToWatch: { name: string; reason: string } | null;
  dashboardUrl: string;
}
```

2. Create `monthly-digest.service.ts`:
   - Triggered manually or via cron after scoring pipeline (`@Cron('0 12 1 * *')` — 1st of each month at noon)
   - Queries all users with `quiz_completed_at IS NOT NULL`
   - For each user: fetch preferences, compute top matches, fetch watchlist changes, get "market to watch" from cached insight
   - Send personalized email via `emailService.sendEmail()`

3. Personalization layers used: name, quiz-aware (goal/priorities/budget), watchlist-aware, AI narrative (archetype insight for "market to watch").

4. Test with real user data — verify all numbers match live data.

5. Commit:

```bash
git commit -m "feat(emails): add monthly personalized digest with match scores and watchlist updates"
```

---

### Task 24: Phase 3 live verification

**Steps:**

- [ ] Market page AI content generated for all ~900 metros; spot-check 10 for factual accuracy
- [ ] OG card renders correct score when sharing a market URL (test with social preview tool)
- [ ] Lead magnet PDF generated for 3+ metros; numbers match live data
- [ ] Email captured via lead magnet appears in Resend contacts
- [ ] Monthly digest email sent to real test account with real data; all numbers verifiable

---

## Phase 4: Premium Features (Research Briefs + Widget + Blog + Alerts)

### Task 25: Create Custom Research report template type

**Files:**

- Create: `packages/backend/src/reports/research-brief/research-brief.service.ts`
- Create: `packages/backend/src/reports/research-brief/research-tools.ts`
- Create: `packages/backend/src/reports/research-brief/research-prompts.ts`
- Modify: `packages/backend/src/reports/reports.module.ts` — add ResearchBriefService
- Modify: `packages/backend/src/reports/reports-orchestrator.ts` — handle `custom_research` template type

**Steps:**

1. Create `research-tools.ts` — tool definitions for Claude tool-use (similar to Quinn's `analytics-tools.service.ts`):
   - `get_market_snapshot` — calls MarketSnapshotService
   - `compare_markets` — calls scoring for multiple regions
   - `get_timeseries` — calls time series for specific metric/region
   - `get_rankings` — top/bottom markets by score
   - `search_news` — calls ClaudeNewsService

2. Create `research-brief.service.ts`:
   - `generateClarifyingQuestions(userQuestion, userContext)` — Claude call that returns 2-3 structured questions with options
   - `executeResearch(userQuestion, clarifyingAnswers, userContext)` — Claude tool-use loop (max 5 iterations) that gathers data
   - `generateNarrative(structuredData, newsData)` — DeepSeek call that writes the research brief sections

3. Create `research-prompts.ts` — system prompts for the research agent:
   - Research agent system prompt (tool-use context, data grounding rules)
   - Narrative generation prompt template (section structure: Executive Summary, Data Analysis, Recent Developments, Outlook, Sources)

4. Modify `reports-orchestrator.ts` to handle `template_slug === 'custom_research'`:
   - Instead of the standard narrative generation flow, call `ResearchBriefService.executeResearch()`
   - Store results in the same `ai_narratives` JSON field

5. Insert `custom_research` template row in `report_templates` table:

```sql
INSERT INTO report_templates (slug, name, description, tier_required, is_active, config)
VALUES ('custom_research', 'Custom Research Brief', 'AI-powered deep dive on any real estate question', 'pro', true, '{"sections": ["executive_summary", "data_analysis", "recent_developments", "outlook", "sources"]}');
```

6. Build and test:

```bash
cd packages/backend && npm run build
```

7. Commit:

```bash
git commit -m "feat(reports): add Custom Research Brief template with agentic data gathering"
```

---

### Task 26: Build research brief frontend — topic selection + clarifying questions

**Files:**

- Create: `packages/frontend/app/reports/research/page.tsx`
- Create: `packages/frontend/app/reports/research/components/TopicSelector.tsx`
- Create: `packages/frontend/app/reports/research/components/ClarifyingQuestions.tsx`
- Create: `packages/frontend/app/reports/research/components/ResearchProgress.tsx`

**Steps:**

1. Create `TopicSelector`:
   - Show 3-5 contextual topic suggestions (based on watchlist, quiz, recent activity)
   - Suggestions are computed client-side from existing data (no AI call)
   - Free text input with placeholder "What do you want to research?"
   - M3 card layout with suggestion chips

2. Create `ClarifyingQuestions`:
   - After user submits topic, POST to backend for clarifying questions
   - Render returned questions as chip groups (M3 Filter Chips)
   - Max 3 questions, multiple choice with "Other" freetext
   - "Generate Research Brief" button after answering

3. Create `ResearchProgress`:
   - Shows generation progress (similar to existing report generation)
   - Poll report status until `status === 'ready'`

4. Create `page.tsx` that orchestrates: TopicSelector → ClarifyingQuestions → ResearchProgress → redirect to `/reports/[id]` when done.

5. Wrap in `<EntitlementGate type="feature" id="custom_research">`.

6. Test the full flow with a real question against live data.

7. Commit:

```bash
git commit -m "feat(reports): add research brief UI with topic selection and clarifying questions"
```

---

### Task 27: Build embeddable score widget

**Files:**

- Create: `packages/frontend/app/embed/score/[geoLevel]/[geoId]/page.tsx`

**Steps:**

1. Create a minimal page that renders only: market name, score ring (ScoreDisplay), trend arrow, and "Powered by PropertyIQ" link. No nav, no sidebar, no auth required.

2. Set `display: 'minimal'` in layout — no header/footer.

3. Add CORS headers to allow iframe embedding.

4. Test by embedding in a plain HTML file:

```html
<iframe
  src="http://localhost:3000/embed/score/metro/31080"
  width="300"
  height="180"
></iframe>
```

5. Verify real score renders.

6. Commit:

```bash
git commit -m "feat(embed): add embeddable score widget route"
```

---

### Task 28: Build auto-generated blog post pipeline

**Files:**

- Create: `packages/backend/src/insights/blog-generator.service.ts`
- Create: `packages/backend/src/insights/blog-prompts.ts`

**Steps:**

1. Create `blog-prompts.ts` with templates for 3 monthly posts:
   - "Top 10 Markets for Homebuyers" — uses top 10 HomeReady scores
   - "Top 10 Markets for Investors" — uses top 10 InvestorEdge scores
   - "Markets to Watch: Biggest Score Movers" — uses largest month-over-month score changes

2. Create `blog-generator.service.ts`:
   - `generateMonthlyPosts()` — fetches top scores from DB, builds prompt context, calls DeepSeek, outputs MDX frontmatter + content
   - Returns MDX strings (not written to disk — admin reviews and commits manually, or we add an admin endpoint)

3. Add admin endpoint: `POST /api/admin/blog/generate` → returns generated MDX content for review.

4. Test: call the endpoint, verify the generated MDX references real markets with real scores.

5. Commit:

```bash
git commit -m "feat(blog): add monthly blog post generation pipeline with DeepSeek"
```

---

### Task 29: Build threshold alert system

**Files:**

- Create: `packages/backend/src/alerts/threshold-alert.service.ts`
- Create: `packages/emails/emails/threshold-alert.tsx`
- Modify: `packages/backend/src/email/email.module.ts`

**Steps:**

1. Create email template `threshold-alert.tsx` — personable, brief: "Hey {name}, {market} just crossed {threshold} on {scoreType}. [View on map →]"

2. Create `threshold-alert.service.ts`:
   - Triggered after scoring pipeline completes (or via cron on the 1st of each month)
   - Queries `user_alerts` for active threshold alerts
   - For each alert: check current score vs threshold condition
   - If threshold crossed: send email, log to `alert_history`
   - Avoid re-alerting (check `alert_history` for recent trigger)

3. This relies on the existing `user_alerts` and `alert_history` tables (already exist per the email exploration).

4. Test: create a threshold alert for a real market, verify email fires when score exceeds threshold.

5. Commit:

```bash
git commit -m "feat(alerts): add threshold-based score alert emails"
```

---

### Task 30: Phase 4 live verification

**Steps:**

- [ ] Research brief generated for 3+ question types; all numbers verified against live API
- [ ] Clarifying questions render and answers flow into generation
- [ ] News section includes real, dated, sourced news items
- [ ] Brief stored as report, shareable via link, downloadable as PDF
- [ ] Embeddable widget renders live score for any valid metro
- [ ] Blog posts generated from real scoring data; rankings match `propertyiq_scores` table
- [ ] Threshold alert fires when a real score crosses user-defined threshold

---

## Post-Implementation

### Final Integration Verification

After all 4 phases are complete, run a full end-to-end verification:

1. **New user journey:** Sign up → receive Day 0 email → explore map (see insights) → complete quiz → see dashboard with match scores → generate research brief → share market page (see OG card)

2. **Monthly cycle:** Trigger scoring pipeline → trigger insight batch → trigger blog generation → trigger monthly digest → verify all content references real, current data

3. **Entitlements:** Verify every feature's free vs pro behavior matches the entitlements admin configuration

### Metrics to Track

- Insight cache hit rate (should be >95% after first month)
- Quiz completion rate
- Match score engagement (how often toggle is used)
- Research brief generation count
- Email open/click rates per template
- Lead magnet conversion rate
- Upgrade conversion from gated features
