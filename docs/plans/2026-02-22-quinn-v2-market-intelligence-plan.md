# Quinn v2: Market Intelligence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a pre-computed market intelligence layer that feeds both Quinn and Reports, switching to DeepSeek as primary LLM, achieving 3-8s response times for 80% of queries.

**Architecture:** Weekly batch job generates structured briefings for ~1,400 markets (900 metros + 500 counties) using MetricResolutionService. Daily news ingestion via News API. Quinn checks briefings before tool dispatch. Reports inject briefing context into narrative prompts. Rule-based market stance ensures consistency.

**Tech Stack:** NestJS + @nestjs/schedule (cron), Supabase (PostgreSQL/JSONB), DeepSeek V3 (via OpenAI SDK), MetricResolutionService (existing), Redis (existing cache layer), News API service (new external dependency).

**Design Doc:** `docs/plans/2026-02-22-quinn-v2-market-intelligence-design.md`

---

## Task 1: Database Migrations — Three New Tables

**Files:**
- Create: Supabase migration via `apply_migration` tool

**Step 1: Create `market_briefings` table**

```sql
CREATE TABLE IF NOT EXISTS market_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geography_id TEXT NOT NULL,
  geography_type TEXT NOT NULL CHECK (geography_type IN ('metro', 'county')),
  geography_name TEXT NOT NULL,
  generated_date DATE NOT NULL,
  is_latest BOOLEAN DEFAULT true,

  metrics_snapshot JSONB NOT NULL DEFAULT '{}',
  scores JSONB NOT NULL DEFAULT '{}',

  market_stance TEXT NOT NULL CHECK (market_stance IN (
    'strong_bullish', 'weak_bullish', 'neutral', 'weak_bearish', 'strong_bearish'
  )),
  stance_signals JSONB NOT NULL DEFAULT '[]',
  risk_flags JSONB NOT NULL DEFAULT '[]',

  narrative_summary TEXT NOT NULL DEFAULT '',
  suggested_questions JSONB NOT NULL DEFAULT '[]',
  news_snapshot JSONB DEFAULT '[]',

  metrics_count INTEGER DEFAULT 0,
  data_freshness_days INTEGER DEFAULT 0,
  generation_time_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_briefings_latest
  ON market_briefings (geography_id, is_latest) WHERE is_latest = true;
CREATE INDEX idx_briefings_geo_type
  ON market_briefings (geography_type, is_latest) WHERE is_latest = true;
CREATE INDEX idx_briefings_date ON market_briefings (generated_date DESC);
CREATE INDEX idx_briefings_stance ON market_briefings (market_stance, is_latest) WHERE is_latest = true;
```

**Step 2: Create `market_news` table**

```sql
CREATE TABLE IF NOT EXISTS market_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE NOT NULL,
  headline TEXT NOT NULL,
  source_name TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  sentiment TEXT NOT NULL DEFAULT 'neutral'
    CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  geography_ids TEXT[] NOT NULL DEFAULT '{}',
  geography_type TEXT DEFAULT 'metro',
  geo_tag_confidence REAL DEFAULT 0,
  raw_description TEXT DEFAULT '',
  ingested_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_news_geography ON market_news USING GIN (geography_ids);
CREATE INDEX idx_news_published ON market_news (published_at DESC);
CREATE INDEX idx_news_tags ON market_news USING GIN (tags);
CREATE INDEX idx_news_recent ON market_news (ingested_at DESC);
```

**Step 3: Create `rankings_cache` table**

```sql
CREATE TABLE IF NOT EXISTS rankings_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id TEXT NOT NULL,
  geography_type TEXT NOT NULL CHECK (geography_type IN ('metro', 'county', 'state')),
  direction TEXT NOT NULL CHECK (direction IN ('top', 'bottom')),
  rank_count INTEGER NOT NULL DEFAULT 10,
  generated_date DATE NOT NULL,
  is_latest BOOLEAN DEFAULT true,
  rankings JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_rankings_lookup
  ON rankings_cache (metric_id, geography_type, direction, rank_count)
  WHERE is_latest = true;
CREATE INDEX idx_rankings_date ON rankings_cache (generated_date DESC);
```

**Step 4: Verify tables exist**

Run: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('market_briefings', 'market_news', 'rankings_cache');`
Expected: 3 rows returned.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add market_briefings, market_news, rankings_cache tables"
```

---

## Task 2: Market Stance Engine (Rule-Based)

**Files:**
- Create: `packages/backend/src/market-intelligence/engines/market-stance.engine.ts`
- Test: `packages/backend/src/market-intelligence/engines/market-stance.engine.spec.ts`

This is a pure function with no dependencies — fully unit-testable.

**Step 1: Write failing tests**

