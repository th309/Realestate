# Forecast SEO Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/forecast` (national "will home prices crash" hub) and `/forecast/[slug]` (per-metro forecast pages, ~935 scored metros) targeting forecast-intent queries where Reventure is verifiably absent, powered by a new `market_forecast` AI insight purpose grounded in the PropertyIQ score + confidence grade.

**Architecture:** A new App Router route tree reuses the existing scored-slug gating (`metro-slug-data.json`), insights system (new 7th `InsightType`), sitemap builder, and JSON-LD patterns. The national hub is deterministic aggregate copy from a new small `/api/scores/distribution` endpoint (the `/api/scores/top` limit is clamped to 100, so it cannot serve all 935). Old 2026 MDX forecast blog posts 308-redirect in and are deleted. Batch generation runs as a CI script that bootstraps AppModule (same pattern as `refresh-piq-scores.ts`).

**Tech Stack:** NestJS 11 (backend), Next.js 16 App Router (frontend), Supabase, DeepSeek via `AiProviderService`, Jest (backend), Vitest (frontend).

**Spec:** `docs/superpowers/specs/2026-07-11-forecast-seo-content-design.md`

**Spec deviation (approved rationale):** The spec proposed reusing the `market_outlook` narrative as national hub prose. Research showed `market_outlook` is **per-metro** (the landing hero passes a CBSA), so there is no national narrative to reuse. The hub instead uses deterministic distribution-based copy — which better satisfies the honesty constraint anyway.

## Global Constraints

- Branch: `worktree-feat+forecast-2026-seo-content` (this worktree). Verify with `git branch --show-current` before every commit. Never push without being asked.
- Commits: no `Co-Authored-By`; always commit with explicit pathspec (`git commit -- <paths>`).
- **Honesty rules:** forecast content NEVER states or implies a specific future price or percentage change. Momentum language only (rising/firming/steady/easing/cooling/weak) — never quality verdicts (no EXCELLENT/GOOD/POOR). Confidence grade always surfaced next to the score.
- **No hardcoded years** in any route, component, prompt, FAQ, or metadata — always via `forecastDisplayYear()`. Rollover rule: score-period month ≥ October → next calendar year.
- **Coverage copy:** any marketing-style coverage claim uses `COVERAGE_COPY` from `packages/frontend/lib/data/validation-claims.ts`. Live counts computed from the distribution endpoint at render time (e.g. "Across 935 scored metro markets…") are data, not marketing copy, and are allowed.
- All frontend data fetching through `@/lib/data` (fetchers + hooks). New fetchers export from `lib/data/index.ts`.
- File size limits: logic files hard limit 300 lines, components 400 (target <300), tests 500. One exported component per file.
- Styling: reuse the existing markets-page section styling exactly (`text-on-surface`, `rounded-xl border border-outline-variant`, etc.) — no novel visual design. If a genuinely new visual treatment becomes necessary, stop and invoke the `frontend-design` skill first.
- Build verification: if `nest build` / `next build` fails for ANY reason, fix every error before committing (see tasks/lessons.md).
- No env-var fallbacks for secrets/config.
- The AI prose rules for insights: forecast narrative uses `##` markdown sections (the `market_overview` pattern) — the `PLAIN_PROSE_RULE` does NOT apply to it, but no bullets, no em-dashes guidance stays in the prompt body.

---

### Task 1: Confidence grade in `InsightContext`

**Files:**

- Modify: `packages/backend/src/insights/insights.types.ts` (the `scores` field of `InsightContext`, ~line 35)
- Modify: `packages/backend/src/insights/insight-context-builder.ts` (score extraction, ~line 97)

**Interfaces:**

- Consumes: `scoreResult.scores.propertyiq.confidence_level: string` (exists — `packages/backend/src/scoring/scoring-response.types.ts:16`, normalized A/B/C/F).
- Produces: `InsightContext.scores.confidence_level: string | null` — Task 3's prompt builder reads it.

- [ ] **Step 1: Extend the type**

In `insights.types.ts`, change the `scores` field of `InsightContext`:

```ts
scores: {
  propertyiq: number | null;
  /** A/B/C/F data-quality grade for the score; null when unavailable. */
  confidence_level: string | null;
}
```

- [ ] **Step 2: Populate it in the context builder**

In `insight-context-builder.ts`, locate where the context's `scores` object is built (the extraction around line 97 pulls `scoreResult?.scores?.propertyiq?.score`). Extend that object literal:

```ts
  scores: {
    propertyiq: scoreResult?.scores?.propertyiq?.score ?? null,
    confidence_level:
      scoreResult?.scores?.propertyiq?.confidence_level ?? null,
  },
```

(Read the surrounding code first — if extraction happens in a helper like `extractScores`, apply the same change there. The exact field path `scores.propertyiq.confidence_level` matches `ScoreResponseDto` / `scoring-response.types.ts:15-16`.)

- [ ] **Step 3: Fix compile fallout**

Run: `cd packages/backend && npx tsc --noEmit -p tsconfig.json`
Any test fixture or caller constructing an `InsightContext` literal now fails — add `confidence_level: null` to each. Expected: zero errors after fixes.

- [ ] **Step 4: Run existing insights tests**

Run: `cd packages/backend && npx jest insights insight`
Expected: PASS (or no matching tests found — fine).

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must be worktree-feat+forecast-2026-seo-content
git add packages/backend/src/insights/insights.types.ts packages/backend/src/insights/insight-context-builder.ts
git commit -m "feat(backend): surface confidence grade in InsightContext" -- packages/backend/src/insights/
```

---

### Task 2: Backend `forecastDisplayYear` helper

**Files:**

- Create: `packages/backend/src/insights/forecast-display-year.ts`
- Test: `packages/backend/src/insights/forecast-display-year.spec.ts`

**Interfaces:**

- Produces: `forecastDisplayYear(now?: Date): number` — Task 4 uses it in the `PROMPT_BUILDERS` entry.

- [ ] **Step 1: Write the failing test**

```ts
// packages/backend/src/insights/forecast-display-year.spec.ts
import { forecastDisplayYear } from "./forecast-display-year";

