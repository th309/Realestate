# PropertyIQ Report Suite Redesign - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign all report types (HomeReady, InvestorEdge, Comparison, Market Snapshot) with score-driven narrative architecture, integrated AI analysis, personalization, contextual recommendation slots, PDF export, and interactive personalization.

**Architecture:** Score-as-backbone approach where each report section maps to a score component. Shared infrastructure (core components, recommendation slots, partner config) is built first, then each report type layers on top. Backend changes add score component breakdowns and per-section AI narrative generation. Frontend replaces existing section components with the new design system.

**Tech Stack:** React 19, Next.js 16, Tailwind CSS v4, Recharts, Framer Motion, Vitest + React Testing Library, NestJS backend, Supabase/PostgreSQL

**Design doc:** `docs/plans/2026-02-16-homeready-report-redesign-design.md`

---

## Phase 1: Shared Infrastructure

### Task 1: Add Score Component Breakdown to Backend

The scoring service currently returns only final scores (0-100). The new reports need per-component scores. Add component breakdown calculation to the scoring service.

**Files:**
- Modify: `packages/backend/src/scoring/scoring.service.ts`
- Modify: `packages/backend/src/scoring/scoring.types.ts`
- Modify: `packages/backend/src/scoring/formula-weights.ts`
- Create: `packages/backend/src/scoring/__tests__/component-breakdown.spec.ts`

**Step 1: Add component types to scoring.types.ts**

Add to the existing types:

```typescript
export interface ScoreComponentBreakdown {
  component: string;           // 'affordability', 'market_timing', 'stability', 'growth_potential'
  score: number;               // 0-100 normalized
  weight: number;              // 0-1 weight in overall score
  status: 'excellent' | 'strong' | 'moderate' | 'watch' | 'concern';
  contributing_metrics: {
    metric: string;
    z_score: number;
    direction: 'positive' | 'negative';  // Whether higher is better
    raw_value: number | null;
  }[];
}

export interface ScoreWithComponents {
  score: number;
  grade: string;
  confidence: number;
  confidence_level: ConfidenceLevel;
  components: ScoreComponentBreakdown[];
}
```

**Step 2: Add component groupings to formula-weights.ts**

Map which metrics belong to which component for each score type and geography level:

```typescript
export const COMPONENT_GROUPS: Record<string, Record<string, Record<string, string[]>>> = {
  homeready: {
    metro: {
      affordability: ['affordability_ratio', 'median_income'],
      market_timing: ['demand_score', 'hotness_score'],
      stability: ['days_on_market', 'supply_score'],
      growth_potential: ['population_growth', 'zhvi_yoy'],
    },
    // county, zip...
  },
  investoredge: {
    metro: {
      cash_flow: ['median_gross_rent', 'cap_rate', 'gross_yield'],
      rent_demand: ['demand_score', 'zori_yoy'],
      appreciation: ['zhvi_yoy', 'days_on_market'],
      entry_point: ['affordability_ratio', 'price_to_rent'],
      risk: ['supply_score', 'price_volatility'],
    },
    // county, zip...
  },
};
```

**Step 3: Implement calculateComponentBreakdown in scoring.service.ts**

Add a method that, given the z_scores and formula weights for a location, groups them by component and produces per-component scores:

```typescript
private calculateComponentBreakdown(
  scoreType: string,
  geography: string,
  zScores: Record<string, number>,
  rawValues: Record<string, number | null>,
): ScoreComponentBreakdown[] {
  const groups = COMPONENT_GROUPS[scoreType]?.[geography];
  if (!groups) return [];

  return Object.entries(groups).map(([component, metrics]) => {
    const weights = FORMULA_WEIGHTS[scoreType]?.[geography] || {};
    let weightedSum = 0;
    let totalWeight = 0;
    const contributingMetrics = [];

    for (const metric of metrics) {
      const z = zScores[metric];
      const w = Math.abs(weights[metric] || 0);
      if (z !== undefined && w > 0) {
        weightedSum += z * w;
        totalWeight += w;
        contributingMetrics.push({
          metric,
          z_score: z,
          direction: (weights[metric] || 0) > 0 ? 'positive' : 'negative',
          raw_value: rawValues[metric] ?? null,
        });
      }
    }

    const rawComponentScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    // Normalize to 0-100 using same percentile approach as main score
    const score = this.normalizeComponentScore(rawComponentScore);

    return {
      component,
      score,
      weight: totalWeight,
      status: this.getComponentStatus(score),
      contributing_metrics: contributingMetrics,
    };
  });
}
```

**Step 4: Wire component breakdown into getScore response**

When `options.expanded === true` or a new `options.components === true` flag is set, include the component breakdown in the response.