```typescript
// market-stance.engine.spec.ts
import { computeMarketStance, MarketStance, StanceSignal } from './market-stance.engine';

describe('computeMarketStance', () => {
  const nationalBenchmarks = {
    vacancy_rate: 5.1,
    appreciation_yoy: 3.0,
  };

  it('returns strong_bullish when 5+ bullish signals present', () => {
    const metrics = {
      appreciation_yoy: 5.0,      // > 3%
      population_growth: 1.2,     // > 0.5%
      vacancy_rate: 3.5,          // < national
      dom_yoy_change: -10,        // decreasing
      homeready_score: 85,        // > 70
    };
    const result = computeMarketStance(metrics, nationalBenchmarks);
    expect(result.stance).toBe('strong_bullish');
    expect(result.signals.length).toBeGreaterThanOrEqual(5);
  });

  it('returns strong_bearish when 5+ bearish signals present', () => {
    const metrics = {
      appreciation_yoy: -2.5,     // < 0%
      population_growth: -0.8,    // < -0.3%
      vacancy_rate: 7.5,          // > national + 1%
      dom_yoy_change: 25,         // > 15% increase
      homeready_score: 35,        // < 45
    };
    const result = computeMarketStance(metrics, nationalBenchmarks);
    expect(result.stance).toBe('strong_bearish');
  });

  it('returns neutral when mixed signals', () => {
    const metrics = {
      appreciation_yoy: 2.0,
      population_growth: 0.3,
      vacancy_rate: 5.0,
      dom_yoy_change: 5,
      homeready_score: 60,
    };
    const result = computeMarketStance(metrics, nationalBenchmarks);
    expect(result.stance).toBe('neutral');
  });

  it('handles null metric values gracefully', () => {
    const metrics = {
      appreciation_yoy: null,
      population_growth: null,
      vacancy_rate: null,
      dom_yoy_change: null,
      homeready_score: 65,
    };
    const result = computeMarketStance(metrics, nationalBenchmarks);
    expect(result.stance).toBe('neutral');
    expect(result.signals).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest src/market-intelligence/engines/market-stance.engine.spec.ts --no-cache`
Expected: FAIL — module not found.

**Step 3: Implement market stance engine**

```typescript
// market-stance.engine.ts
export type MarketStance =
  | 'strong_bullish'
  | 'weak_bullish'
  | 'neutral'
  | 'weak_bearish'
  | 'strong_bearish';

export interface StanceSignal {
  signal: string;
  direction: 'bullish' | 'bearish';
  value: number | null;
  threshold: string;
}

export interface StanceResult {
  stance: MarketStance;
  signals: StanceSignal[];
  bullish_count: number;
  bearish_count: number;
}

interface StanceMetrics {
  appreciation_yoy: number | null;
  population_growth: number | null;
  vacancy_rate: number | null;
  dom_yoy_change: number | null;
  homeready_score: number | null;
}

interface NationalBenchmarks {
  vacancy_rate: number;
  appreciation_yoy: number;
}

export function computeMarketStance(
  metrics: StanceMetrics,
  national: NationalBenchmarks,
): StanceResult {
  const signals: StanceSignal[] = [];

  // Bullish signals
  if (metrics.appreciation_yoy != null && metrics.appreciation_yoy > 3) {
    signals.push({
      signal: 'strong_appreciation',
      direction: 'bullish',
      value: metrics.appreciation_yoy,
      threshold: '> 3% YoY',
    });
  }
  if (metrics.population_growth != null && metrics.population_growth > 0.5) {
    signals.push({
      signal: 'population_growth',
      direction: 'bullish',
      value: metrics.population_growth,
      threshold: '> 0.5% YoY',
    });
  }
  if (metrics.vacancy_rate != null && metrics.vacancy_rate < national.vacancy_rate) {
    signals.push({
      signal: 'low_vacancy',
      direction: 'bullish',
      value: metrics.vacancy_rate,
      threshold: `< ${national.vacancy_rate}% national avg`,
    });
  }
  if (metrics.dom_yoy_change != null && metrics.dom_yoy_change < 0) {
    signals.push({
      signal: 'decreasing_dom',
      direction: 'bullish',
      value: metrics.dom_yoy_change,
      threshold: 'YoY decrease',
    });
  }
  if (metrics.homeready_score != null && metrics.homeready_score > 70) {
    signals.push({
      signal: 'strong_homeready',
      direction: 'bullish',
      value: metrics.homeready_score,
      threshold: '> 70',
    });
  }

  // Bearish signals
  if (metrics.appreciation_yoy != null && metrics.appreciation_yoy < 0) {
    signals.push({
      signal: 'price_decline',
      direction: 'bearish',
      value: metrics.appreciation_yoy,
      threshold: '< 0% YoY',
    });
  }
  if (metrics.population_growth != null && metrics.population_growth < -0.3) {
    signals.push({
      signal: 'population_outflow',
      direction: 'bearish',
      value: metrics.population_growth,
      threshold: '< -0.3% YoY',
    });
  }
  if (
    metrics.vacancy_rate != null &&
    metrics.vacancy_rate > national.vacancy_rate + 1
  ) {
    signals.push({
      signal: 'high_vacancy',
      direction: 'bearish',
      value: metrics.vacancy_rate,
      threshold: `> ${national.vacancy_rate + 1}% (national + 1%)`,
    });
  }
  if (metrics.dom_yoy_change != null && metrics.dom_yoy_change > 15) {
    signals.push({
      signal: 'rising_dom',
      direction: 'bearish',
      value: metrics.dom_yoy_change,
      threshold: '> 15% YoY increase',
    });
  }
  if (metrics.homeready_score != null && metrics.homeready_score < 45) {
    signals.push({
      signal: 'weak_homeready',
      direction: 'bearish',
      value: metrics.homeready_score,
      threshold: '< 45',
    });
  }

  const bullish_count = signals.filter((s) => s.direction === 'bullish').length;
  const bearish_count = signals.filter((s) => s.direction === 'bearish').length;

  let stance: MarketStance;
  if (bullish_count >= 5) stance = 'strong_bullish';
  else if (bullish_count >= 3) stance = 'weak_bullish';
  else if (bearish_count >= 5) stance = 'strong_bearish';
  else if (bearish_count >= 3) stance = 'weak_bearish';
  else stance = 'neutral';

  return { stance, signals, bullish_count, bearish_count };
}
```