describe("forecastDisplayYear rolls the display year forward from October", () => {
  it("returns the same year for a September date", () => {
    expect(forecastDisplayYear(new Date("2026-09-30T00:00:00Z"))).toBe(2026);
  });

  it("returns the next year for an October date", () => {
    expect(forecastDisplayYear(new Date("2026-10-01T00:00:00Z"))).toBe(2027);
  });

  it("returns the next year for a December date", () => {
    expect(forecastDisplayYear(new Date("2026-12-15T00:00:00Z"))).toBe(2027);
  });

  it("returns the same year for a January date", () => {
    expect(forecastDisplayYear(new Date("2027-01-15T00:00:00Z"))).toBe(2027);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest forecast-display-year`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// packages/backend/src/insights/forecast-display-year.ts
/**
 * Display year for forecast content, derived from generation time (which
 * tracks the monthly score period). From October onward, searchers look for
 * NEXT year's forecast, so Oct-Dec roll the display year forward.
 *
 * Kept in sync (3 lines of logic) with the frontend twin:
 * packages/frontend/lib/seo/forecast-year.ts
 */
export function forecastDisplayYear(now: Date = new Date()): number {
  const year = now.getUTCFullYear();
  return now.getUTCMonth() >= 9 ? year + 1 : year; // month index 9 = October
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest forecast-display-year`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/insights/forecast-display-year.ts packages/backend/src/insights/forecast-display-year.spec.ts
git commit -m "feat(backend): forecastDisplayYear helper with October rollover" -- packages/backend/src/insights/
```

---

### Task 3: `buildMarketForecastPrompt` (TDD)

**Files:**

- Modify: `packages/backend/src/insights/insight-prompts.ts` (add rule constant + builder; existing helpers `formatTopComponents`, `formatKeyMetrics`, `formatBenchmarks` are module-private in this file — reuse them)
- Test: `packages/backend/src/insights/insight-prompts.market-forecast.spec.ts`

**Interfaces:**

- Consumes: `InsightContext` (with `scores.confidence_level` from Task 1), `DATA_GROUNDING_RULE` (exists at `insight-prompts.ts:11`).
- Produces: `buildMarketForecastPrompt(ctx: InsightContext, displayYear: number): string` — Task 4 registers it.

- [ ] **Step 1: Write the failing test**

```ts
// packages/backend/src/insights/insight-prompts.market-forecast.spec.ts
import { buildMarketForecastPrompt } from "./insight-prompts";
import type { InsightContext } from "./insights.types";

const ctx: InsightContext = {
  region_name: "Austin, TX",
  region_id: "12420",
  geo_level: "metro",
  scores: { propertyiq: 62, confidence_level: "B" },
  score_components: {
    zhvi_yoy: { status: "ok", value: 0.031 },
    median_days_on_market: { status: "ok", value: 48 },
  },
  key_metrics: {
    home_value: { value: 455000, yoy_change: 0.031, format: "currency" },
  },
  benchmarks: {
    state_avg: { home_value: 340000 },
    national_avg: { home_value: 360000 },
  },
};

describe("buildMarketForecastPrompt produces an honest, year-aware forecast prompt", () => {
  const prompt = buildMarketForecastPrompt(ctx, 2027);

  it("uses the display year in the required section headers", () => {
    expect(prompt).toContain("## Will Austin, TX Home Prices Crash in 2027?");
    expect(prompt).toContain("## The Bottom Line for 2027");
  });

  it("forbids price predictions via the honesty rule", () => {
    expect(prompt).toContain("momentum outlook, not a price prediction");
    expect(prompt).toContain("Never state or imply a specific future price");
  });

  it("includes the data-grounding rule", () => {
    expect(prompt).toContain("Use ONLY the data provided");
  });

  it("surfaces the confidence grade", () => {
    expect(prompt).toContain("Confidence: B");
  });

  it("handles a missing confidence grade", () => {
    const noGrade = buildMarketForecastPrompt(
      { ...ctx, scores: { propertyiq: 62, confidence_level: null } },
      2027,
    );
    expect(noGrade).toContain("Confidence: not available");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/backend && npx jest market-forecast`
Expected: FAIL — `buildMarketForecastPrompt` is not exported.

- [ ] **Step 3: Write the builder**

Add to `insight-prompts.ts` (below the existing rule constants, mirroring `buildMarketOverviewPrompt`):

```ts
/** Hard honesty constraint for forecast-angle content (SEO /forecast pages). */
const FORECAST_HONESTY_RULE =
  "This is a momentum outlook, not a price prediction. Never state or imply a specific future price, percentage change, or price target. Never predict a crash or a boom. Answer the crash question only by describing what the current momentum data shows and does not show. Where the data is mixed or missing, say so plainly.";

/**
 * Market Forecast — momentum-based forward outlook for the /forecast SEO pages.
 * Answers the "will home prices crash" question with momentum data only.
 * Uses markdown headers (##) for page-section delineation, like market_overview.
 */
export function buildMarketForecastPrompt(
  ctx: InsightContext,
  displayYear: number,
): string {
  const topComponents = formatTopComponents(ctx.score_components, 5);
  const confidence = ctx.scores.confidence_level ?? "not available";

  return `You are a real estate analyst writing a forward-looking market outlook for ${displayYear}.

Data for ${ctx.region_name}:
- PropertyIQ Score: ${ctx.scores.propertyiq ?? "N/A"}/100 (a demand-momentum signal; 50 equals the market's state average)
- Confidence: ${confidence}
- Top score drivers: ${topComponents}
- Key metrics: ${formatKeyMetrics(ctx.key_metrics)}
- Benchmarks:
${formatBenchmarks(ctx.benchmarks)}

Rules:
- Write 500-800 words total
- Use these exact markdown section headers in order:
  ## Will ${ctx.region_name} Home Prices Crash in ${displayYear}?
  ## Momentum Signals
  ## How ${ctx.region_name} Compares
  ## The Bottom Line for ${displayYear}
- "Will ... Crash": answer the crash question directly and honestly using ONLY the momentum data provided — describe what the data shows and what it does not show
- "Momentum Signals": interpret the score drivers (price momentum, days on market, price cuts) and what each signals for the year ahead
- "How ... Compares": compare the market against the state and national benchmarks provided
- "The Bottom Line for ${displayYear}": a grounded summary of the momentum outlook that names the confidence grade
- ${FORECAST_HONESTY_RULE}
- ${DATA_GROUNDING_RULE}
- Describe momentum with words like rising, firming, steady, easing, or cooling — never quality verdicts like good, bad, excellent, or poor
- Do NOT use bullet points — write in flowing paragraphs
- Do NOT use em-dashes
- Do NOT include a title or introduction before the first ## header`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/backend && npx jest market-forecast`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/backend/src/insights/insight-prompts.ts packages/backend/src/insights/insight-prompts.market-forecast.spec.ts
git commit -m "feat(backend): market_forecast prompt builder with honesty rules" -- packages/backend/src/insights/
```

---

### Task 4: Register `market_forecast` end-to-end + DB migration

**Files:**

- Modify: `packages/backend/src/insights/insights.types.ts` (`InsightType` union, line ~8)
- Modify: `packages/backend/src/ai-provider/ai-provider.types.ts` (`AI_PURPOSES`, ~line 242)
- Modify: `packages/backend/src/insights/insights.service.ts` (`PROMPT_BUILDERS` + `INSIGHT_PURPOSES` maps at lines 44-66; `maxTokens` branch at ~line 250)
- Modify: `packages/backend/src/insights/insights.controller.ts` (`VALID_INSIGHT_TYPES`, line ~39)
- Create: `supabase/migrations/20260711120000_allow_market_forecast_insight_type.sql`

**Interfaces:**

- Consumes: `buildMarketForecastPrompt` (Task 3), `forecastDisplayYear` (Task 2).
- Produces: `'market_forecast'` as a valid `InsightType` accepted by `GET /api/insights/metro/:cbsa?type=market_forecast` and storable in `market_insights`. `AI_PURPOSES.MARKET_FORECAST = 'market_forecast'`.

**Context you must know:** Both service maps are `Record<InsightType, …>` — adding the union member without both entries is a compile error (good). The DB CHECK constraint is **mandatory**: the `market_outlook` rollout shipped without it once and every insert silently failed, forcing paid regeneration per page view (see comment in `supabase/migrations/20260621205147_allow_market_outlook_insight_type.sql`). Supabase silently skips migrations timestamped earlier than the max applied one — `20260711120000` is later than the current max; verify before choosing a different name.

- [ ] **Step 1: Add the union member**

In `insights.types.ts`:

```ts
export type InsightType =
  | "market_take"
  | "score_explanation"
  | "trend_interpretation"
  | "market_overview"
  | "archetype_match"
  | "market_outlook"
  | "market_forecast";
```

- [ ] **Step 2: Add the AI purpose**

In `ai-provider.types.ts`, inside `AI_PURPOSES` (after `MARKET_OUTLOOK`):

```ts
  // Forecast-angle SEO narrative for /forecast pages (momentum outlook, no price predictions)
  MARKET_FORECAST: 'market_forecast',
```

- [ ] **Step 3: Register in both service maps and the token branch**

In `insights.service.ts` add imports for `buildMarketForecastPrompt` (from `./insight-prompts`) and `forecastDisplayYear` (from `./forecast-display-year`), then:

```ts
// in PROMPT_BUILDERS:
  market_forecast: (ctx) =>
    buildMarketForecastPrompt(ctx, forecastDisplayYear()),

// in INSIGHT_PURPOSES:
  market_forecast: AI_PURPOSES.MARKET_FORECAST,
```

And widen the long-form token branch (~line 250):

```ts
const maxTokens =
  insightType === "market_overview" ||
  insightType === "market_outlook" ||
  insightType === "market_forecast"
    ? 4000
    : 1500;
```

- [ ] **Step 4: Controller allowlist**

In `insights.controller.ts`:

```ts
const VALID_INSIGHT_TYPES: readonly InsightType[] = [
  "market_take",
  "score_explanation",
  "trend_interpretation",
  "market_overview",
  "archetype_match",
  "market_outlook",
  "market_forecast",
];
```

- [ ] **Step 5: Write the migration**

```sql
-- supabase/migrations/20260711120000_allow_market_forecast_insight_type.sql
-- Widen the insight_type CHECK to allow the forecast narrative used by the
-- /forecast SEO pages. MANDATORY before any generation runs: shipping a new
-- insight type without widening this CHECK makes every insert silently fail
-- (see 20260621205147_allow_market_outlook_insight_type.sql for the incident).

ALTER TABLE market_insights
  DROP CONSTRAINT IF EXISTS market_insights_insight_type_check;

ALTER TABLE market_insights
  ADD CONSTRAINT market_insights_insight_type_check
  CHECK (insight_type IN (
    'market_take',
    'score_explanation',
    'trend_interpretation',
    'market_overview',
    'archetype_match',
    'market_outlook',
    'market_forecast'
  ));
```

No `ai_model_config` row is needed: `AiConfigResolver` falls back to the env-default provider (DeepSeek) when no row exists. A row can be added later via admin to override the model per-purpose.

- [ ] **Step 6: Apply the migration to the live DB**

Apply via the Supabase MCP `apply_migration` tool (name: `allow_market_forecast_insight_type`) with the SQL above. Then verify with `execute_sql`:

```sql
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'market_insights_insight_type_check';
```

Expected: definition includes `'market_forecast'`. Also verify the migration was recorded: `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3;` includes `20260711120000` (out-of-order-skip gotcha).

- [ ] **Step 7: Build + test**

Run: `cd packages/backend && npx tsc --noEmit -p tsconfig.json && npx jest insights insight market-forecast`
Expected: zero type errors, tests PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/backend/src/insights/ packages/backend/src/ai-provider/ai-provider.types.ts supabase/migrations/20260711120000_allow_market_forecast_insight_type.sql
git commit -m "feat(backend): register market_forecast insight type + widen DB CHECK" -- packages/backend/src supabase/migrations
```

---

### Task 5: Batch generation for metros + CI wiring

**Files:**

- Modify: `packages/backend/src/insights/insight-batch-generator.ts` (types list at ~line 20, loop at ~line 69)
- Create: `packages/backend/src/scripts/generate-forecast-insights.ts`
- Modify: `.github/workflows/post-import-refresh.yml` (new job after `run-scoring-pipeline`)
- Test: `packages/backend/src/insights/insight-batch-generator.spec.ts` (extend or create)

**Interfaces:**

- Consumes: `InsightsService.generateBatchInsights(geoLevel)` (exists, `insights.service.ts:197`), the AppModule-bootstrap script pattern from `packages/backend/src/scripts/refresh-piq-scores.ts` (read it first and mirror its bootstrap/env handling).
- Produces: `batchInsightTypesFor(geoLevel: string): InsightType[]` (exported for tests); a CI job that pre-generates metro forecast narratives monthly after rescore.

- [ ] **Step 1: Write the failing test**

```ts
// packages/backend/src/insights/insight-batch-generator.spec.ts (add or create)
import { batchInsightTypesFor } from "./insight-batch-generator";

describe("batchInsightTypesFor adds the forecast narrative only for metros", () => {
  it("includes market_forecast for metro", () => {
    expect(batchInsightTypesFor("metro")).toEqual([
      "market_take",
      "score_explanation",
      "market_forecast",
    ]);
  });

  it("excludes market_forecast for county and zip", () => {
    expect(batchInsightTypesFor("county")).toEqual([
      "market_take",
      "score_explanation",
    ]);
    expect(batchInsightTypesFor("zip")).toEqual([
      "market_take",
      "score_explanation",
    ]);
  });
});
```

Run: `cd packages/backend && npx jest insight-batch-generator` — Expected: FAIL.

- [ ] **Step 2: Implement**

In `insight-batch-generator.ts`, replace the constant usage:

```ts
/** Insight types generated during batch runs */
const BATCH_INSIGHT_TYPES: InsightType[] = ["market_take", "score_explanation"];

/**
 * Batch types per geography. Metros also pre-generate the long-form forecast
 * narrative so /forecast SEO pages (cachedOnly=1) always have content —
 * crawlers must never see a narrative-less page waiting on live generation.
 */
export function batchInsightTypesFor(geoLevel: string): InsightType[] {
  return geoLevel === "metro"
    ? [...BATCH_INSIGHT_TYPES, "market_forecast"]
    : BATCH_INSIGHT_TYPES;
}
```

And in the generation loop (~line 69) change `for (const type of BATCH_INSIGHT_TYPES)` to `for (const type of batchInsightTypesFor(geoLevel))`.

Run: `cd packages/backend && npx jest insight-batch-generator` — Expected: PASS.

- [ ] **Step 3: CI script**

Read `packages/backend/src/scripts/refresh-piq-scores.ts` first and mirror its bootstrap style exactly (logger options, env expectations). Core:

```ts
// packages/backend/src/scripts/generate-forecast-insights.ts
/**
 * Monthly post-rescore batch: pre-generates metro insights (market_take,
 * score_explanation, market_forecast) into market_insights so the /forecast
 * and /markets SEO pages serve cached narratives (cachedOnly=1) without ever
 * triggering live paid generation. Run from CI after refresh-piq-scores.
 */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module";
import { InsightsService } from "../insights/insights.service";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });
  try {
    const insights = app.get(InsightsService);
    const result = await insights.generateBatchInsights("metro");
    console.log(
      `[forecast-insights] generated=${result.generated} failed=${result.failed} duration_ms=${result.duration_ms}`,
    );
    // Loud-failure guard (see project lesson on silent CI success): a run where
    // nothing generated AND something failed is an error, not a green no-op.
    if (result.generated === 0 && result.failed > 0) {
      throw new Error("Batch generated nothing and reported failures");
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

(If `generateBatchInsights`'s return shape differs from `{ generated, failed, duration_ms }`, match the actual signature at `insights.service.ts:197` / `insight-batch-generator.ts:30` — it is `{ generated: number; failed: number; duration_ms: number }` per the generator's declared return type.)

- [ ] **Step 4: Workflow job**

In `.github/workflows/post-import-refresh.yml`, add a job after `run-scoring-pipeline` (mirror that job's checkout/node/npm-ci steps and Supabase env block exactly — read the file first):

```yaml
generate-forecast-insights:
  needs: [run-scoring-pipeline]
  if: ${{ needs.run-scoring-pipeline.result == 'success' }}
  runs-on: ubuntu-latest
  timeout-minutes: 120
  env:
    SUPABASE_URL: "${{ secrets.SUPABASE_URL }}"
    SUPABASE_SERVICE_KEY: "${{ secrets.SUPABASE_SERVICE_KEY }}"
    SUPABASE_SERVICE_ROLE_KEY: "${{ secrets.SUPABASE_SERVICE_KEY }}"
    DEEPSEEK_API_KEY: "${{ secrets.DEEPSEEK_API_KEY }}"
    AI_DAILY_SPEND_CAP_USD: "25"
  steps:
    # mirror run-scoring-pipeline's checkout / setup-node / npm ci steps verbatim
    - name: Generate metro insights (incl. market_forecast)
      run: |
        npx ts-node -P packages/backend/tsconfig.json \
          packages/backend/src/scripts/generate-forecast-insights.ts
```

**Deployment prerequisite (flag to the user in the task report):** the `DEEPSEEK_API_KEY` GitHub Actions secret must exist in the repo. Also copy any additional env vars the `refresh-piq-scores` job requires for AppModule boot (it bootstraps the same module).

- [ ] **Step 5: Build + commit**

Run: `cd packages/backend && npx tsc --noEmit -p tsconfig.json` — Expected: clean.

```bash
git add packages/backend/src/insights/insight-batch-generator.ts packages/backend/src/insights/insight-batch-generator.spec.ts packages/backend/src/scripts/generate-forecast-insights.ts .github/workflows/post-import-refresh.yml
git commit -m "feat(backend): batch-generate metro forecast insights monthly post-rescore" -- packages/backend/src .github/workflows/post-import-refresh.yml
```

---

### Task 6: `/api/scores/distribution` endpoint

**Files:**

- Create: `packages/backend/src/scoring/scoring-queries-distribution.ts`
- Modify: `packages/backend/src/scoring/scoring-queries.ts` (re-export)
- Modify: the scoring service that hosts `getTopMarkets` (find it via `getTopMarkets` usage from `scoring-markets.controller.ts:117` — add a sibling `getScoreDistribution` delegation)
- Modify: `packages/backend/src/scoring/scoring-markets.controller.ts` (new `@Get('distribution')`)
- Test: `packages/backend/src/scoring/scoring-queries-distribution.spec.ts`

**Interfaces:**

- Consumes: `getLatestScoreDate` (from `./scoring-queries-dates`, used identically in `scoring-queries-rankings.ts:11`), `fetchAllScoresBatched(supabase, geography, scoreType, scoreDate, pageSize, concurrency)` (`scoring-queries-pagination.ts:61`), `validateGeography` / `validateScoreType` (used by `getTopMarkets` in the same controller).
- Produces: `GET /api/scores/distribution?geography=metro&score_type=propertyiq` → `ScoreDistribution` (shape below). Frontend Task 9 consumes it.

**Why:** `/api/scores/top` clamps `limit` to 100 (`scoring-markets.controller.ts:102`) — it cannot serve a 935-metro distribution. Route ordering note: keep `@Get('distribution')` above any parameterized route in this controller class; `ScoringController` (with the catch-all) is registered LAST in the module — do not change that ordering.

- [ ] **Step 1: Write the failing test (pure bucketing)**

```ts
// packages/backend/src/scoring/scoring-queries-distribution.spec.ts
import { bucketScores, MOMENTUM_BANDS } from "./scoring-queries-distribution";

describe("bucketScores groups scores into the momentum bands from CLAUDE.md section 9", () => {
  it("counts each band and boundary values correctly", () => {
    const scores = [95, 85, 75, 65, 55, 45, 30, 10, 50, 59, 60, 90];
    const buckets = bucketScores(scores);
    const byLabel = Object.fromEntries(buckets.map((b) => [b.label, b.count]));
    expect(byLabel["VERY STRONG"]).toBe(2); // 95, 90
    expect(byLabel["STRONG"]).toBe(1); // 85
    expect(byLabel["RISING"]).toBe(1); // 75
    expect(byLabel["FIRMING"]).toBe(2); // 65, 60
    expect(byLabel["STEADY"]).toBe(3); // 55, 50, 59
    expect(byLabel["EASING"]).toBe(1); // 45
    expect(byLabel["WEAK"]).toBe(1); // 30
    expect(byLabel["VERY WEAK"]).toBe(1); // 10
  });

  it("returns all eight bands even when empty", () => {
    expect(bucketScores([]).length).toBe(MOMENTUM_BANDS.length);
    expect(bucketScores([]).every((b) => b.count === 0)).toBe(true);
  });
});
```

Run: `cd packages/backend && npx jest scoring-queries-distribution` — Expected: FAIL.

- [ ] **Step 2: Implement the query module**

```ts
// packages/backend/src/scoring/scoring-queries-distribution.ts
/**
 * Scoring Queries — Momentum-Band Distribution
 *
 * Aggregate distribution of the latest scores across a geography, powering
 * the /forecast national hub ("of N scored metros, X% show easing momentum").
 * Exists because /api/scores/top clamps limit to 100 and cannot serve the
 * full scored set.
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { ScoreType, GeographyLevel } from "./formula-weights";
import { getLatestScoreDate } from "./scoring-queries-dates";
import { fetchAllScoresBatched } from "./scoring-queries-pagination";

export interface ScoreDistributionBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface ScoreDistribution {
  date: string | null;
  total: number;
  buckets: ScoreDistributionBucket[];
}

/** Momentum bands per CLAUDE.md section 9 score labels. */
export const MOMENTUM_BANDS = [
  { label: "VERY STRONG", min: 90, max: 99 },
  { label: "STRONG", min: 80, max: 89 },
  { label: "RISING", min: 70, max: 79 },
  { label: "FIRMING", min: 60, max: 69 },
  { label: "STEADY", min: 50, max: 59 },
  { label: "EASING", min: 40, max: 49 },
  { label: "WEAK", min: 20, max: 39 },
  { label: "VERY WEAK", min: 1, max: 19 },
] as const;

export function bucketScores(scores: number[]): ScoreDistributionBucket[] {
  return MOMENTUM_BANDS.map((band) => ({
    ...band,
    count: scores.filter((s) => s >= band.min && s <= band.max).length,
  }));
}

export async function getScoreDistribution(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  scoreType: ScoreType,
): Promise<ScoreDistribution> {
  const date = await getLatestScoreDate(supabase, geography, scoreType);
  if (!date) {
    return { date: null, total: 0, buckets: bucketScores([]) };
  }
  const { data } = await fetchAllScoresBatched(
    supabase,
    geography,
    scoreType,
    date,
    1000,
    4,
  );
  const scores = data.map((row) => row.score);
  return { date, total: scores.length, buckets: bucketScores(scores) };
}
```

(Check `scoring-queries-dates.ts` for `getLatestScoreDate`'s exact signature before wiring — it is used as `getLatestScoreDate(supabase, geography, scoreType)`-style in `scoring-queries-rankings.ts`; match that usage.)

Re-export from `scoring-queries.ts` alongside the existing pagination/rankings re-exports.

Run: `cd packages/backend && npx jest scoring-queries-distribution` — Expected: PASS.

- [ ] **Step 3: Service delegation + controller route**

In the service class that implements `getTopMarkets` (referenced at `scoring-markets.controller.ts:117-124`), add a sibling method mirroring its Supabase-client access pattern:

```ts
  async getScoreDistribution(
    geography: GeographyLevel,
    scoreType: ScoreType,
  ): Promise<ScoreDistribution> {
    return getScoreDistribution(/* same supabase client the sibling methods use */, geography, scoreType);
  }
```

In `scoring-markets.controller.ts`, add ABOVE any parameterized routes, mirroring `@Get('top')`'s validation and caching:

```ts
  /**
   * GET /api/scores/distribution?geography=metro&score_type=propertyiq
   *
   * Momentum-band distribution across all scored markets at the latest
   * period. Public; powers the /forecast national hub.
   */
  @Get('distribution')
  @Header('Cache-Control', 'public, max-age=21600')
  @ApiOperation({ summary: 'Get score distribution by momentum band' })
  async getScoreDistribution(
    @Query('geography') geography: string,
    @Query('score_type') scoreType: string,
  ) {
    if (!geography) {
      throw new HttpException(
        'geography query parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const geoLevel = validateGeography(geography);
    const validScoreType = validateScoreType(scoreType || 'propertyiq');
    return this.scoringService.getScoreDistribution(geoLevel, validScoreType);
  }
```

- [ ] **Step 4: Verify against the real DB**

Start the local backend (or use the running dev server), then:

Run: `curl -s "http://localhost:3001/api/scores/distribution?geography=metro&score_type=propertyiq"`
Expected: JSON with `date` (recent YYYY-MM-DD), `total` ≈ 935, eight buckets whose counts sum to `total`.

- [ ] **Step 5: Build + commit**

Run: `cd packages/backend && npx tsc --noEmit -p tsconfig.json && npx jest scoring-queries-distribution`

```bash
git add packages/backend/src/scoring/
git commit -m "feat(backend): /api/scores/distribution momentum-band aggregate endpoint" -- packages/backend/src/scoring/
```

---

### Task 7: Frontend `forecastDisplayYear` helper (TDD)

**Files:**

- Create: `packages/frontend/lib/seo/forecast-year.ts`
- Test: `packages/frontend/lib/seo/forecast-year.test.ts`

**Interfaces:**

- Produces: `forecastDisplayYear(latestDate: string | null): number` — Tasks 8, 11, 12, 13 consume it.

- [ ] **Step 1: Write the failing test**

```ts
// packages/frontend/lib/seo/forecast-year.test.ts
import { describe, it, expect } from "vitest";
import { forecastDisplayYear } from "./forecast-year";

describe("forecastDisplayYear rolls the display year forward from October", () => {
  it("returns the period year for January through September", () => {
    expect(forecastDisplayYear("2026-05-31")).toBe(2026);
    expect(forecastDisplayYear("2026-09-30")).toBe(2026);
  });

  it("returns the next year for October through December", () => {
    expect(forecastDisplayYear("2026-10-31")).toBe(2027);
    expect(forecastDisplayYear("2026-12-31")).toBe(2027);
  });

  it("falls back to a current-date-derived year for null or invalid input", () => {
    const now = new Date();
    const expected =
      now.getUTCMonth() >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
    expect(forecastDisplayYear(null)).toBe(expected);
    expect(forecastDisplayYear("not-a-date")).toBe(expected);
  });
});
```

Run: `cd packages/frontend && npx vitest run lib/seo/forecast-year.test.ts` — Expected: FAIL.

- [ ] **Step 2: Implement**

```ts
// packages/frontend/lib/seo/forecast-year.ts
/**
 * Display year for /forecast pages, derived from the latest score period.
 * From October onward searchers look for NEXT year's forecast, so Oct-Dec
 * periods roll the display year forward. Falls back to the current UTC date
 * when no valid period date is available.
 *
 * Kept in sync (3 lines of logic) with the backend twin:
 * packages/backend/src/insights/forecast-display-year.ts
 */
export function forecastDisplayYear(latestDate: string | null): number {
  const parsed = latestDate ? new Date(latestDate) : null;
  const d = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
  const year = d.getUTCFullYear();
  return d.getUTCMonth() >= 9 ? year + 1 : year; // month index 9 = October
}
```

Run: `cd packages/frontend && npx vitest run lib/seo/forecast-year.test.ts` — Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/frontend/lib/seo/forecast-year.ts packages/frontend/lib/seo/forecast-year.test.ts
git commit -m "feat(frontend): forecastDisplayYear helper with October rollover" -- packages/frontend/lib/seo/
```

---

### Task 8: Forecast metadata + FAQ builders (TDD)

**Files:**

- Create: `packages/frontend/lib/seo/forecast-metadata.ts`
- Create: `packages/frontend/app/(public)/forecast/components/build-forecast-faqs.ts`
- Test: `packages/frontend/lib/seo/forecast-metadata.test.ts`
- Test: `packages/frontend/app/(public)/forecast/components/build-forecast-faqs.test.ts`

**Interfaces:**

- Consumes: `MarketStatsData` (`lib/data/fetchers/market-stats.ts:33` — `score`, `grade`, `headline.{medianPrice,rent,daysOnMarket,yoy}.value`, `latestDate`), `MarketFaq` type from `@/app/markets/components/build-market-faqs` (confirm its exact shape — `{ question, answer }` strings — before importing), `formatMetricValue` from `@/lib/data`, `forecastDisplayYear` (Task 7).
- Produces:
  - `buildForecastTitle(name: string, stats: MarketStatsData | null): string`
  - `buildForecastDescription(name: string, stats: MarketStatsData | null): string`
  - `buildForecastFaqs(args: { displayName: string; stats: MarketStatsData | null }): MarketFaq[]`

**Pre-check:** open `lib/seo/market-metadata.ts` and confirm how its private `fmtYoy` treats `headline.yoy.value` (fraction like `0.031` vs already-scaled `3.1`). Use the same convention in the FAQ answer below; adjust the `formatMetricValue` format string (`"percent"` vs `"percent_abs"`) to match what renders correctly there.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/frontend/lib/seo/forecast-metadata.test.ts
import { describe, it, expect } from "vitest";
import {
  buildForecastTitle,
  buildForecastDescription,
} from "./forecast-metadata";
import type { MarketStatsData } from "@/lib/data";

const stats = {
  score: 62,
  grade: "B",
  headline: {
    medianPrice: { value: 455000 },
    rent: { value: null },
    daysOnMarket: { value: 48 },
    yoy: { value: 0.031 },
  },
  receipts: [],
  sparkline: [],
  latestDate: "2026-05-31",
} as unknown as MarketStatsData;

describe("forecast metadata builders derive the year from the score period", () => {
  it("puts the display year and forecast intent in the title", () => {
    expect(buildForecastTitle("Austin, TX", stats)).toBe(
      "Austin, TX Housing Market Forecast 2026: Will Prices Drop?",
    );
  });

  it("rolls the title year forward for an October period", () => {
    const octStats = { ...stats, latestDate: "2026-10-31" } as MarketStatsData;
    expect(buildForecastTitle("Austin, TX", octStats)).toContain(
      "Forecast 2027",
    );
  });

  it("includes score and confidence in the description", () => {
    const desc = buildForecastDescription("Austin, TX", stats);
    expect(desc).toContain("PropertyIQ Score 62");
    expect(desc).toContain("confidence B");
  });

  it("degrades honestly without stats", () => {
    const desc = buildForecastDescription("Austin, TX", null);
    expect(desc).toContain("Austin, TX housing market forecast");
    expect(desc).not.toContain("undefined");
  });
});
```

```ts
// packages/frontend/app/(public)/forecast/components/build-forecast-faqs.test.ts
import { describe, it, expect } from "vitest";
import { buildForecastFaqs } from "./build-forecast-faqs";
import type { MarketStatsData } from "@/lib/data";

const stats = {
  score: 44,
  grade: "A",
  headline: {
    medianPrice: { value: 455000 },
    rent: { value: null },
    daysOnMarket: { value: 61 },
    yoy: { value: -0.012 },
  },
  receipts: [],
  sparkline: [],
  latestDate: "2026-05-31",
} as unknown as MarketStatsData;

describe("buildForecastFaqs answers the crash question from momentum data only", () => {
  const faqs = buildForecastFaqs({ displayName: "Austin, TX", stats });

  it("produces at least 3 FAQs when data is present", () => {
    expect(faqs.length).toBeGreaterThanOrEqual(3);
  });

  it("leads with the crash question containing the display year", () => {
    expect(faqs[0].question).toBe("Will Austin, TX home prices crash in 2026?");
    expect(faqs[0].answer).toContain("PropertyIQ Score of 44");
    expect(faqs[0].answer).toContain("easing");
  });

  it("never fabricates a price prediction", () => {
    for (const faq of faqs) {
      expect(faq.answer).not.toMatch(/will (fall|drop|rise|crash) \d/i);
    }
  });

  it("returns empty for missing stats (page renders without FAQ)", () => {
    expect(buildForecastFaqs({ displayName: "X", stats: null })).toEqual([]);
  });
});
```

Run: `cd packages/frontend && npx vitest run lib/seo/forecast-metadata.test.ts "app/(public)/forecast/components/build-forecast-faqs.test.ts"` — Expected: FAIL.

- [ ] **Step 2: Implement the metadata builders**

```ts
// packages/frontend/lib/seo/forecast-metadata.ts
import { formatMetricValue } from "@/lib/data";
import type { MarketStatsData } from "@/lib/data";
import { forecastDisplayYear } from "./forecast-year";

export function buildForecastTitle(
  name: string,
  stats: MarketStatsData | null,
): string {
  const year = forecastDisplayYear(stats?.latestDate ?? null);
  return `${name} Housing Market Forecast ${year}: Will Prices Drop?`;
}

export function buildForecastDescription(
  name: string,
  stats: MarketStatsData | null,
): string {
  const year = forecastDisplayYear(stats?.latestDate ?? null);
  if (!stats || stats.score === null) {
    return `${name} housing market forecast for ${year}, built from demand-momentum data: price trends, days on market, and price cuts. Not speculation.`;
  }
  const bits: string[] = [`PropertyIQ Score ${stats.score}`];
  if (stats.grade) bits.push(`confidence ${stats.grade}`);
  const price = stats.headline.medianPrice.value;
  if (price !== null)
    bits.push(`${formatMetricValue(price, "currency")} median`);
  return `${name} housing market forecast for ${year}: ${bits.join(", ")}. A momentum-based outlook from real market data, not speculation.`;
}
```

- [ ] **Step 3: Implement the FAQ builder**

```ts
// packages/frontend/app/(public)/forecast/components/build-forecast-faqs.ts
import type { MarketFaq } from "@/app/markets/components/build-market-faqs";
import type { MarketStatsData } from "@/lib/data";
import { formatMetricValue } from "@/lib/data";
import { forecastDisplayYear } from "@/lib/seo/forecast-year";

/** Momentum phrasing per CLAUDE.md section 9 labels — never quality verdicts. */
function momentumPhrase(score: number): string {
  if (score >= 70) return "rising demand momentum";
  if (score >= 60) return "firming demand momentum";
  if (score >= 50)
    return "steady demand momentum, in line with its state average";
  if (score >= 40) return "easing demand momentum";
  return "weak demand momentum";
}

export function buildForecastFaqs({
  displayName,
  stats,
}: {
  displayName: string;
  stats: MarketStatsData | null;
}): MarketFaq[] {
  if (!stats || stats.score === null) return [];
  const year = forecastDisplayYear(stats.latestDate);
  const grade = stats.grade ? ` (confidence grade ${stats.grade})` : "";
  const faqs: MarketFaq[] = [];

  faqs.push({
    question: `Will ${displayName} home prices crash in ${year}?`,
    answer: `Momentum data does not predict prices, but it shows direction. ${displayName} has a PropertyIQ Score of ${stats.score}${grade}, indicating ${momentumPhrase(stats.score)}. A score of 50 equals the market's state average. PropertyIQ does not publish price-crash predictions; it tracks the demand signals that historically move first: price momentum, days on market, and the share of listings with price cuts.`,
  });

  faqs.push({
    question: `What is the ${displayName} PropertyIQ Score?`,
    answer: `${displayName} currently scores ${stats.score} out of 99${grade}. The PropertyIQ Score measures demand momentum from four inputs: 12-month price momentum, 3-month price momentum, median days on market, and price-reduced share. It is calibrated so 50 equals the state average, and it is refreshed monthly.`,
  });

  const dom = stats.headline.daysOnMarket.value;
  if (dom !== null) {
    faqs.push({
      question: `How fast are homes selling in ${displayName}?`,
      answer: `The median listing in ${displayName} currently spends ${formatMetricValue(dom, "days")} on the market. Days on market is one of the four inputs to the PropertyIQ Score: shorter times signal firming demand, longer times signal easing demand.`,
    });
  }

  const yoy = stats.headline.yoy.value;
  if (yoy !== null) {
    faqs.push({
      question: `Are ${displayName} home prices rising or falling right now?`,
      answer: `Over the last year, ${displayName} home values ${yoy >= 0 ? "rose" : "fell"} ${formatMetricValue(Math.abs(yoy), "percent_abs")}. That is measured history, not a forecast; the PropertyIQ Score combines it with days-on-market and price-cut data to read where demand is heading.`,
    });
  }

  return faqs;
}
```

(Apply the `fmtYoy` convention finding from the pre-check — if `headline.yoy.value` is already percent-scaled, drop the format mismatch accordingly.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/frontend && npx vitest run lib/seo/forecast-metadata.test.ts "app/(public)/forecast/components/build-forecast-faqs.test.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/lib/seo/forecast-metadata.ts packages/frontend/lib/seo/forecast-metadata.test.ts "packages/frontend/app/(public)/forecast/components/"
git commit -m "feat(frontend): forecast metadata + data-grounded FAQ builders" -- packages/frontend/lib/seo packages/frontend/app
```

---

### Task 9: `fetchScoreDistribution` data-layer fetcher

**Files:**

- Create: `packages/frontend/lib/data/fetchers/score-distribution.ts`
- Modify: `packages/frontend/lib/data/index.ts` (export)

**Interfaces:**

- Consumes: `GET /api/scores/distribution` (Task 6). Copy the exact import specifiers for `fetchAPICached` and `SEO_MARKET_CACHE_TAG` from the top of `lib/data/fetchers/insights.ts` (same module paths).
- Produces: `fetchScoreDistribution(geography: "metro" | "county" | "zip"): Promise<ScoreDistributionData | null>`; types `ScoreDistributionData`, `ScoreDistributionBucket`. Task 12 consumes.

- [ ] **Step 1: Implement**

```ts
// packages/frontend/lib/data/fetchers/score-distribution.ts
// (match the import lines used by ./insights.ts for fetchAPICached + SEO_MARKET_CACHE_TAG)

export interface ScoreDistributionBucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface ScoreDistributionData {
  date: string | null;
  total: number;
  buckets: ScoreDistributionBucket[];
}

/**
 * Momentum-band distribution across all scored markets at the latest period.
 * Powers the /forecast national hub. Server-cached like the other SEO fetchers.
 */
export async function fetchScoreDistribution(
  geography: "metro" | "county" | "zip",
): Promise<ScoreDistributionData | null> {
  try {
    return await fetchAPICached<ScoreDistributionData>(
      `/api/scores/distribution`,
      { geography, score_type: "propertyiq" },
      { revalidate: 86400, tags: [SEO_MARKET_CACHE_TAG] },
    );
  } catch {
    return null;
  }
}
```

Export `fetchScoreDistribution` and both types from `lib/data/index.ts` alongside the existing fetcher exports.

- [ ] **Step 2: Verify against the running backend**

With the dev servers up, in a scratch node check or via the app: `curl -s "http://localhost:3001/api/scores/distribution?geography=metro&score_type=propertyiq"` returns the shape above (this validates the contract the fetcher types).

- [ ] **Step 3: Typecheck + commit**

Run: `cd packages/frontend && npx tsc --noEmit`
Expected: clean.

```bash
git add packages/frontend/lib/data/fetchers/score-distribution.ts packages/frontend/lib/data/index.ts
git commit -m "feat(frontend): fetchScoreDistribution data-layer fetcher" -- packages/frontend/lib/data/
```

---

### Task 10: Shared markdown parser + `ForecastNarrativeSection`

**Files:**

- Create: `packages/frontend/lib/insights/parse-markdown-sections.ts` (move the parser out of `MarketOverviewSection`)
- Modify: `packages/frontend/app/(public)/markets/[slug]/MarketOverviewSection.tsx` (import the shared parser, delete the private copy)
- Create: `packages/frontend/app/(public)/forecast/components/ForecastNarrativeSection.tsx`

**Interfaces:**

- Consumes: `useInsight` from `@/lib/data` (signature per `MarketOverviewSection.tsx:92-96`: `useInsight(geoLevel | null, regionId | null, insightType)` → `{ insight, generatedAt, error }`; passing nulls disables the client fetch). `InsightData`-shaped `initialInsight` prop.
- Produces: `parseMarkdownSections(content: string): { title: string; body: string }[]`; `ForecastNarrativeSection({ metroName, cbsaCode, initialInsight })` — Task 11 consumes.

- [ ] **Step 1: Extract the parser verbatim**

Create `lib/insights/parse-markdown-sections.ts` containing the exact `parseMarkdownSections` function currently private in `MarketOverviewSection.tsx:20-38` (verbatim body, add `export`). Update `MarketOverviewSection.tsx` to import it and delete its local copy.

Run: `cd packages/frontend && npx tsc --noEmit` — Expected: clean.

- [ ] **Step 2: Create the forecast narrative section**

```tsx
// packages/frontend/app/(public)/forecast/components/ForecastNarrativeSection.tsx
"use client";

import { useInsight } from "@/lib/data";
import { parseMarkdownSections } from "@/lib/insights/parse-markdown-sections";

interface ForecastNarrativeSectionProps {
  metroName: string;
  cbsaCode: string;
  /** Server-fetched cached narrative (cachedOnly=1); null when not yet generated. */
  initialInsight?: { content: string; generated_at: string } | null;
}

/**
 * AI market_forecast narrative, rendered from ## markdown sections.
 * Server insight is preferred (SSR/ISR, cache-only); when absent, a client
 * fetch triggers generation on first human visit and fills the cache.
 * Returns null when no content exists — the page renders fully without it.
 */
export function ForecastNarrativeSection({
  metroName,
  cbsaCode,
  initialInsight,
}: ForecastNarrativeSectionProps) {
  const hasServerInsight = !!initialInsight?.content;

  const { insight: clientInsight } = useInsight(
    hasServerInsight ? null : "metro",
    hasServerInsight ? null : cbsaCode,
    "market_forecast",
  );

  const content = initialInsight?.content ?? clientInsight;
  if (!content) return null;

  const sections = parseMarkdownSections(content);
  return (
    <section
      className="max-w-4xl mx-auto px-4 py-8"
      aria-label={`${metroName} forecast analysis`}
    >
      {sections.map((s) => (
        <div key={s.title} className="mb-8">
          <h2 className="text-xl font-medium text-on-surface mb-3">
            {s.title}
          </h2>
          {s.body.split(/\n{2,}/).map((paragraph, i) => (
            <p
              key={i}
              className="text-sm text-on-surface-variant leading-relaxed mt-3"
            >
              {paragraph}
            </p>
          ))}
        </div>
      ))}
    </section>
  );
}
```

(Before writing, skim `MarketOverviewSection`'s render block and mirror any additional loading/error affordances it has if they're trivially portable; do not port its Article JSON-LD — the forecast page emits its own JSON-LD in Task 11.)

- [ ] **Step 3: Typecheck + commit**

Run: `cd packages/frontend && npx tsc --noEmit`

```bash
git add packages/frontend/lib/insights/ "packages/frontend/app/(public)/markets/[slug]/MarketOverviewSection.tsx" "packages/frontend/app/(public)/forecast/components/ForecastNarrativeSection.tsx"
git commit -m "feat(frontend): shared insight markdown parser + ForecastNarrativeSection" -- packages/frontend/lib/insights packages/frontend/app
```

---

### Task 11: `/forecast/[slug]` per-metro page

**Files:**

- Create: `packages/frontend/app/(public)/forecast/[slug]/page.tsx`
- Create: `packages/frontend/app/(public)/forecast/components/MomentumSignalsSection.tsx`
- Create: `packages/frontend/app/(public)/forecast/components/ForecastCrossLinks.tsx`

**Interfaces:**

- Consumes: `SLUG_TO_METRO`, `METRO_SLUG_DATA` (`@/lib/data/metro-slug-data`), `resolveMetroAlias` (`@/lib/data/market-slug-aliases`), `fetchSeoMarketStats`, `fetchCachedInsight`, `fetchRankings`, `fetchScore` (all `@/lib/data`; `fetchScore(geographyType, geographyId)` → `ScoreResponse | null` with `z_scores?: Record<string, number>` and `score_date: string`), `buildForecastTitle` / `buildForecastDescription` (Task 8), `buildForecastFaqs` (Task 8), `ForecastNarrativeSection` (Task 10), `MarketFaqSection` (`@/app/markets/components/MarketFaqSection`, geo-agnostic), `ScoreWidget` (`@/app/components/scoring/ScoreWidget` — client component, fine to render from a server page), `forecastDisplayYear` (Task 7), `buildMarketOgImagePath` (`@/lib/seo/market-metadata`).
- Produces: the route `GET /forecast/{slug}` with metadata, JSON-LD, and all sections. Tasks 13-15 link to it.

**Format pre-check:** verify `formatMetricValue(0.031, "percent")` renders `3.1%` (fraction-in) — run a one-liner vitest or node check against `lib/format`. The `z_scores` JSONB holds the 4 RAW input values (`zhvi_yoy` and `price_reduced_share` are fractions, `median_days_on_market` is days — per CLAUDE.md §9). If the percent format expects pre-scaled values, multiply by 100 at the call sites below.

- [ ] **Step 1: Momentum signals section (server component)**

```tsx
// packages/frontend/app/(public)/forecast/components/MomentumSignalsSection.tsx
import { formatMetricValue } from "@/lib/data";

interface MomentumSignalsSectionProps {
  metroName: string;
  zScores: Record<string, number>;
}

const SIGNALS: {
  key: string;
  label: string;
  format: "percent" | "days";
  direction: string;
}[] = [
  {
    key: "zhvi_yoy",
    label: "12-Month Price Momentum",
    format: "percent",
    direction: "Higher signals firming demand",
  },
  {
    key: "zhvi_mom_3m",
    label: "3-Month Price Momentum",
    format: "percent",
    direction: "Higher signals firming demand",
  },
  {
    key: "median_days_on_market",
    label: "Median Days on Market",
    format: "days",
    direction: "Lower signals firming demand",
  },
  {
    key: "price_reduced_share",
    label: "Share of Listings With Price Cuts",
    format: "percent",
    direction: "Lower signals firming demand",
  },
];

/** The four PropertyIQ Score inputs, server-rendered from z_scores raw values. */
export function MomentumSignalsSection({
  metroName,
  zScores,
}: MomentumSignalsSectionProps) {
  const rows = SIGNALS.filter((s) => typeof zScores[s.key] === "number");
  if (rows.length === 0) return null;

  return (
    <section className="max-w-4xl mx-auto px-4 py-8">
      <h2 className="text-xl font-medium text-on-surface mb-6">
        What Drives the {metroName} Outlook
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((s) => (
          <div
            key={s.key}
            className="rounded-xl border border-outline-variant p-5"
          >
            <div className="text-sm text-on-surface-variant">{s.label}</div>
            <div className="mt-1 text-2xl font-medium text-on-surface font-mono">
              {formatMetricValue(zScores[s.key], s.format)}
            </div>
            <div className="mt-1 text-xs text-on-surface-variant">
              {s.direction}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Cross-links component (server)**

```tsx
// packages/frontend/app/(public)/forecast/components/ForecastCrossLinks.tsx
import Link from "next/link";
import type { MetroSlugEntry } from "@/lib/data/metro-slugs";

interface ForecastCrossLinksProps {
  metro: MetroSlugEntry;
  relatedMetros: MetroSlugEntry[];
  year: number;
}

/** Back-link to the full market page + same-state forecast pills. */
export function ForecastCrossLinks({
  metro,
  relatedMetros,
  year,
}: ForecastCrossLinksProps) {
  return (
    <section className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href={`/markets/${metro.slug}`}
        className="inline-block rounded-xl border border-outline-variant p-5 text-on-surface hover:bg-surface-container-low"
      >
        Full {metro.shortName} market data, score history, and trends →
      </Link>
      {relatedMetros.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-medium text-on-surface mb-4">
            More {metro.state} Forecasts for {year}
          </h2>
          <div className="flex flex-wrap gap-2">
            {relatedMetros.map((m) => (
              <Link
                key={m.slug}
                href={`/forecast/${m.slug}`}
                className="rounded-full border border-outline-variant px-4 py-2 text-sm text-on-surface hover:bg-surface-container-low"
              >
                {m.shortName}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: The page**

Mirror `app/(public)/markets/[slug]/page.tsx` structurally (read it first):

```tsx
// packages/frontend/app/(public)/forecast/[slug]/page.tsx
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { METRO_SLUG_DATA, SLUG_TO_METRO } from "@/lib/data/metro-slug-data";
import { resolveMetroAlias } from "@/lib/data/market-slug-aliases";
import {
  fetchSeoMarketStats,
  fetchRankings,
  fetchCachedInsight,
  fetchScore,
} from "@/lib/data";
import {
  buildForecastTitle,
  buildForecastDescription,
} from "@/lib/seo/forecast-metadata";
import { buildMarketOgImagePath } from "@/lib/seo/market-metadata";
import { forecastDisplayYear } from "@/lib/seo/forecast-year";
import { MarketFaqSection } from "@/app/markets/components/MarketFaqSection";
import { buildForecastFaqs } from "../components/build-forecast-faqs";
import { ForecastNarrativeSection } from "../components/ForecastNarrativeSection";
import { MomentumSignalsSection } from "../components/MomentumSignalsSection";
import { ForecastCrossLinks } from "../components/ForecastCrossLinks";
import { ScoreWidget } from "@/app/components/scoring/ScoreWidget";

export function generateStaticParams() {
  return METRO_SLUG_DATA.slice(0, 150).map((metro) => ({ slug: metro.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const metro = SLUG_TO_METRO.get(slug);
  if (!metro) return {};

  const pageUrl = `https://www.propertyiq.app/forecast/${metro.slug}`;
  const stats = await fetchSeoMarketStats("metro", metro.cbsaCode, metro.state);
  const title = buildForecastTitle(metro.shortName, stats);
  const description = buildForecastDescription(metro.shortName, stats);
  const ogImageUrl = buildMarketOgImagePath(metro.shortName, stats);

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "website",
      url: pageUrl,
      title: `${title} | PropertyIQ`,
      description,
      siteName: "PropertyIQ",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${metro.shortName} housing market forecast - PropertyIQ`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export const revalidate = 86400;
export const dynamicParams = true;

export default async function ForecastMetroPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const metro = SLUG_TO_METRO.get(slug);
  if (!metro) {
    const canonical = resolveMetroAlias(slug);
    if (canonical) permanentRedirect(`/forecast/${canonical}`);
    notFound();
  }

  const [stats, serverInsight, scoreData, metroRank] = await Promise.all([
    fetchSeoMarketStats("metro", metro.cbsaCode, metro.state),
    fetchCachedInsight("metro", metro.cbsaCode, "market_forecast"),
    fetchScore("metro", metro.cbsaCode),
    fetchRankings("propertyiq", "metro", { state: metro.state, limit: 8 }),
  ]);

  const year = forecastDisplayYear(
    stats?.latestDate ?? scoreData?.score_date ?? null,
  );

  const metroBySlug = new Map(METRO_SLUG_DATA.map((m) => [m.cbsaCode, m]));
  const relatedMetros = metroRank
    .filter((r) => r.id !== metro.cbsaCode && metroBySlug.has(r.id))
    .map((r) => metroBySlug.get(r.id)!)
    .slice(0, 5);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://www.propertyiq.app",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Forecast",
        item: "https://www.propertyiq.app/forecast",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: metro.shortName,
        item: `https://www.propertyiq.app/forecast/${metro.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <section className="max-w-4xl mx-auto px-4 pt-10 pb-6">
        <h1 className="text-3xl font-medium text-on-surface">
          {metro.shortName} Housing Market Forecast {year}
        </h1>
        <p className="mt-3 text-on-surface-variant leading-relaxed">
          A momentum-based outlook built from real market data: the PropertyIQ
          demand score, days on market, and price-cut trends — refreshed
          monthly, with a confidence grade. No speculation, no price targets.
        </p>
        <div className="mt-6">
          <ScoreWidget
            geographyType="metro"
            geographyId={metro.cbsaCode}
            scoreType="propertyiq"
            size={120}
            showConfidence
          />
        </div>
      </section>

      <ForecastNarrativeSection
        metroName={metro.shortName}
        cbsaCode={metro.cbsaCode}
        initialInsight={serverInsight}
      />

      {scoreData?.z_scores && (
        <MomentumSignalsSection
          metroName={metro.shortName}
          zScores={scoreData.z_scores}
        />
      )}

      <MarketFaqSection
        faqs={buildForecastFaqs({ displayName: metro.shortName, stats })}
      />

      <ForecastCrossLinks
        metro={metro}
        relatedMetros={relatedMetros}
        year={year}
      />
    </>
  );
}
```

- [ ] **Step 4: Verify in the dev server (real data)**

With dev servers running: open `http://localhost:3000/forecast/<canonical-slug>` for a real metro (find Austin's canonical slug via `node -e "const d=require('./packages/frontend/lib/data/metro-slug-data.json'); console.log(d.find(m=>m.cbsaCode==='12420').slug)"`).
Expected: 200; H1 contains "Housing Market Forecast" + the year; ScoreWidget renders a score; FAQ section present (≥3 items); momentum cards render values. Narrative section may be absent until Task 15 generates one — that must NOT break the page.
Also: an alias slug (e.g. `/forecast/austin-tx` if not canonical) 308-redirects; a garbage slug 404s.

- [ ] **Step 5: Typecheck + commit**

Run: `cd packages/frontend && npx tsc --noEmit`

```bash
git add "packages/frontend/app/(public)/forecast/"
git commit -m "feat(frontend): /forecast/[slug] per-metro forecast pages" -- packages/frontend/app
```

---

### Task 12: `/forecast` national hub page

**Files:**

- Create: `packages/frontend/app/(public)/forecast/page.tsx`
- Create: `packages/frontend/app/(public)/forecast/components/DistributionSummary.tsx`
- Create: `packages/frontend/app/(public)/forecast/components/ForecastMarketIndex.tsx`

**Interfaces:**

- Consumes: `fetchScoreDistribution` (Task 9), `fetchRankings` (top/bottom movers via `order: "asc" | "desc"`), `METRO_SLUG_DATA` + `CBSA_TO_METRO` (`@/lib/data/metro-slug-data`), `forecastDisplayYear`, `MarketFaqSection`, `COVERAGE_COPY` from `@/lib/data/validation-claims` (check its exact export shape before use — it is the mandated source for marketing coverage claims).
- Produces: the route `GET /forecast`.

- [ ] **Step 1: Distribution summary component**

```tsx
// packages/frontend/app/(public)/forecast/components/DistributionSummary.tsx
import type { ScoreDistributionData } from "@/lib/data";

interface DistributionSummaryProps {
  distribution: ScoreDistributionData;
  year: number;
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * Deterministic, data-derived answer to the crash question: the live momentum
 * distribution across all scored metros. No AI, no speculation.
 */
export function DistributionSummary({
  distribution,
  year,
}: DistributionSummaryProps) {
  const { buckets, total } = distribution;
  const count = (labels: string[]) =>
    buckets
      .filter((b) => labels.includes(b.label))
      .reduce((s, b) => s + b.count, 0);

  const rising = count(["VERY STRONG", "STRONG", "RISING", "FIRMING"]);
  const steady = count(["STEADY"]);
  const easing = count(["EASING", "WEAK", "VERY WEAK"]);

  return (
    <section className="max-w-4xl mx-auto px-4 py-8">
      <p className="text-lg text-on-surface leading-relaxed">
        Across {total.toLocaleString()} scored metro markets,{" "}
        {pct(easing, total)}% show easing or weak demand momentum heading into{" "}
        {year}, {pct(steady, total)}% are steady near their state average, and{" "}
        {pct(rising, total)}% are firming or rising. That is a market that is
        cooling unevenly — not a nationwide crash.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-outline-variant p-5">
          <div className="text-2xl font-medium font-mono text-on-surface">
            {pct(rising, total)}%
          </div>
          <div className="text-sm text-on-surface-variant mt-1">
            Firming or rising momentum
          </div>
        </div>
        <div className="rounded-xl border border-outline-variant p-5">
          <div className="text-2xl font-medium font-mono text-on-surface">
            {pct(steady, total)}%
          </div>
          <div className="text-sm text-on-surface-variant mt-1">
            Steady, near state average
          </div>
        </div>
        <div className="rounded-xl border border-outline-variant p-5">
          <div className="text-2xl font-medium font-mono text-on-surface">
            {pct(easing, total)}%
          </div>
          <div className="text-sm text-on-surface-variant mt-1">
            Easing or weak momentum
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: State-grouped crawlable index**

```tsx
// packages/frontend/app/(public)/forecast/components/ForecastMarketIndex.tsx
import Link from "next/link";
import { METRO_SLUG_DATA } from "@/lib/data/metro-slug-data";

/** Crawlable index of every metro forecast page, grouped by state. */
export function ForecastMarketIndex({ year }: { year: number }) {
  const byState = new Map<string, typeof METRO_SLUG_DATA>();
  for (const metro of METRO_SLUG_DATA) {
    const list = byState.get(metro.state) ?? [];
    list.push(metro);
    byState.set(metro.state, list);
  }
  const states = [...byState.keys()].sort();

  return (
    <section className="max-w-4xl mx-auto px-4 py-8">
      <h2 className="text-xl font-medium text-on-surface mb-6">
        All {year} Metro Forecasts by State
      </h2>
      <div className="space-y-6">
        {states.map((state) => (
          <div key={state}>
            <h3 className="text-base font-medium text-on-surface mb-2">
              {state}
            </h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {byState.get(state)!.map((m) => (
                <Link
                  key={m.slug}
                  href={`/forecast/${m.slug}`}
                  className="text-sm text-primary hover:underline"
                >
                  {m.shortName}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: The hub page**

```tsx
// packages/frontend/app/(public)/forecast/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { fetchScoreDistribution, fetchRankings } from "@/lib/data";
import { CBSA_TO_METRO } from "@/lib/data/metro-slug-data";
import { forecastDisplayYear } from "@/lib/seo/forecast-year";
import { MarketFaqSection } from "@/app/markets/components/MarketFaqSection";
import { DistributionSummary } from "./components/DistributionSummary";
import { ForecastMarketIndex } from "./components/ForecastMarketIndex";

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const distribution = await fetchScoreDistribution("metro");
  const year = forecastDisplayYear(distribution?.date ?? null);
  const title = `Will Home Prices Crash in ${year}? What the Data Shows`;
  const description = `A data-first ${year} housing market forecast: live demand-momentum readings across every scored US metro — score, confidence grade, days on market, and price cuts. Updated monthly. No speculation.`;
  const pageUrl = "https://www.propertyiq.app/forecast";
  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "website",
      url: pageUrl,
      title: `${title} | PropertyIQ`,
      description,
      siteName: "PropertyIQ",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ForecastHubPage() {
  const [distribution, top, bottom] = await Promise.all([
    fetchScoreDistribution("metro"),
    fetchRankings("propertyiq", "metro", { limit: 5 }),
    fetchRankings("propertyiq", "metro", { limit: 5, order: "asc" }),
  ]);
  const year = forecastDisplayYear(distribution?.date ?? null);

  const toForecastLink = (r: { id: string; name: string; score: number }) => {
    const metro = CBSA_TO_METRO.get(r.id);
    return metro
      ? { ...r, slug: metro.slug, shortName: metro.shortName }
      : null;
  };
  const topLinks = top.map(toForecastLink).filter(Boolean) as Array<{
    slug: string;
    shortName: string;
    score: number;
  }>;
  const bottomLinks = bottom.map(toForecastLink).filter(Boolean) as Array<{
    slug: string;
    shortName: string;
    score: number;
  }>;

  const faqs = [
    {
      question: `Will home prices crash in ${year}?`,
      answer: `No single national answer is honest — housing is local. The live data shows a market cooling unevenly: some metros have weak demand momentum while others are still firming. PropertyIQ tracks the demand signals that historically move before prices (price momentum, days on market, price cuts) across every scored metro, each with a confidence grade. Check your market's forecast page for its specific momentum reading.`,
    },
    {
      question: "How does PropertyIQ build these forecasts?",
      answer: `Each market gets a PropertyIQ Score from four measured inputs: 12-month price momentum, 3-month price momentum, median days on market, and the share of listings with price cuts. Scores are calibrated so 50 equals the market's state average, refreshed monthly, and each carries an A-F confidence grade for data quality. PropertyIQ never publishes specific price predictions.`,
    },
    {
      question: "Which housing markets are cooling fastest?",
      answer: `The lowest-scoring metros right now are ${bottomLinks.map((m) => m.shortName).join(", ")}. A low score means weak demand momentum — days on market stretching and price cuts spreading — not a verdict that a market is bad.`,
    },
  ];

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://www.propertyiq.app",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Forecast",
        item: "https://www.propertyiq.app/forecast",
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <section className="max-w-4xl mx-auto px-4 pt-10 pb-2">
        <h1 className="text-3xl font-medium text-on-surface">
          Will Home Prices Crash in {year}? What the Data Shows
        </h1>
        <p className="mt-3 text-on-surface-variant leading-relaxed">
          Live demand-momentum readings across every scored US metro — updated
          monthly from price trends, days on market, and price-cut data, each
          with a confidence grade. No hot takes, no price targets.
        </p>
      </section>

      {distribution && (
        <DistributionSummary distribution={distribution} year={year} />
      )}

      <section className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="text-xl font-medium text-on-surface mb-4">
              Strongest Momentum
            </h2>
            <div className="space-y-2">
              {topLinks.map((m) => (
                <Link
                  key={m.slug}
                  href={`/forecast/${m.slug}`}
                  className="flex justify-between rounded-xl border border-outline-variant p-4 hover:bg-surface-container-low"
                >
                  <span className="text-on-surface">{m.shortName}</span>
                  <span className="font-mono text-on-surface">{m.score}</span>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-xl font-medium text-on-surface mb-4">
              Weakest Momentum
            </h2>
            <div className="space-y-2">
              {bottomLinks.map((m) => (
                <Link
                  key={m.slug}
                  href={`/forecast/${m.slug}`}
                  className="flex justify-between rounded-xl border border-outline-variant p-4 hover:bg-surface-container-low"
                >
                  <span className="text-on-surface">{m.shortName}</span>
                  <span className="font-mono text-on-surface">{m.score}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <MarketFaqSection faqs={faqs} />

      <ForecastMarketIndex year={year} />
    </>
  );
}
```

Note: hub body copy derives all numbers live from the distribution — if any static marketing-style coverage sentence is added ("900+ metros…"), source it from `COVERAGE_COPY`, never a hardcoded count.

- [ ] **Step 4: Verify in dev (real data)**

Open `http://localhost:3000/forecast`.
Expected: 200; H1 has the year; three distribution stat cards sum sensibly; top/bottom lists link to `/forecast/<slug>` pages that load; state index renders ~50 state groups; FAQ renders 3 items.

- [ ] **Step 5: Typecheck + commit**

Run: `cd packages/frontend && npx tsc --noEmit`

```bash
git add "packages/frontend/app/(public)/forecast/"
git commit -m "feat(frontend): /forecast national hub with live momentum distribution" -- packages/frontend/app
```

---

### Task 13: Markets-page teaser + sitemap section

**Files:**

- Modify: `packages/frontend/app/(public)/markets/[slug]/page.tsx` (add teaser near the related-metros block, ~line 150+)
- Modify: `packages/frontend/lib/seo/sitemap-builder.ts` (new `buildForecastUrls`, index entry, `buildSitemapById` branch)

**Interfaces:**

- Consumes: `forecastDisplayYear`, existing `stats` already fetched in the markets page; `scoredEntries` + `isoOrUndefined` + `METRO_SLUG_DATA` already in `sitemap-builder.ts`.
- Produces: `/sitemaps/forecast` section; visible cross-link from every metro market page.

- [ ] **Step 1: Teaser on the market page**

In `markets/[slug]/page.tsx`, import `forecastDisplayYear` from `@/lib/seo/forecast-year`, compute `const forecastYear = forecastDisplayYear(stats?.latestDate ?? null);` after `stats` is fetched, and add after the related-metros links block (inside the returned JSX, before `MarketFaqSection`):

```tsx
<section className="max-w-4xl mx-auto px-4 py-6">
  <Link
    href={`/forecast/${metro.slug}`}
    className="block rounded-xl border border-outline-variant p-5 hover:bg-surface-container-low"
  >
    <span className="text-base font-medium text-on-surface">
      {metro.shortName} Housing Market Forecast {forecastYear} →
    </span>
    <span className="mt-1 block text-sm text-on-surface-variant">
      Where the momentum data says this market is heading — score, confidence
      grade, and the signals behind it.
    </span>
  </Link>
</section>
```

- [ ] **Step 2: Sitemap section**

In `sitemap-builder.ts` add (next to `buildMetrosUrls`):

```ts
export async function buildForecastUrls(): Promise<SitemapUrl[]> {
  const { lastmod, entries } = await scoredEntries(
    "metro",
    METRO_SLUG_DATA,
    (metro) => metro.cbsaCode,
  );
  return [
    { loc: `${BASE_URL}/forecast`, lastmod },
    ...entries.map((metro) => ({
      loc: `${BASE_URL}/forecast/${metro.slug}`,
      lastmod,
    })),
  ];
}
```

In `buildIndexEntries()` add after the metros entry:

```ts
    {
      loc: `${BASE_URL}/sitemaps/forecast`,
      lastmod: isoOrUndefined(metro.date),
    },
```

In `buildSitemapById()` add:

```ts
if (id === "forecast") return buildForecastUrls();
```

- [ ] **Step 3: Verify**

With dev servers running:
Run: `curl -s http://localhost:3000/sitemaps/forecast | head -30` — Expected: XML containing `/forecast` and `/forecast/<slug>` URLs.
Run: `curl -s http://localhost:3000/sitemap.xml | grep forecast` — Expected: the `/sitemaps/forecast` index entry.
Open a metro market page — the forecast teaser card renders and links correctly.

- [ ] **Step 4: Typecheck + commit**

Run: `cd packages/frontend && npx tsc --noEmit`

```bash
git add "packages/frontend/app/(public)/markets/[slug]/page.tsx" packages/frontend/lib/seo/sitemap-builder.ts
git commit -m "feat(frontend): forecast teaser on market pages + forecast sitemap section" -- packages/frontend/app packages/frontend/lib/seo
```

---

### Task 14: Blog supersede redirects + de-scored forecast redirects

**Files:**

- Create: `scripts/generate-forecast-blog-redirects.ts`
- Create (generated): `packages/frontend/lib/data/forecast-blog-redirects.json`
- Modify: `packages/frontend/next.config.mjs` (read + splice the new JSON, like `descoredRedirects` at lines 5-12 and 186-190; update the 5 hardcoded blog duplicate-slug redirect DESTINATIONS at lines ~124-149 to point at the new forecast URLs to avoid chains)
- Delete (via the script): matched `packages/frontend/content/blog/*.mdx` files
- Modify: `scripts/generate-descored-redirects.ts` (metro block, ~line 162)

**Interfaces:**

- Consumes: `packages/frontend/lib/data/metro-slug-data.json` (records: `{ cbsaCode, slug, name, shortName, state }`), blog slugs = filename minus `.mdx` (`lib/blog/index.ts:64-70`), alias logic in `packages/frontend/lib/data/market-slug-aliases.ts` (alias key = `firstcity-state`, lowercase).
- Produces: 308 redirects `/blog/<slug>` → `/forecast/<metro-slug>` (or `/forecast` for the national post and unmatched cities); `/forecast/<slug>` → `/forecast` 307s for de-scored metros in future monthly runs.

- [ ] **Step 1: Write the redirect generator**

```ts
// scripts/generate-forecast-blog-redirects.ts
/**
 * One-time supersede: maps the static 2026 forecast-intent blog posts to the
 * data-fed /forecast pages, emits a redirect JSON spliced into next.config.mjs,
 * and deletes the superseded MDX files (delete stale content, don't keep
 * drifted duplicates).
 *
 * Matches: housing-market-forecast-2026 (→ /forecast) and
 * [YYYY-MM-DD-]{city[-st]}-real-estate-market-2026 (→ /forecast/<metro-slug>,
 * falling back to /forecast when no published metro matches). All other blog
 * posts (best-cash-flow-*, brrrr, movers, etc.) are untouched.
 */
import * as fs from "fs";
import * as path from "path";

const BLOG_DIR = path.resolve("packages/frontend/content/blog");
const OUT_FILE = path.resolve(
  "packages/frontend/lib/data/forecast-blog-redirects.json",
);
const METRO_DATA = JSON.parse(
  fs.readFileSync(
    path.resolve("packages/frontend/lib/data/metro-slug-data.json"),
    "utf8",
  ),
) as Array<{ cbsaCode: string; slug: string; state: string }>;

const SLUG_SET = new Set(METRO_DATA.map((m) => m.slug));
// Alias map mirroring market-slug-aliases.ts: "firstcity-state" -> canonical slug.
// firstcity = canonical slug's leading city segment; state = entry state, lowercased.
const ALIASES = new Map<string, string>();
for (const m of METRO_DATA) {
  const st = m.state.toLowerCase();
  const stateIdx = m.slug.lastIndexOf(`-${st}`);
  const cityPart = stateIdx > 0 ? m.slug.slice(0, stateIdx) : m.slug;
  const firstCity = cityPart.split("-round-")[0]; // crude; refined below
  void firstCity;
  ALIASES.set(`${cityPart.split("--")[0]}-${st}`, m.slug);
}
// NOTE: before relying on this, open packages/frontend/lib/data/market-slug-aliases.ts
// and REPLICATE its exact alias-derivation logic here (or import it if the script
// runs under the frontend tsconfig). The alias rule there is authoritative.

const CITY_POST = /^(?:\d{4}-\d{2}-\d{2}-)?(.+)-real-estate-market-2026$/;

interface Redirect {
  source: string;
  destination: string;
  permanent: boolean;
}
const redirects: Redirect[] = [];
const toDelete: string[] = [];

for (const file of fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"))) {
  const slug = file.replace(/\.mdx$/, "");
  if (
    slug === "housing-market-forecast-2026" ||
    /^\d{4}-\d{2}-\d{2}-housing-market-forecast-2026$/.test(slug)
  ) {
    redirects.push({
      source: `/blog/${slug}`,
      destination: "/forecast",
      permanent: true,
    });
    toDelete.push(file);
    continue;
  }
  const m = CITY_POST.exec(slug);
  if (!m) continue;
  const candidate = m[1]; // e.g. "austin", "huntsville-al"
  let destination = "/forecast";
  if (SLUG_SET.has(candidate)) {
    destination = `/forecast/${candidate}`;
  } else if (ALIASES.has(candidate)) {
    destination = `/forecast/${ALIASES.get(candidate)}`;
  } else {
    // no state suffix: unique prefix match against alias keys ("austin" -> "austin-tx")
    const matches = [...ALIASES.keys()].filter(
      (k) => k.replace(/-[a-z]{2}$/, "") === candidate,
    );
    if (matches.length === 1)
      destination = `/forecast/${ALIASES.get(matches[0])}`;
  }
  redirects.push({ source: `/blog/${slug}`, destination, permanent: true });
  toDelete.push(file);
}

fs.writeFileSync(OUT_FILE, JSON.stringify(redirects, null, 2) + "\n");
console.log(`wrote ${redirects.length} redirects to ${OUT_FILE}`);
const matched = redirects.filter((r) => r.destination !== "/forecast").length;
console.log(
  `metro-matched: ${matched}; fell back to /forecast: ${redirects.length - matched}`,
);
for (const f of toDelete) fs.unlinkSync(path.join(BLOG_DIR, f));
console.log(`deleted ${toDelete.length} superseded MDX posts`);
```

**Before running:** replicate the exact alias derivation from `market-slug-aliases.ts:61-86` in place of the crude placeholder marked NOTE — the alias rule there ("firstcity-state") is authoritative and this script must match it 1:1.

- [ ] **Step 2: Run it and review the mapping**

Run: `npx ts-node scripts/generate-forecast-blog-redirects.ts`
Expected: ~100-200 redirects written; deletion count matches; report the metro-matched vs fell-back split. **Manually spot-check 5 mappings** (e.g. `austin-real-estate-market-2026` must map to Austin's canonical metro slug, not `/forecast`). If the fell-back share exceeds ~30%, stop and fix the alias matching before proceeding.

- [ ] **Step 3: Splice into next.config.mjs**

Mirror the `descoredRedirects` pattern exactly:

```js
// near lines 5-12:
const forecastBlogRedirects = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('./lib/data/forecast-blog-redirects.json', import.meta.url)),
    'utf8',
  ),
);

// inside async redirects(), after ...descoredRedirects:
      // ── Superseded 2026 forecast blog posts → /forecast pages ─────
      // Generated once by scripts/generate-forecast-blog-redirects.ts.
      ...forecastBlogRedirects,
```

Also update the 5 hardcoded blog duplicate-slug redirects (~lines 124-149): their destinations were `/blog/<canonical-post>` which now themselves redirect — repoint each `destination` to the same forecast URL its canonical post now maps to (look it up in the generated JSON) to avoid redirect chains.

- [ ] **Step 4: Extend de-scored redirects**

In `scripts/generate-descored-redirects.ts`, in the metro block right after the existing `allRedirects.push({ source: \`/markets/...\` })` (~line 162), add:

```ts
// Forecast pages share the metro slug set; a de-scored metro's
// forecast page falls back to the national hub (no forecast ancestor).
allRedirects.push({
  source: `/forecast/${oldEntry.slug}`,
  destination: "/forecast",
  permanent: false,
});
```

- [ ] **Step 5: Verify**

Restart the frontend dev server (next.config change requires it), then:
Run: `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/blog/austin-real-estate-market-2026`
Expected: `308 http://localhost:3000/forecast/<austin-canonical-slug>`.
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/blog/housing-market-forecast-2026` → `308` to `/forecast`.
Confirm an untouched post (e.g. a `best-cash-flow-*` slug) still returns 200.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-forecast-blog-redirects.ts scripts/generate-descored-redirects.ts packages/frontend/lib/data/forecast-blog-redirects.json packages/frontend/next.config.mjs packages/frontend/content/blog
git commit -m "feat(seo): supersede 2026 forecast blog posts with /forecast redirects" -- scripts packages/frontend
```

---

### Task 15: E2E verification (real DB + prod preview)

**Files:**

- Create: `scripts/verify/verify-forecast-content.md` (checklist artifact with results — optional but preferred)
- No production code changes; fixes discovered here loop back to the owning task.

**Interfaces:**

- Consumes: everything above. Austin CBSA `12420` is the canonical test metro (look up its slug from `metro-slug-data.json`).

- [ ] **Step 1: Generate one real narrative (single-metro cost, real DB)**

With local dev servers running (backend :3001 must have DEEPSEEK/AI env configured):

Run: `curl -s "http://localhost:3001/api/insights/metro/12420?type=market_forecast"`
Expected: `{ content, generated_at, model }`; content contains the four `## ` headers with the correct display year.

Then the cache path: `curl -s "http://localhost:3001/api/insights/metro/12420?type=market_forecast&cachedOnly=1"` → same content (from `market_insights`, no regeneration).

DB check (Supabase MCP `execute_sql`):

```sql
SELECT insight_type, model, generated_at, length(content)
FROM market_insights
WHERE region_id = '12420' AND insight_type = 'market_forecast';
```

Expected: one row, non-trivial length.

- [ ] **Step 2: Honesty spot-check harness**

Generate for 3 metros total (repeat step 1 for two more CBSAs, e.g. `16740` Charlotte, `38060` Phoenix). For each `content`, assert:

- No fabricated price prediction: content does NOT match `/(?:will|to|expected to)\s+(?:fall|drop|rise|crash|decline|increase)\s+(?:by\s+)?\d+(?:\.\d+)?\s*%/i`
- No quality verdicts: does NOT match `/\b(EXCELLENT|VERY POOR|POOR|GOOD MARKET|BAD MARKET)\b/`
- Confidence surfaced: matches `/confidence/i`
  Record pass/fail per metro. Any failure → tighten `FORECAST_HONESTY_RULE` in Task 3's builder and regenerate (delete the row first so generation re-runs).

- [ ] **Step 3: Production-preview build + Playwright checks**

Follow the repo's established prod-preview verification pattern (build to `.next-verify`, serve with `next start -p 3100` — see the memory reference "Frontend prod-preview verification"; do NOT clobber the dev `.next`):

Checks (Playwright or curl + node parsing):

1. `GET /forecast` → 200; `<h1>` contains "Will Home Prices Crash in" + correct year; three distribution percentages sum to 99-101; every `application/ld+json` block parses via `JSON.parse`.
2. `GET /forecast/<austin-slug>` → 200; `<h1>` = "Austin, TX Housing Market Forecast <year>"; narrative `##` sections rendered (generated in Step 1); FAQ present; momentum cards present; cross-link to `/markets/<austin-slug>` present.
3. Alias: `GET /forecast/austin-tx` (if non-canonical) → 308 to canonical. Garbage slug → 404.
4. Blog redirects: `/blog/austin-real-estate-market-2026` → 308 `/forecast/<austin-slug>`; `/blog/housing-market-forecast-2026` → 308 `/forecast`.
5. `GET /sitemaps/forecast` → XML with `/forecast` + per-metro URLs; `GET /sitemap.xml` includes the forecast index entry.
6. Markets page teaser: `GET /markets/<austin-slug>` contains `href="/forecast/<austin-slug>"`.

- [ ] **Step 4: Full builds clean**

Run: `cd packages/backend && npx nest build` — Expected: zero errors (fix ALL errors if any, including pre-existing).
Run: `cd packages/frontend && npx next build` — Expected: zero errors.
Run: `cd packages/backend && npx jest` and `cd packages/frontend && npx vitest run lib/seo app/(public)/forecast` — Expected: PASS.

- [ ] **Step 5: Record results + commit**

Write the checklist results (each check, pass/fail, evidence snippet) to `scripts/verify/verify-forecast-content.md`.

```bash
git add scripts/verify/verify-forecast-content.md
git commit -m "test(seo): forecast content E2E verification results" -- scripts/verify
```

Then dispatch background validation agents per CLAUDE.md §1.6: `code-reviewer` (feature), `data-layer-reviewer` (new fetcher), `dto-validation-auditor` (new controller route), `file-size-compliance` (new pages). Surface only CRITICAL/WARNING findings.

---

## Self-Review Notes (already applied)

- **Spec coverage:** routes (T11, T12), insight purpose + honesty (T3, T4), confidence surfaced (T1), batch + monthly wiring (T5), hub aggregate endpoint (T6, T9), year helper both sides (T2, T7), cross-links (T11, T13), blog supersede + deletion (T14), de-scored forecast redirects (T14), sitemap (T13), E2E incl. honesty harness + prod preview (T15). Spec's "reuse market_outlook on hub" replaced by deterministic distribution copy — documented as a deviation at the top.
- **Type consistency:** `forecastDisplayYear` — backend takes `Date`, frontend takes `string | null` (different inputs by design, same rollover rule, cross-referenced in both files' comments). `ScoreDistribution` (backend) and `ScoreDistributionData` (frontend fetcher) are intentionally separate declarations of the same wire shape, consistent with how the codebase types other fetchers.
- **Known judgment calls the executor must respect:** the alias-derivation replication note in T14 Step 1 is a hard requirement, not a suggestion; the `fmtYoy`/percent-format pre-checks in T8/T11 must happen before wiring formats.