**Step 5: Write tests**

```typescript
describe('Score Component Breakdown', () => {
  it('should return 4 components for homeready metro', () => { ... });
  it('should return 5 components for investoredge metro', () => { ... });
  it('should normalize component scores to 0-100', () => { ... });
  it('should assign correct status labels', () => { ... });
  it('should include contributing metrics with z-scores', () => { ... });
});
```

**Step 6: Run tests**

Run: `cd packages/backend && npm test -- --grep "Component Breakdown"`

**Step 7: Commit**

```bash
git add packages/backend/src/scoring/
git commit -m "feat: add score component breakdown calculation to scoring service"
```

---

### Task 2: Add Per-Section AI Narrative Generation

The current AI narrative generation produces a flat dictionary of narrative keys. The new reports need section-specific narratives that reference score components, benchmarks, and user inputs.

**Files:**
- Modify: `packages/backend/src/reports/reports.service.ts`
- Modify: `packages/backend/src/claude/claude.service.ts`
- Create: `packages/backend/src/reports/narrative-prompts.ts`

**Step 1: Create narrative prompt templates**

Create `narrative-prompts.ts` with structured prompts for each section type. Each prompt template receives the full context (score, components, metrics, benchmarks, user inputs) and produces section-specific content.

```typescript
export const NARRATIVE_PROMPTS: Record<string, NarrativePromptConfig> = {
  hero_verdict: {
    prompt_template: `You are a real estate market analyst. Write a single compelling sentence summarizing the {{geography_name}} market for a homebuyer.
Score: {{homeready_score}}/100 ({{homeready_grade}})
Key strength: {{strongest_component}} ({{strongest_score}}/100)
Key concern: {{weakest_component}} ({{weakest_score}}/100)
Output ONLY the single sentence, no quotes.`,
    max_tokens: 100,
    output_format: 'text',
  },

  score_story: {
    prompt_template: `Write 2-3 sentences connecting these score components into a narrative for a homebuyer considering {{geography_name}}:
{{component_summary}}
Explain how these components relate to each other. Be specific with numbers.`,
    max_tokens: 200,
    output_format: 'text',
  },

  affordability_narrative: {
    prompt_template: `You are a real estate analyst writing about affordability in {{geography_name}} for a homebuyer.