**Step 4: Run tests and verify they pass**

Run: `cd packages/backend && npx jest src/market-intelligence/engines/market-stance.engine.spec.ts --no-cache`
Expected: All 4 tests pass.

**Step 5: Commit**

```bash
git add packages/backend/src/market-intelligence/engines/market-stance.engine.ts \
       packages/backend/src/market-intelligence/engines/market-stance.engine.spec.ts
git commit -m "feat: add rule-based market stance engine with tests"
```

---

## Task 3: Risk Flags Engine

**Files:**
- Create: `packages/backend/src/market-intelligence/engines/risk-flags.engine.ts`
- Test: `packages/backend/src/market-intelligence/engines/risk-flags.engine.spec.ts`

Pure function. Same pattern as Task 2.

**Step 1: Write failing tests**

```typescript
// risk-flags.engine.spec.ts
import { computeRiskFlags, RiskFlag } from './risk-flags.engine';

describe('computeRiskFlags', () => {
  const nationalBenchmarks = {
    vacancy_rate: 5.1,
    unemployment_rate: 3.8,
  };

  it('flags population decline as high severity', () => {
    const metrics = { population_growth: -0.5 };
    const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
    const popFlag = flags.find((f) => f.flag === 'population_decline');
    expect(popFlag).toBeDefined();
    expect(popFlag!.severity).toBe('high');
  });

  it('flags natural disaster risk from geography data', () => {
    const geoData = { coastal_risk: true, fire_risk: false, flood_risk: true };
    const flags = computeRiskFlags({}, nationalBenchmarks, geoData);
    expect(flags.some((f) => f.flag === 'coastal_risk')).toBe(true);
    expect(flags.some((f) => f.flag === 'flood_risk')).toBe(true);
    expect(flags.some((f) => f.flag === 'fire_risk')).toBe(false);
  });

  it('returns empty array when no risk thresholds breached', () => {
    const metrics = {
      population_growth: 1.0,
      appreciation_yoy: 4.0,
      vacancy_rate: 4.0,
      unemployment_rate: 3.0,
    };
    const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
    expect(flags).toHaveLength(0);
  });

  it('handles null metrics without crashing', () => {
    const flags = computeRiskFlags({}, nationalBenchmarks, null);
    expect(Array.isArray(flags)).toBe(true);
  });
});
```

**Step 2: Run test — expect FAIL**

**Step 3: Implement risk flags engine**

```typescript
// risk-flags.engine.ts
export interface RiskFlag {
  flag: string;
  severity: 'high' | 'medium' | 'low';
  detail: string;
  metric_value: number | null;
  threshold: string;
}

interface RiskMetrics {
  population_growth?: number | null;
  appreciation_yoy?: number | null;
  vacancy_rate?: number | null;
  unemployment_rate?: number | null;
  inventory_yoy_change?: number | null;
  dom_yoy_change?: number | null;
  price_to_income?: number | null;
  rent_growth_yoy?: number | null;
}

interface NationalBenchmarks {
  vacancy_rate: number;
  unemployment_rate: number;
}

interface GeoData {
  coastal_risk?: boolean;
  fire_risk?: boolean;
  flood_risk?: boolean;
}

export function computeRiskFlags(
  metrics: RiskMetrics,
  national: NationalBenchmarks,
  geoData: GeoData | null,
): RiskFlag[] {
  const flags: RiskFlag[] = [];

  // High severity
  if (metrics.population_growth != null && metrics.population_growth < -0.3) {
    flags.push({
      flag: 'population_decline',
      severity: 'high',
      detail: `Population declining ${metrics.population_growth.toFixed(1)}% YoY`,
      metric_value: metrics.population_growth,
      threshold: '< -0.3% YoY',
    });
  }

  if (metrics.appreciation_yoy != null && metrics.appreciation_yoy < -2) {
    flags.push({
      flag: 'price_decline',
      severity: 'high',
      detail: `Home values declining ${metrics.appreciation_yoy.toFixed(1)}% YoY`,
      metric_value: metrics.appreciation_yoy,
      threshold: '< -2% YoY',
    });
  }

  if (
    metrics.vacancy_rate != null &&
    metrics.vacancy_rate > national.vacancy_rate + 2
  ) {
    flags.push({
      flag: 'high_vacancy',
      severity: 'high',
      detail: `Vacancy at ${metrics.vacancy_rate.toFixed(1)}%, well above national ${national.vacancy_rate}%`,
      metric_value: metrics.vacancy_rate,
      threshold: `> ${(national.vacancy_rate + 2).toFixed(1)}%`,
    });
  }

  if (
    metrics.unemployment_rate != null &&
    metrics.unemployment_rate > national.unemployment_rate + 1.5
  ) {
    flags.push({
      flag: 'rising_unemployment',
      severity: 'high',
      detail: `Unemployment at ${metrics.unemployment_rate.toFixed(1)}%, above national ${national.unemployment_rate}%`,
      metric_value: metrics.unemployment_rate,
      threshold: `> ${(national.unemployment_rate + 1.5).toFixed(1)}%`,
    });
  }

  // Medium severity
  if (metrics.inventory_yoy_change != null && metrics.inventory_yoy_change > 20) {
    flags.push({
      flag: 'inventory_surge',
      severity: 'medium',
      detail: `Inventory up ${metrics.inventory_yoy_change.toFixed(0)}% YoY`,
      metric_value: metrics.inventory_yoy_change,
      threshold: '> 20% YoY',
    });
  }

  if (metrics.dom_yoy_change != null && metrics.dom_yoy_change > 15) {
    flags.push({
      flag: 'dom_increasing',
      severity: 'medium',
      detail: `Days on market up ${metrics.dom_yoy_change.toFixed(0)}% YoY`,
      metric_value: metrics.dom_yoy_change,
      threshold: '> 15% YoY increase',
    });
  }

  if (metrics.price_to_income != null && metrics.price_to_income > 6) {
    flags.push({
      flag: 'affordability_squeeze',
      severity: 'medium',
      detail: `Price-to-income ratio at ${metrics.price_to_income.toFixed(1)}x`,
      metric_value: metrics.price_to_income,
      threshold: '> 6x',
    });
  }

  if (metrics.rent_growth_yoy != null && metrics.rent_growth_yoy < 0) {
    flags.push({
      flag: 'low_rent_growth',
      severity: 'medium',
      detail: `Rents declining ${metrics.rent_growth_yoy.toFixed(1)}% YoY`,
      metric_value: metrics.rent_growth_yoy,
      threshold: '< 0% YoY',
    });
  }

  // Low severity — geography-based risks
  if (geoData?.coastal_risk) {
    flags.push({
      flag: 'coastal_risk',
      severity: 'low',
      detail: 'Coastal area — elevated hurricane/flood insurance risk',
      metric_value: null,
      threshold: 'Geography flag',
    });
  }

  if (geoData?.fire_risk) {
    flags.push({
      flag: 'fire_risk',
      severity: 'low',
      detail: 'Wildfire risk area — elevated insurance costs',
      metric_value: null,
      threshold: 'Geography flag',
    });
  }

  if (geoData?.flood_risk) {
    flags.push({
      flag: 'flood_risk',
      severity: 'low',
      detail: 'Flood zone — may require flood insurance',
      metric_value: null,
      threshold: 'Geography flag',
    });
  }

  return flags;
}
```

**Step 4: Run tests — expect PASS**

**Step 5: Commit**

```bash
git add packages/backend/src/market-intelligence/engines/
git commit -m "feat: add risk flags engine with tests"
```

---

## Task 4: Briefing Types

**Files:**
- Create: `packages/backend/src/market-intelligence/market-intelligence.types.ts`

**Step 1: Create shared types**

```typescript
// market-intelligence.types.ts
import { MarketStance, StanceSignal } from './engines/market-stance.engine';
import { RiskFlag } from './engines/risk-flags.engine';

export interface MetricSnapshot {
  value: number | null;
  formatted: string;
  mom_change: number | null;
  yoy_change: number | null;
  date: string | null;
  source: string;
  is_inherited: boolean;
}

export interface ScoreSnapshot {
  score: number;
  confidence: string;  // A | B | C | F
  trend: 'up' | 'down' | 'stable';
  change_30d: number;
}

export interface NewsItem {
  headline: string;
  source_name: string;
  published_at: string;
  summary: string;
  tags: string[];
  sentiment: string;
}

export interface MarketBriefing {
  id: string;
  geography_id: string;
  geography_type: 'metro' | 'county';
  geography_name: string;
  generated_date: string;

  metrics_snapshot: Record<string, MetricSnapshot>;
  scores: Record<string, ScoreSnapshot>;

  market_stance: MarketStance;
  stance_signals: StanceSignal[];
  risk_flags: RiskFlag[];

  narrative_summary: string;
  suggested_questions: string[];
  news_snapshot: NewsItem[];

  metrics_count: number;
  data_freshness_days: number;
}

/** Metrics needed for briefing generation */
export const BRIEFING_METRIC_IDS = [
  'home_value',
  'appreciation_yoy',
  'rent_index',
  'rent_growth_yoy',
  'cap_rate',
  'vacancy_rate',
  'population',
  'population_growth',
  'unemployment_rate',
  'median_income',
  'dom',
  'inventory',
  'price_to_rent',
  'permits_growth',
  'price_to_income',
] as const;

/** Metrics pre-computed for rankings cache */
export const RANKINGS_METRIC_IDS = [
  'home_value',
  'appreciation_yoy',
  'rent_index',
  'cap_rate',
  'vacancy_rate',
  'population_growth',
  'unemployment_rate',
  'dom',
  'inventory',
  'price_to_rent',
  'permits_growth',
  'median_income',
] as const;
```