Data:
- Affordability component score: {{affordability_score}}/100
- Median listing price: {{median_listing_price}}
- Median household income: {{median_income}}
- Price-to-income ratio: {{price_to_income}}
- National median price: {{national_median_price}}
- State median price: {{state_median_price}}
- Affordability trend: {{affordability_trend}}
{{#if user_income}}
- Buyer's household income: {{user_income}}
- Buyer's down payment: {{user_down_payment}}
{{/if}}

Write 2-3 paragraphs. First paragraph: interpret the affordability data. Second: compare to benchmarks. Third (if buyer income provided): personalized affordability assessment.
Be factual. Reference specific numbers. No speculation.`,
    max_tokens: 400,
    output_format: 'text',
  },

  market_timing_narrative: { /* similar structure */ },
  stability_narrative: { /* similar structure */ },
  growth_potential_narrative: { /* similar structure */ },
  priorities_narrative: { /* uses user priorities */ },
  bottom_line_narrative: { /* synthesizes all components */ },
  bottom_line_actions: { /* outputs JSON array of 3 action items */ },
  bottom_line_watch: { /* outputs JSON array of 2-3 metrics to watch */ },
};
```

**Step 2: Add generateSectionNarratives method to reports.service.ts**

```typescript
async generateSectionNarratives(
  report: ReportInstance,
  components: ScoreComponentBreakdown[],
  userInputs?: UserInputs,
): Promise<Record<string, string | string[] | object>> {
  const context = this.buildNarrativeContext(report, components, userInputs);
  const narratives: Record<string, string | string[] | object> = {};

  for (const [sectionId, config] of Object.entries(NARRATIVE_PROMPTS)) {
    const prompt = this.interpolateTemplate(config.prompt_template, context);
    narratives[sectionId] = await this.claudeService.generateNarrative(
      prompt, config.max_tokens, config.output_format
    );
  }

  return narratives;
}
```

**Step 3: Update generateReportAsync to use new narrative system**

After fetching scores with components, pass them to the new narrative generator.

**Step 4: Commit**

```bash
git add packages/backend/src/reports/ packages/backend/src/claude/
git commit -m "feat: add per-section AI narrative generation with score component context"
```

---

### Task 3: Create Partner Recommendation Infrastructure

**Files:**
- Create: `packages/backend/src/partners/partners.module.ts`
- Create: `packages/backend/src/partners/partners.service.ts`
- Create: `packages/backend/src/partners/partners.controller.ts`
- Create: `packages/backend/src/partners/dto/partner.dto.ts`
- Create migration for `partner_config` table

**Step 1: Create database migration**

```sql
-- partner_config table
CREATE TABLE IF NOT EXISTS partner_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  context_type TEXT NOT NULL,  -- 'affordability', 'timing', 'stability', 'growth', 'verdict', 'cash_flow', 'agent_services'
  description_template TEXT NOT NULL,  -- Supports {{score_component}}, {{score_value}}, {{geography_name}}
  cta_text TEXT NOT NULL,
  cta_url TEXT NOT NULL,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  geography_filter JSONB,  -- Optional: restrict to specific geos
  tier_filter TEXT[],  -- Optional: restrict to specific tiers
  priority INTEGER DEFAULT 0,  -- For ordering when multiple match
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partner_config_context ON partner_config(context_type) WHERE is_active = true;
```

**Step 2: Create PartnersService**

```typescript
@Injectable()
export class PartnersService {
  async getRecommendationsForReport(
    contextTypes: string[],
    geography?: string,
    tier?: string,
  ): Promise<Record<string, PartnerRecommendation | null>> {
    // For each context_type, find the highest-priority active partner
    // that matches geography and tier filters
    // Returns null for context types with no matching partner
  }
}
```

**Step 3: Add partner data to report populated_data**

In `generateReportAsync`, after all other data is assembled, call `partnersService.getRecommendationsForReport()` and add to `populated_data.recommendations`.

**Step 4: Commit**

```bash
git add packages/backend/src/partners/ scripts/migrations/
git commit -m "feat: add partner recommendation infrastructure with context-based matching"
```

---

### Task 4: Create New Core Frontend Components

New shared components that all report sections will use.

**Files:**
- Create: `packages/frontend/app/reports/[id]/components/sections/core/ComponentScoreBadge.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/core/MetricsRow.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/core/RecommendationSlot.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/core/VerdictBadge.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/core/PersonalizedInsight.tsx`
- Modify: `packages/frontend/app/reports/[id]/components/sections/core/index.ts`
- Create: `packages/frontend/app/reports/[id]/components/sections/core/__tests__/ComponentScoreBadge.test.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/core/__tests__/RecommendationSlot.test.tsx`

**Step 1: Build ComponentScoreBadge**

Displays a score component with its score, grade, and status indicator.

```typescript
interface ComponentScoreBadgeProps {
  component: string;       // 'affordability', 'market_timing', etc.
  score: number;           // 0-100
  label: string;           // Human-readable label
  status: 'excellent' | 'strong' | 'moderate' | 'watch' | 'concern';
  helping?: boolean;       // Is this component helping or hurting?
  compact?: boolean;
}

export function ComponentScoreBadge({ component, score, label, status, helping, compact }: ComponentScoreBadgeProps) {
  // Circular score ring (small) + label + status pill
  // Color coded by status: excellent/strong=green, moderate=amber, watch/concern=red
}
```

**Step 2: Build MetricsRow**

Displays 3-4 metrics in a row with optional benchmark comparisons.

```typescript
interface MetricsRowProps {
  metrics: Array<{
    label: string;
    value: number | null;
    format: MetricFormat;
    benchmark?: { label: string; value: number | null };
    trend?: MetricTrend;
  }>;
}
```

**Step 3: Build RecommendationSlot**

Self-hiding component that renders only when a partner recommendation exists.

```typescript
interface RecommendationSlotProps {
  contextType: string;
  report: ReportInstance;
}

export function RecommendationSlot({ contextType, report }: RecommendationSlotProps) {
  const recommendation = report.populated_data?.recommendations?.[contextType];
  if (!recommendation) return null;  // Self-hiding!

  return (
    <div className="mt-6 p-4 rounded-lg border border-[rgba(27,46,74,0.08)] bg-[var(--report-cream)]">
      <p className="text-[10px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--report-stone-light)' }}>
        Recommended next step
      </p>
      {/* Partner logo, description, CTA */}
      <p className="text-xs mt-3" style={{ color: 'var(--report-stone-light)' }}>
        PropertyIQ may receive compensation from partners.
      </p>
    </div>
  );
}
```

**Step 4: Build VerdictBadge**

```typescript
interface VerdictBadgeProps {
  verdict: 'positive' | 'cautious' | 'wait';
  label: string;  // "Good time to buy", "Proceed with caution", "Wait and watch"
}
```

**Step 5: Build PersonalizedInsight**

Conditional component that only renders when relevant user inputs exist.

```typescript
interface PersonalizedInsightProps {
  content: string;      // AI-generated personalized text
  inputsUsed: string[]; // e.g., ['income', 'down_payment']
}

export function PersonalizedInsight({ content, inputsUsed }: PersonalizedInsightProps) {
  if (!content) return null;
  // Renders with a subtle "Personalized for you" label
}
```

**Step 6: Write tests for ComponentScoreBadge and RecommendationSlot**

```typescript
describe('ComponentScoreBadge', () => {
  it('renders score and label', () => { ... });
  it('applies correct color for each status', () => { ... });
  it('renders compact variant', () => { ... });
});

describe('RecommendationSlot', () => {
  it('renders nothing when no recommendation exists', () => {
    const report = { populated_data: { recommendations: {} } };
    const { container } = render(<RecommendationSlot contextType="affordability" report={report} />);
    expect(container.firstChild).toBeNull();
  });
  it('renders partner card when recommendation exists', () => { ... });
  it('includes compensation disclosure', () => { ... });
});
```

**Step 7: Run tests**

Run: `cd packages/frontend && npx vitest run --grep "ComponentScoreBadge|RecommendationSlot"`

**Step 8: Update core/index.ts exports**

Add all new components to the barrel export.

**Step 9: Commit**

```bash
git add packages/frontend/app/reports/[id]/components/sections/core/
git commit -m "feat: add core report components - ComponentScoreBadge, MetricsRow, RecommendationSlot, VerdictBadge, PersonalizedInsight"
```

---

### Task 5: Update Frontend Score Types

**Files:**
- Modify: `packages/frontend/lib/data/types.ts`
- Modify: `packages/frontend/app/reports/types.ts`

**Step 1: Add component breakdown types to frontend**

Mirror the backend types in the frontend:

```typescript
export interface ScoreComponentBreakdown {
  component: string;
  score: number;
  weight: number;
  status: 'excellent' | 'strong' | 'moderate' | 'watch' | 'concern';
  contributing_metrics: {
    metric: string;
    z_score: number;
    direction: 'positive' | 'negative';
    raw_value: number | null;
  }[];
}
```

**Step 2: Update ReportInstance type**

Add `scores_snapshot.homeready.components`, `partner_recommendations`, and ensure `user_inputs` is typed.

**Step 3: Commit**

```bash
git add packages/frontend/lib/data/types.ts packages/frontend/app/reports/types.ts
git commit -m "feat: add score component breakdown and partner types to frontend"
```

---

## Phase 2: HomeReady Report Sections

### Task 6: Build Hero Section

**Files:**
- Create: `packages/frontend/app/reports/[id]/components/sections/homebuyer/Hero.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/homebuyer/__tests__/Hero.test.tsx`

**Step 1: Build Hero component**

Large score display, AI verdict, confidence indicator, priority tags, trend arrow. Uses:
- `report.homeready_score` for score
- `report.scores_snapshot?.homeready?.grade` for grade
- `report.ai_narrative?.hero_verdict` for one-line AI verdict
- `report.scores_snapshot?.homeready?.confidence_level` for confidence
- `report.user_inputs?.priorities` for priority tags
- `report.scores_snapshot?.homeready?.trend_change` for trend arrow

Layout: Score ring (left) + verdict + meta info (right). Priority tags below. Confidence badge.

**Step 2: Write tests**

Test: renders score, renders verdict, renders priority tags when present, hides priority tags when absent, shows confidence level.

**Step 3: Run tests, commit**

---

### Task 7: Build Score Story Section

**Files:**
- Create: `packages/frontend/app/reports/[id]/components/sections/homebuyer/ScoreStory.tsx`

**Step 1: Build ScoreStory component**

Visual component breakdown showing all 4 components as horizontal bars with scores and status labels. Brief AI paragraph connecting them.

Uses:
- `report.scores_snapshot?.homeready?.components[]` for component data
- `report.ai_narrative?.score_story` for connecting narrative

Layout: 4 horizontal bars (sorted by score descending), each with ComponentScoreBadge + bar + status label. AI paragraph below.

**Step 2: Write tests, run, commit**

---

### Task 8: Build Affordability Deep Dive Section

**Files:**
- Create: `packages/frontend/app/reports/[id]/components/sections/homebuyer/AffordabilityDeepDive.tsx`

**Step 1: Build AffordabilityDeepDive component**

Follows the universal section pattern:
1. ComponentScoreBadge for affordability component
2. MetricsRow: median_listing_price, median_income, affordability_ratio, price-to-income
3. TrendSparkline: 6-month affordability trend
4. AIAnalysisBlock: `report.ai_narrative?.affordability_narrative`
5. PersonalizedInsight: If `report.user_inputs?.income` exists
6. RecommendationSlot: contextType='affordability'

Data access via `metricHelpers.ts`:
- `getMetricWithAliases(report, 'median_listing_price')`
- `getMetricWithAliases(report, 'median_income')`
- `report.populated_data?.benchmarks?.national?.median_listing_price`
- `report.populated_data?.historical?.affordability_ratio`

**Step 2: Write tests, run, commit**

---

### Task 9: Build Market Timing Deep Dive Section

**Files:**
- Create: `packages/frontend/app/reports/[id]/components/sections/homebuyer/MarketTimingDeepDive.tsx`

**Step 1: Build component following universal section pattern**

Metrics: days_on_market, active_listing_count, hotness_score, pending_ratio
Chart: DOM trend + inventory trend (dual)
AI: `report.ai_narrative?.market_timing_narrative`
Recommendation: contextType='timing'

**Step 2: Write tests, run, commit**

---

### Task 10: Build Stability Deep Dive Section

**Files:**
- Create: `packages/frontend/app/reports/[id]/components/sections/homebuyer/StabilityDeepDive.tsx`

**Step 1: Build component following universal section pattern**

Metrics: price volatility, DOM consistency, supply_score
Chart: ZHVI trend showing price consistency
AI: `report.ai_narrative?.stability_narrative`
Recommendation: contextType='stability'

**Step 2: Write tests, run, commit**

---

### Task 11: Build Growth Potential Deep Dive Section

**Files:**
- Create: `packages/frontend/app/reports/[id]/components/sections/homebuyer/GrowthPotentialDeepDive.tsx`

**Step 1: Build component following universal section pattern**

Metrics: ZHVI YoY, population growth, job growth, hotness_score
Chart: Home value appreciation trend
AI: `report.ai_narrative?.growth_potential_narrative`
Dollar impact: From backtesting data (extended history)
Recommendation: contextType='growth'

**Step 2: Write tests, run, commit**

---

### Task 12: Build Your Priorities Section

**Files:**
- Create: `packages/frontend/app/reports/[id]/components/sections/homebuyer/YourPriorities.tsx`

**Step 1: Build conditional section**

Only renders if `report.user_inputs?.priorities` has values.

Reframes findings through user's priority lens:
- Priority #1 gets lead treatment with supporting/challenging factors
- If income provided: personalized affordability math
- Cross-references component scores to user priorities

AI: `report.ai_narrative?.priorities_narrative`

**Step 2: Write tests, run, commit**

---

### Task 13: Build The Bottom Line Section

**Files:**
- Create: `packages/frontend/app/reports/[id]/components/sections/homebuyer/BottomLine.tsx`

**Step 1: Build the actionable synthesis section**

Components:
- VerdictBadge: "Good time to buy" / "Proceed with caution" / "Wait and watch"
- AI executive summary: `report.ai_narrative?.bottom_line_narrative`
- 3 action items: `report.ai_narrative?.bottom_line_actions` (JSON array)
- What to watch: `report.ai_narrative?.bottom_line_watch` (JSON array with metric + threshold)
- RecommendationSlot: contextType='verdict'

**Step 2: Write tests, run, commit**

---

### Task 14: Build Market Pulse Section (Appendix)

**Files:**
- Create: `packages/frontend/app/reports/[id]/components/sections/shared/MarketPulse.tsx`

**Step 1: Build appendix-style section**

Shared across report types. Displays:
- Local news: `report.populated_data?.realtime?.news`
- Economic indicators from realtime data
- Market sentiment gauge: `report.populated_data?.realtime?.signal_summary`

This is a supporting section - lighter design treatment than deep dives.

**Step 2: Write tests, run, commit**

---

### Task 15: Wire HomeReady Template

**Files:**
- Modify: `packages/frontend/app/reports/[id]/components/templates/index.ts`
- Modify: `packages/frontend/app/reports/[id]/components/sections/homebuyer/index.ts`

**Step 1: Update homebuyer index.ts barrel export**

Export all new components: Hero, ScoreStory, AffordabilityDeepDive, MarketTimingDeepDive, StabilityDeepDive, GrowthPotentialDeepDive, YourPriorities, BottomLine.

**Step 2: Update template registry**

Replace the existing homeready template sections with the new ones:

```typescript
homeready: {
  name: 'HomeReady Report',
  description: 'Score-driven homebuyer market analysis',
  sections: [
    { component: Hero, id: 'hero' },
    { component: ScoreStory, id: 'score-story' },
    { component: AffordabilityDeepDive, id: 'affordability' },
    { component: MarketTimingDeepDive, id: 'market-timing' },
    { component: StabilityDeepDive, id: 'stability' },
    { component: GrowthPotentialDeepDive, id: 'growth-potential' },
    { component: YourPriorities, id: 'your-priorities' },
    { component: BottomLine, id: 'bottom-line' },
    { component: MarketPulse, id: 'market-pulse' },
  ],
},
```

**Step 3: Commit**

```bash
git add packages/frontend/app/reports/[id]/components/
git commit -m "feat: wire new HomeReady report template with score-driven sections"
```

---

### Task 16: Update ReportViewer for New Sections

**Files:**
- Modify: `packages/frontend/app/reports/[id]/ReportViewer.tsx`

**Step 1: Update hero area**

The ReportViewer currently renders its own hero area (title, meta, table of contents) above the template sections. With the new Hero section as part of the template, adjust the viewer to not duplicate hero content. The viewer should render a minimal header (back button, action buttons) and let the template sections handle the hero.

**Step 2: Update table of contents generation**

Update `SectionIcon` and `formatSectionName` to handle new section IDs.

**Step 3: Commit**

```bash
git add packages/frontend/app/reports/[id]/ReportViewer.tsx
git commit -m "feat: update ReportViewer to support new score-driven section layout"
```

---

## Phase 3: InvestorEdge Report

### Task 17: Build InvestorEdge Sections

Same architecture as HomeReady, different score components and metrics.

**Files:**
- Create: `packages/frontend/app/reports/[id]/components/sections/investor/InvestorHero.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/investor/InvestorScoreStory.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/investor/CashFlowDeepDive.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/investor/RentDemandDeepDive.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/investor/AppreciationDeepDive.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/investor/EntryPointDeepDive.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/investor/RiskDeepDive.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/investor/InvestmentThesisSection.tsx` (conditional, like YourPriorities)
- Create: `packages/frontend/app/reports/[id]/components/sections/investor/ProFormaSnapshot.tsx` (conditional, requires budget)
- Create: `packages/frontend/app/reports/[id]/components/sections/investor/InvestorBottomLine.tsx`

**Key differences from HomeReady:**
- Uses `report.investoredge_score` and InvestorEdge components (cash_flow, rent_demand, appreciation, entry_point, risk)
- Metrics: cap_rate, gross_yield, GRM, ZORI, rent-to-price, vacancy indicators
- ProFormaSnapshot calculates simplified pro forma from user's budget + market medians
- InvestmentThesis frames findings by strategy (buy-and-hold, flip, BRRRR)
- Recommendation contexts: 'cash_flow', 'entry_point', 'risk', 'pro_forma', 'verdict'

**Step 1-5:** Build each section following the same universal pattern. Each gets tests.

**Step 6: Add narrative prompts for investor sections**

Add to `narrative-prompts.ts`: investor_hero_verdict, investor_score_story, cash_flow_narrative, rent_demand_narrative, appreciation_narrative, entry_point_narrative, risk_narrative, investment_thesis_narrative, investor_bottom_line, investor_actions, investor_watch.

**Step 7: Wire investoredge template**

```typescript
investoredge: {
  name: 'InvestorEdge Report',
  description: 'Score-driven investment opportunity analysis',
  sections: [
    { component: InvestorHero, id: 'investor-hero' },
    { component: InvestorScoreStory, id: 'investor-score-story' },
    { component: CashFlowDeepDive, id: 'cash-flow' },
    { component: RentDemandDeepDive, id: 'rent-demand' },
    { component: AppreciationDeepDive, id: 'appreciation' },
    { component: EntryPointDeepDive, id: 'entry-point' },
    { component: RiskDeepDive, id: 'risk' },
    { component: InvestmentThesisSection, id: 'investment-thesis' },
    { component: ProFormaSnapshot, id: 'pro-forma' },
    { component: InvestorBottomLine, id: 'investor-bottom-line' },
    { component: MarketPulse, id: 'market-pulse' },
  ],
},
```

**Step 8: Commit**

```bash
git add packages/frontend/app/reports/[id]/components/sections/investor/ packages/backend/src/reports/narrative-prompts.ts
git commit -m "feat: add InvestorEdge report with score-driven sections"
```

---

## Phase 4: Comparison Report

### Task 18: Build Comparison Report Sections

**Files:**
- Create: `packages/frontend/app/reports/[id]/components/sections/comparison/ComparisonHero.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/comparison/HeadToHeadScoreStory.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/comparison/ComponentShowdown.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/comparison/PriorityWeightedAnalysis.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/comparison/MarketStrengths.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/comparison/ComparisonVerdict.tsx`

**Key features:**
- Supports 2-3 markets (head-to-head layout for 2, ranked for 3)
- Uses `report.populated_data?.comparisons` for side-by-side data
- Uses `report.populated_data?.priority_weighted_winner` for winner determination
- ComponentShowdown renders one section per score component with side-by-side metrics
- Color coding: green (winner per component), neutral (close), red (trailing)

**Data sources:**
- Primary market: `report.populated_data.current`, `report.scores_snapshot`
- Comparison markets: `report.populated_data.comparisons[geoId].current`, `.scores`
- Winner: `report.populated_data.priority_weighted_winner`

**Step 1-4:** Build each section. ComparisonHero shows all scores side by side. HeadToHeadScoreStory shows component bars for all markets. ComponentShowdown iterates score components with side-by-side metrics. PriorityWeightedAnalysis visualizes the weighted scoring.

**Step 5: Add comparison narrative prompts**

comparison_verdict, component_comparison_* (one per component), priority_analysis, market_strengths_*.

**Step 6: Wire comparison template**

**Step 7: Commit**

---

## Phase 5: Market Snapshot (Agent) - Dual Mode

### Task 19: Build Agent Client-Facing Report

**Files:**
- Create: `packages/frontend/app/reports/[id]/components/sections/agent/ClientOverview.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/agent/ClientPriceValue.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/agent/ClientMarketConditions.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/agent/ClientMeaning.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/agent/AgentBranding.tsx`

**Key features:**
- Uses MarketHealth score (free tier, always available)
- Clean, professional, consumer-accessible language
- 1-2 page equivalent, scannable
- Agent branding section at the bottom

### Task 20: Build Agent Prep View

**Files:**
- Create: `packages/frontend/app/reports/[id]/components/sections/agent/PrepQuickStats.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/agent/PrepTalkingPoints.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/agent/PrepObjectionHandlers.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/agent/PrepCompetitiveContext.tsx`
- Create: `packages/frontend/app/reports/[id]/components/sections/agent/PrepNewsSignals.tsx`

**Key features:**
- Dense, information-rich layout
- AI-generated talking point scripts
- Objection handlers with data-backed responses
- Not for sharing - agent's internal tool

### Task 21: Add Mode Toggle to Market Snapshot

**Files:**
- Modify: `packages/frontend/app/reports/[id]/ReportViewer.tsx`
- Modify: `packages/frontend/app/reports/[id]/components/templates/index.ts`

Add `market_snapshot_client` and `market_snapshot_prep` as separate template types, with a toggle in the viewer when the template is an agent report.

**Step: Commit**

---

## Phase 6: PDF Export

### Task 22: Implement PDF Generation

**Files:**
- Create: `packages/frontend/app/reports/[id]/export/PDFExport.tsx`
- Create: `packages/frontend/app/reports/[id]/export/PDFLayout.tsx`
- Create: `packages/frontend/app/reports/[id]/export/usePDFExport.ts`

**Approach:** Use the existing `docx` library (already in dependencies) for Word export, and implement CSS print styles + `window.print()` for PDF (browser-native). Alternatively, add `@react-pdf/renderer` for programmatic PDF.

**Key features:**
- Cover page with score, market, date, branding
- Table of contents with page numbers
- Paginated sections with page breaks between deep dives
- Charts rendered as static images (use recharts' SVG output)
- Recommendation slots included when configured
- Agent client mode includes agent branding
- Print-optimized colors (no pure-screen gradients)
- Footer: page numbers, date, "Generated by PropertyIQ"

**Step 1:** Add print CSS classes to report-theme.css
**Step 2:** Build PDFLayout wrapper with cover page and TOC
**Step 3:** Wire Download button in ReportViewer to trigger export
**Step 4:** Test with all report types
**Step 5:** Commit

---

## Phase 7: Interactive Personalization

### Task 23: Build Personalization Panel

**Files:**
- Create: `packages/frontend/app/reports/[id]/components/PersonalizationPanel.tsx`
- Create: `packages/frontend/app/reports/[id]/hooks/usePersonalization.ts`

**Step 1: Build the collapsible panel**

Inputs:
- Priority selector (pick 3 of 5) - reuse existing `PrioritySelector` component
- Income input (number field)
- Down payment input (number field)
- Timeline selector (3 months, 6 months, 1 year, 2+ years)
- For investors: budget, strategy, portfolio size, risk tolerance

**Step 2: Build usePersonalization hook**

```typescript
function usePersonalization(report: ReportInstance) {
  const [inputs, setInputs] = useState(report.user_inputs || {});
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set());

  // Client-side affordability recalculation (instant)
  const affordabilityCalc = useMemo(() => {
    if (!inputs.income) return null;
    return calculateAffordability(inputs.income, inputs.down_payment, report.populated_data);
  }, [inputs.income, inputs.down_payment, report.populated_data]);

  // Debounced AI narrative regeneration (2s after last change)
  const regenerateNarratives = useDebouncedCallback(async (newInputs) => {
    setRegenerating(new Set(['priorities_narrative', 'bottom_line_narrative', ...]));
    const updated = await fetch(`/api/reports/${report.id}/regenerate-narratives`, {
      method: 'POST',
      body: JSON.stringify({ user_inputs: newInputs }),
    });
    // Update report state with new narratives
    setRegenerating(new Set());
  }, 2000);

  return { inputs, setInputs, affordabilityCalc, regenerating };
}
```

**Step 3: Wire PersonalizationPanel into ReportViewer**

Add a collapsible sidebar/top bar. Pass `regenerating` set to sections so they show skeleton loaders while their narratives regenerate.

### Task 24: Add Regenerate Narratives Endpoint

**Files:**
- Modify: `packages/backend/src/reports/reports.controller.ts`
- Modify: `packages/backend/src/reports/reports.service.ts`

**Step 1: Add endpoint**

```typescript
@Post(':id/regenerate-narratives')
async regenerateNarratives(
  @Param('id') id: string,
  @Body() body: { user_inputs: UserInputs },
) {
  // Only regenerates personalized sections, not the full report
  // Returns updated ai_narrative entries
}
```

**Step 2: Implement selective narrative regeneration**

Only regenerate narrative keys that depend on user inputs: `affordability_narrative` (if income changed), `priorities_narrative`, `bottom_line_narrative`, `bottom_line_actions`.

**Step 3: Commit**

---

## Phase 8: Integration Testing & Polish

### Task 25: End-to-End Report Generation Test

**Files:**
- Create: `packages/frontend/tests/e2e/report-generation.spec.ts`

Test the full flow:
1. Generate a HomeReady report via the wizard
2. Wait for generation to complete
3. Verify all sections render
4. Verify score data appears
5. Verify AI narratives are present
6. Test personalization panel (add income, verify affordability updates)
7. Test recommendation slots (configure a test partner, verify it appears)

### Task 26: Visual Polish & Animations

**Files:**
- Modify: `packages/frontend/app/reports/styles/report-theme.css`
- Modify various section components

- Add Framer Motion entrance animations to sections
- Ensure consistent spacing between all sections
- Polish responsive layout (mobile, tablet, desktop)
- Verify print styles work for PDF export
- Cross-browser testing

### Task 27: Final Commit & Cleanup

- Remove old section components that are no longer referenced (keep as deprecated for one release)
- Update imports across the codebase
- Run full test suite
- Commit

```bash
git add -A
git commit -m "feat: complete PropertyIQ report suite redesign with score-driven architecture"
```

---

## Task Dependencies

```
Phase 1 (Tasks 1-5): Must complete first - shared infrastructure
  ├── Phase 2 (Tasks 6-16): HomeReady - depends on Phase 1
  ├── Phase 3 (Task 17): InvestorEdge - depends on Phase 1
  ├── Phase 4 (Task 18): Comparison - depends on Phase 1
  └── Phase 5 (Tasks 19-21): Agent - depends on Phase 1

Phase 6 (Task 22): PDF Export - depends on Phases 2-5
Phase 7 (Tasks 23-24): Interactive Personalization - depends on Phases 2-5
Phase 8 (Tasks 25-27): Integration & Polish - depends on everything
```

Phases 2-5 can be parallelized after Phase 1 completes.

---

## Key Files Reference

**Backend:**
- `packages/backend/src/scoring/scoring.service.ts` - Score calculation
- `packages/backend/src/scoring/formula-weights.ts` - Score formulas
- `packages/backend/src/reports/reports.service.ts` - Report generation
- `packages/backend/src/claude/claude.service.ts` - AI narrative generation

**Frontend:**
- `packages/frontend/app/reports/[id]/ReportViewer.tsx` - Main viewer
- `packages/frontend/app/reports/[id]/components/templates/index.ts` - Template registry
- `packages/frontend/app/reports/[id]/components/sections/core/` - Shared components
- `packages/frontend/app/reports/[id]/components/utils/metricHelpers.ts` - Data access helpers
- `packages/frontend/app/reports/[id]/components/utils/thresholds.ts` - Market thresholds
- `packages/frontend/lib/data/` - Data layer (fetchers, hooks, registry, types)
- `packages/frontend/lib/data/format.ts` - Value formatting

**Testing:**
- Framework: Vitest + @testing-library/react
- Run: `cd packages/frontend && npx vitest run`
- Pattern: `__tests__/*.test.tsx` in component directories

**Styling:**
- `packages/frontend/app/reports/styles/report-theme.css` - Report CSS variables
- Tailwind CSS v4 for utility classes
- CSS variables: `--report-navy`, `--report-stone`, `--report-cream`, `--report-success`, `--report-error`, `--report-warning`