**Step 2: Commit**

```bash
git add packages/backend/src/market-intelligence/market-intelligence.types.ts
git commit -m "feat: add market intelligence types"
```

---

## Task 5: Briefing Generator Service

**Files:**
- Create: `packages/backend/src/market-intelligence/briefing-generator.service.ts`
- Test: `packages/backend/src/market-intelligence/briefing-generator.service.spec.ts`

This is the core service that generates briefings for a single market. The cron job (Task 8) calls this in a loop.

**Step 1: Write integration test skeleton**

Test should mock Supabase and MetricResolutionService, verify the generated briefing has all expected fields.

**Step 2: Implement service**

Key responsibilities:
1. Call `MetricResolutionService.resolveMetricBatch()` for the ~15 briefing metrics
2. Call `ScoringService.getScore()` for HomeReady + InvestorEdge
3. Compute MoM/YoY trends from historical data (compare to 1-month and 12-month prior snapshots)
4. Call `computeMarketStance()` with resolved metrics + national benchmarks
5. Call `computeRiskFlags()` with resolved metrics + geography data
6. Fetch latest 5 `market_news` rows for this geography
7. Call DeepSeek to generate `narrative_summary` (3-4 sentences, anchored by stance)
8. Call DeepSeek to generate `suggested_questions` (3 market-specific follow-ups)
9. Upsert briefing into `market_briefings` table (set previous `is_latest = false`, insert new with `is_latest = true`)

**Constructor dependencies:**
```typescript
constructor(
  private readonly metricResolution: MetricResolutionService,
  private readonly scoring: ScoringService,
  private readonly supabase: SupabaseService,
  private readonly configService: ConfigService,
)
```

**Key method:**
```typescript
async generateBriefing(
  geographyId: string,
  geographyType: 'metro' | 'county',
  geographyName: string,
  nationalBenchmarks: NationalBenchmarks,
): Promise<MarketBriefing>
```

**Narrative prompt template:**
```
You are an expert real estate market analyst writing a brief for ${geography_name}.

MARKET STANCE: ${stance} (determined by data — do not contradict this)
SIGNALS: ${stance_signals_formatted}
RISK FLAGS: ${risk_flags_formatted}
KEY METRICS: ${metrics_formatted}
SCORES: HomeReady ${homeready_score}/100 (${confidence}), InvestorEdge ${investoredge_score}/100
RECENT NEWS: ${news_formatted}

Write a 3-4 sentence analyst briefing. Be direct and opinionated consistent with the ${stance} stance. Include specific numbers. End with a forward-looking statement.
```

**Step 3: Run tests — expect PASS**

**Step 4: Commit**

```bash
git add packages/backend/src/market-intelligence/briefing-generator.service.ts \
       packages/backend/src/market-intelligence/briefing-generator.service.spec.ts
git commit -m "feat: add briefing generator service"
```

---

## Task 6: News Ingestion Service

**Files:**
- Create: `packages/backend/src/market-intelligence/news-ingestion.service.ts`
- Create: `packages/backend/src/market-intelligence/geo-tagger.service.ts`
- Test: `packages/backend/src/market-intelligence/geo-tagger.service.spec.ts`

**Step 1: Implement geo-tagger (pure function, testable)**

Matches article text against a curated list of metro names from the `geographies` table. Returns geography IDs with confidence scores.

**Key logic:**
- Load all metro names + common variations on startup
- For each article headline + description, match against metro names
- Only return matches with confidence > 0.8
- One article can match multiple metros

**Step 2: Write geo-tagger tests**

Test matching "Denver housing market surges" → geography_id for Denver metro.
Test "Illinois economy" → state-level only, no metro match.
Test "DFW real estate" → Dallas-Fort Worth metro.

**Step 3: Implement news ingestion service**

Key responsibilities:
1. Query News API by state/region (~50 queries)
2. Deduplicate by URL against existing `market_news` rows
3. Geo-tag each article via `GeoTaggerService`
4. Summarize + classify via DeepSeek batch (1-2 sentence summary + tags + sentiment)
5. Insert into `market_news` table

**Environment variables needed:**
```
NEWS_API_KEY=<key>
NEWS_API_PROVIDER=newsapi|bing  # which service to use
```

**Step 4: Tests pass, commit**

```bash
git commit -m "feat: add news ingestion and geo-tagging services"
```

---

## Task 7: Rankings Cache Service

**Files:**
- Create: `packages/backend/src/market-intelligence/rankings-cache.service.ts`

**Step 1: Implement service**

For each metric in `RANKINGS_METRIC_IDS` × each geo level (metro, county, state):
1. Call `MetricResolutionService.resolveMetricForAllGeos()` or batch query
2. Sort by value, take top 10 and bottom 10
3. Format values using metric format from registry
4. Upsert into `rankings_cache` table (set previous `is_latest = false`, insert new)

**Step 2: Commit**

```bash
git commit -m "feat: add rankings cache service"
```

---

## Task 8: NestJS Module + Cron Jobs

**Files:**
- Create: `packages/backend/src/market-intelligence/market-intelligence.module.ts`
- Create: `packages/backend/src/market-intelligence/market-intelligence-cron.service.ts`
- Modify: `packages/backend/src/app.module.ts` — register new module

**Step 1: Create module**

```typescript
// market-intelligence.module.ts
@Module({
  imports: [SupabaseModule, MetricResolutionModule, ConfigModule, ScoringModule],
  providers: [
    BriefingGeneratorService,
    NewsIngestionService,
    GeoTaggerService,
    RankingsCacheService,
    MarketIntelligenceCronService,
  ],
  exports: [BriefingGeneratorService, NewsIngestionService, RankingsCacheService],
})
export class MarketIntelligenceModule {}
```

**Step 2: Create cron service**

Follow existing pattern from `packages/backend/src/jobs/cache-refresh.job.ts`.

```typescript
// market-intelligence-cron.service.ts
@Injectable()
export class MarketIntelligenceCronService {
  private readonly logger = new Logger(MarketIntelligenceCronService.name);

  constructor(
    private readonly briefingGenerator: BriefingGeneratorService,
    private readonly newsIngestion: NewsIngestionService,
    private readonly rankingsCache: RankingsCacheService,
    private readonly configService: ConfigService,
  ) {}

  // Weekly: Sunday 2am — generate all briefings
  @Cron('0 2 * * 0')
  async handleWeeklyBriefings() {
    if (this.configService.get('BRIEFING_GENERATION_ENABLED') !== 'true') {
      this.logger.log('Briefing generation disabled');
      return;
    }
    this.logger.log('Starting weekly briefing generation...');
    // 1. Fetch national benchmarks
    // 2. Fetch top ~1400 geographies (900 metros + 500 counties by population)
    // 3. For each: generateBriefing() with error handling per market
    // 4. Log summary: X succeeded, Y failed, Z ms total
  }

  // Daily: 6am — ingest news
  @Cron('0 6 * * *')
  async handleDailyNewsIngestion() {
    if (this.configService.get('NEWS_INGESTION_ENABLED') !== 'true') {
      this.logger.log('News ingestion disabled');
      return;
    }
    this.logger.log('Starting daily news ingestion...');
    await this.newsIngestion.ingestLatestNews();
  }

  // Weekly: Sunday 3am (after briefings) — refresh rankings
  @Cron('0 3 * * 0')
  async handleWeeklyRankings() {
    if (this.configService.get('RANKINGS_CACHE_ENABLED') !== 'true') {
      this.logger.log('Rankings cache disabled');
      return;
    }
    this.logger.log('Starting weekly rankings cache refresh...');
    await this.rankingsCache.refreshAll();
  }
}
```

**Step 3: Register module in app.module.ts**

Add `MarketIntelligenceModule` to imports array in `packages/backend/src/app.module.ts` (after `MetricResolutionModule`).

**Step 4: Commit**

```bash
git commit -m "feat: add market intelligence module with cron jobs"
```

---

## Task 9: Quinn Briefing Lookup — Core Query Flow Change

**Files:**
- Modify: `packages/backend/src/analytics-chat/analytics-chat.service.ts`
- Modify: `packages/backend/src/analytics-chat/analytics-chat.module.ts`

This is the critical change — Quinn checks briefings before dispatching tools.

**Step 1: Add BriefingGeneratorService to AnalyticsChatModule imports**

In `analytics-chat.module.ts`, import `MarketIntelligenceModule` and inject `BriefingGeneratorService`.

**Step 2: Add briefing lookup to `chat()` method**

In `analytics-chat.service.ts`, in the `chat()` method (line ~946), BEFORE the tool dispatch loop:

```typescript
// After intent detection, before tool dispatch:
const briefingContext = await this.lookupBriefingContext(userMessage, context);
if (briefingContext) {
  // Inject briefing + fresh news into the system prompt
  // Skip tool dispatch — answer directly from briefing
}
```

**New private method:**
```typescript
private async lookupBriefingContext(
  message: string,
  context?: Record<string, any>,
): Promise<string | null> {
  // 1. Extract geography from message or context
  // 2. Query market_briefings WHERE geography_id = ? AND is_latest = true
  // 3. Query market_news WHERE ? = ANY(geography_ids) AND published_at > briefing.generated_date
  // 4. Format briefing + news into context string
  // 5. Return null if no briefing found (will fall back to tools)
}
```

**Step 3: Add rankings cache lookup**

For ranking-intent queries, check `rankings_cache` before calling `get_rankings` tool:

```typescript
private async lookupRankingsCache(
  message: string,
): Promise<string | null> {
  // 1. Parse metric + direction from message
  // 2. Query rankings_cache WHERE metric_id = ? AND direction = ? AND is_latest = true
  // 3. Return formatted rankings or null
}
```

**Step 4: Modify `getQueryIntent()` to handle briefing-backed responses**

Add intent detection for when a briefing exists vs. when to fall back to tools.

**Step 5: Commit**

```bash
git commit -m "feat: add briefing and rankings lookup to Quinn query flow"
```

---

## Task 10: Quinn System Prompt Updates

**Files:**
- Modify: `packages/backend/src/analytics-chat/quinn-system-prompt.ts`
- Modify: `packages/backend/src/analytics-chat/quinn-deepseek-system-prompt.ts`

**Step 1: Add opinionated voice instructions**

Append to system prompt:

```
VOICE & PERSONALITY:
- You are a sharp, opinionated real estate analyst. Not a generic AI assistant.
- When the data supports a clear position, state it confidently. Say "I wouldn't touch that market right now" not "the data suggests caution may be warranted."
- Use the market stance from the briefing as your directional anchor. Don't hedge when the data is clear.
- When data confidence is low (C/F), say so: "Fair warning — data coverage is thin here. Take this with a grain of salt."
- When confidence is high (A/B), speak with authority: "I have strong data on this one."

WHEN BRIEFING CONTEXT IS PROVIDED:
- Answer directly from the briefing. Do NOT call tools unless the question requires data not in the briefing.
- Your market stance MUST align with the briefing's stance. Do not contradict it.
- Cite specific numbers from the briefing.
- Reference recent news when relevant.

FOLLOW-UP SUGGESTIONS:
- End every response with 2-3 natural follow-up questions the user might want to ask next.
- Format as: "You might also want to know: [question 1] | [question 2] | [question 3]"

SCOPE:
- You cover market-level investment analysis only.
- For individual property valuations, mortgage calculations, legal/tax advice, or personal finance: "That's outside what I cover — PropertyIQ focuses on market-level investment analysis."
```

**Step 2: Commit**

```bash
git commit -m "feat: update Quinn system prompt for opinionated voice and briefing support"
```

---

## Task 11: Report Briefing Injection

**Files:**
- Modify: `packages/backend/src/reports/reports-orchestrator.ts` (insert briefing fetch at ~line 220)
- Modify: `packages/backend/src/reports/reports-narratives.ts` (inject briefing into `buildNarrativeContext()` at ~line 109)

**Step 1: Add briefing fetch to orchestrator**

In `generateReportAsync()`, after data assembly (line ~220) and before narrative generation (line ~223):

```typescript
// Fetch market briefing for consistency
let briefingContext: MarketBriefing | null = null;
try {
  const { data: briefing } = await supabase
    .from('market_briefings')
    .select('*')
    .eq('geography_id', dto.primary_geography_id)
    .eq('is_latest', true)
    .single();
  briefingContext = briefing;
} catch {
  logger.warn('No briefing found for geography — narratives will generate without stance anchor');
}
```

Pass `briefingContext` to `generateSectionNarratives()`.

**Step 2: Inject briefing context into narrative prompts**

In `buildNarrativeContext()` (~line 109 of `reports-narratives.ts`), add:

```typescript
if (briefingContext) {
  context.market_stance = briefingContext.market_stance;
  context.stance_description = formatStanceForNarrative(briefingContext.market_stance);
  context.risk_flags_text = briefingContext.risk_flags
    .map(f => f.detail)
    .join('; ');
  context.briefing_narrative = briefingContext.narrative_summary;
  context.briefing_news = briefingContext.news_snapshot
    .map(n => `${n.headline} (${n.source_name})`)
    .join('; ');
}
```

Add to each narrative section's prompt template:

```
{{#if market_stance}}
MARKET INTELLIGENCE CONTEXT:
Market Stance: {{stance_description}}
Key Risks: {{risk_flags_text}}
Market Summary: {{briefing_narrative}}
Recent News: {{briefing_news}}

Your analysis MUST be consistent with this market assessment. Personalization and depth remain unchanged.
{{/if}}
```

**Step 3: Replace live news scouting with pre-ingested news**

In `generateReportAsync()`, when briefing exists, skip the expensive `claudeNewsService.getOrScoutNews()` call (which has a 60-second timeout) and use `briefingContext.news_snapshot` + fresh `market_news` rows instead.

**Step 4: Commit**

```bash
git commit -m "feat: inject briefing context into report narrative generation"
```

---

## Task 12: Frontend — Starter Questions & Follow-Up Chips

**Files:**
- Modify: `packages/frontend/app/components/quinn/QuinnFloatingButton.tsx`

**Step 1: Update starter prompts (line 25-35)**

Replace generic starters with guided first-use experience:

```typescript
const STARTER_PROMPTS = [
  { text: "What are the hottest markets right now?", icon: "trending_up" },
  { text: "Compare Denver vs Austin for investing", icon: "compare" },
  { text: "Where should I invest for cash flow?", icon: "payments" },
];
```

**Step 2: Add welcome message to empty state**

When `messages.length === 0`, show:

```
I'm Quinn, your real estate market analyst. I track 900+ metros and
3,000+ counties with weekly intelligence briefings.

Try asking me something:
[clickable chips for STARTER_PROMPTS]
```

**Step 3: Parse follow-up suggestions from response**

Quinn's responses will include follow-up suggestions. Parse them and render as clickable chips below each assistant message.

Look for the pattern: `"You might also want to know: [q1] | [q2] | [q3]"` in response text.

**Step 4: Commit**

```bash
git commit -m "feat: add guided first use and follow-up chips to Quinn UI"
```

---

## Task 13: Event-Triggered Briefing Refresh

**Files:**
- Modify: `packages/backend/src/market-intelligence/news-ingestion.service.ts`
- Modify: `packages/backend/src/market-intelligence/briefing-generator.service.ts`

**Step 1: Add severity detection to news ingestion**

After geo-tagging and classifying each article, check if any market has 2+ high-severity articles in the last 24 hours:

```typescript
// In news ingestion, after inserting all articles:
const highSeverityMarkets = await this.detectHighSeverityMarkets();
for (const market of highSeverityMarkets) {
  this.logger.warn(`High-severity news detected for ${market.name} — triggering emergency briefing refresh`);
  await this.briefingGenerator.generateBriefing(
    market.geography_id,
    market.geography_type,
    market.geography_name,
    nationalBenchmarks,
  );
}
```

**Step 2: Define severity heuristics**

Articles tagged with `risk` sentiment `negative` count as high-severity. Keywords: "disaster", "layoff", "closure", "bankruptcy", "flood", "hurricane", "fire", "crash".

**Step 3: Commit**

```bash
git commit -m "feat: add event-triggered briefing refresh for high-severity news"
```

---

## Task 14: On-Demand Briefing for Uncovered Markets

**Files:**
- Modify: `packages/backend/src/analytics-chat/analytics-chat.service.ts`
- Modify: `packages/backend/src/market-intelligence/briefing-generator.service.ts`

**Step 1: Track uncovered market requests**

When Quinn's briefing lookup returns null for a geography, log the request. After the tool-call response is sent, trigger async briefing generation:

```typescript
// In lookupBriefingContext(), when no briefing found:
if (!briefing && geographyId) {
  // Fire-and-forget: generate briefing for next time
  this.briefingGenerator
    .generateBriefingOnDemand(geographyId, geoType, geoName)
    .catch((err) => this.logger.warn(`On-demand briefing failed: ${err.message}`));
}
```

**Step 2: Add request counter**

Track how many times each uncovered market is requested. If 3+ requests, auto-add to the weekly batch list.

**Step 3: Commit**

```bash
git commit -m "feat: add on-demand briefing generation for uncovered markets"
```

---

## Task 15: Admin Dashboard — Briefing Health Widget

**Files:**
- Create: `packages/frontend/app/admin/intelligence/page.tsx`
- Create: backend endpoint for briefing stats

**Step 1: Create backend stats endpoint**

```typescript
// In a new controller or existing admin controller
@Get('admin/intelligence/stats')
async getBriefingStats() {
  return {
    total_briefings: count,
    metros_covered: count,
    counties_covered: count,
    oldest_briefing_days: number,
    news_articles_last_7d: count,
    rankings_last_refresh: date,
    failed_markets: string[],
  };
}
```

**Step 2: Create admin page**

Simple dashboard showing briefing health, news pipeline status, failed markets.

**Step 3: Commit**

```bash
git commit -m "feat: add admin intelligence dashboard"
```

---

## Task 16: Environment Variables & Configuration

**Files:**
- Modify: `packages/backend/.env.example` (add new vars)

**New environment variables:**

```env
# Market Intelligence
BRIEFING_GENERATION_ENABLED=true
NEWS_INGESTION_ENABLED=true
RANKINGS_CACHE_ENABLED=true

# News API
NEWS_API_KEY=<your-key>
NEWS_API_PROVIDER=newsapi

# DeepSeek (should already exist)
DEEPSEEK_API_KEY=<your-key>
AI_PROVIDER=deepseek
AI_MODEL=deepseek-chat
AI_BASE_URL=https://api.deepseek.com
```

**Step 1: Update .env.example and commit**

```bash
git commit -m "feat: add market intelligence environment variables"
```

---

## Task 17: Integration Testing — End-to-End Briefing Flow

**Files:**
- Create: `packages/backend/src/market-intelligence/__tests__/briefing-flow.integration.spec.ts`

**Step 1: Write integration test**

Test the full flow: generate briefing → store in DB → Quinn reads it → response uses briefing context.

**Step 2: Write integration test for report consistency**

Generate briefing → generate report for same market → verify narrative aligns with briefing stance.

**Step 3: Commit**

```bash
git commit -m "test: add market intelligence integration tests"
```

---

## Task Dependency Graph

```
Task 1 (DB tables) ──────────────────────────────┐
                                                   │
Task 2 (Stance engine) ──┐                        │
Task 3 (Risk engine) ────┤                        │
Task 4 (Types) ──────────┤                        │
                          ▼                        ▼
                   Task 5 (Briefing generator) ────┤
                   Task 6 (News ingestion) ────────┤
                   Task 7 (Rankings cache) ────────┤
                                                   │
                                                   ▼
                                            Task 8 (Module + Cron)
                                                   │
                          ┌────────────────────────┤
                          ▼                        ▼
                   Task 9 (Quinn briefing     Task 11 (Report
                    lookup)                    briefing injection)
                          │
                          ▼
                   Task 10 (System prompt)
                          │
                          ▼
                   Task 12 (Frontend UI)
                          │
                          ▼
              Task 13 (Event refresh) ─── Task 14 (On-demand)
                          │
                          ▼
                   Task 15 (Admin dashboard)
                   Task 16 (Env vars)
                   Task 17 (Integration tests)
```

**Parallelizable groups:**
- Tasks 2, 3, 4 can run in parallel
- Tasks 5, 6, 7 can run in parallel (after 2-4)
- Tasks 9, 11, 12 can run in parallel (after 8)
- Tasks 13, 14, 15, 16 can run in parallel (after 9)
