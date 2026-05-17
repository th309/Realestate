# PropertyIQ Deal Analyzer — Phase 1 Redesign Spec

**Date:** 2026-05-14
**Status:** Draft, pending user approval
**Branch:** `feat/deal-analyzer`
**Supersedes:** [2026-05-14-deal-analyzer-design.md](./2026-05-14-deal-analyzer-design.md) for the UI / data-flow / AI layers; the original spec's analyzer-core math contracts and saved-analyses storage remain in force.
**Origin:** User wants the existing `/analyzer` page rebuilt as a state-of-the-art deal analyzer with world-class data visualization, AI recommendations grounded in RentCast + PropertyIQ market context, multi-horizon projections, and "best calculator I've used" UX. Brainstorm session at `.superpowers/brainstorm/10983-1778805693/` produced this design.

---

## 1. Summary

Replace the current `/analyzer` UI big-bang with a redesigned deal analyzer that:

- Renders **30 strategy-specific visualizations** (10 each for Buy & Hold, Flip, BRRRR) using a shared kit of ~10 reusable chart components built on Recharts + D3 + framer-motion — the same library mix already in production at `/graphs`.
- Surfaces **AI insights at the header (always-on, streaming) and per-section (lazy, refreshable)**, with prompts grounded in deterministic analyzer-core results + RentCast comp data + PropertyIQ market context. AI defaults to DeepSeek for cost; admins can route any purpose to Claude/OpenAI/Google via the existing `ai_model_config` table.
- Uses **RentCast as the per-property data feed** for AVM, sales comps, rental comps, and the property record. Pro-only, monthly-capped (free tier 50/mo to start), 30-day Redis cache.
- Provides **two viewing modes** — Pro (dense) and Present (narrative for client demos) — driven by a single component tree under a `mode` context. Export PDF is the third sibling.
- Lets users **toggle between three strategy-comparison layouts** (side-by-side, single-tab, smart-default) with a persisted per-user preference. Side-by-side is the default for the deep-evaluator anchor user.
- Replaces the existing `/analyzer` page in place on `feat/deal-analyzer`. No feature flag, no parallel route. Saved analyses load via a `migrateSnapshot()` shim.

The math itself does not change. `@propertyiq/analyzer-core` is extended additively (new optional fields on `RentalResult`, etc.) so the MCP `deal_analyzer` and `cashflow_estimate` tools' golden fixtures continue to pass byte-for-byte.

## 2. Goals & Non-Goals

### Goals

- Make the analyzer feel like the best deal calculator a serious investor has used. "WOW" measured by the deep-evaluator and agent-presenter anchor users — not by feature count.
- Cover Buy & Hold, Flip, and BRRRR strategies with first-class depth (top-10 questions per strategy, charted).
- Ground every AI annotation in real deterministic numbers, real comp data, and real market context. No generic "advice."
- Keep the analyzer-core math package authoritative, deterministic, sub-millisecond, and provider-agnostic.
- Establish a chart kit + visual system that future analyzer phases (Phase 2 strategy depth, Phase 3 PDF, Phase 4 advanced) extend without rework.
- Give admins per-purpose control over which AI model serves which slot (header verdict vs section annotations) without code changes.

### Non-Goals

- **No new MCP tools.** Existing `deal_analyzer` and `cashflow_estimate` continue to use the same `analyzer-core` API; new fields are additive.
- **No chat panel in Phase 1.** AI annotations are one-shot per section. The architecture leaves seams (`threadId`, `citedFacts`) so a Phase 4 chat panel drops in without rework.
- **No comp-adjustability UI.** Sales/rental comps render as a list and on a Mapbox map; users cannot override individual comps yet (Phase 4).
- **No portfolio rollup or saved-deals comparison.** Single-deal analyzer only (Phase 3).
- **No mobile-only route.** Sequential scroll, full-fidelity collapse on mobile — no separate `/m` URL.
- **No new entitlement tier.** Pro tier already exists and gates RentCast + AI verdict + save/share, same as today.
- **No Chrome extension.** Deferred indefinitely; original spec's deferral stands.
- **No streaming for section annotations.** Header streams (multi-second AI generation worth showing live); sections are one-shot text.

## 3. Scope

| In scope                                                                                       | Out of scope                                                                         |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| RentCast API client (`packages/backend/src/rentcast/`)                                         | RentCast MCP tool exposure                                                           |
| `AiInsightsService` with grounded prompts and Redis caching                                    | Persistent AI conversation history                                                   |
| Streaming extension on `AiProviderService`                                                     | New AI provider beyond existing four (DeepSeek/Anthropic/OpenAI/Google)              |
| New `/api/analyzer/property-lookup` and `/api/analyzer/ai-insights/{header,section}` endpoints | Refactor of `/api/analyzer/market-context` (stays as-is)                             |
| 15 chart components in `app/analyzer/components/charts/`                                       | New chart components for `/graphs` page                                              |
| New AnalyzerClient with hero, strategy-compare, accordion sections, input panel, mode toolbar  | Refactor of `/analyzer/saved/[id]` page (load via migrator only)                     |
| Saved-snapshot migrator                                                                        | Schema migration on `deal_analyses` table (additive only)                            |
| Mapbox map with comp pins inside `CompsSection`                                                | Custom Mapbox style; reuse existing                                                  |
| Per-metric tooltip system + `glossary.ts` (~30 entries)                                        | Standalone glossary page                                                             |
| Mode toggle (Pro/Present/PDF) via React context                                                | PDF rendering pipeline (Phase 3 — context flag exists, server-side render not built) |
| Heuristic input nudges (~15 functions)                                                         | AI-driven proactive nudges (Phase 4)                                                 |
| Strategy compare view picker (A/B/C) with persisted preference                                 | Strategy-comparison report exports                                                   |
| Background validation agents per CLAUDE.md §1.6                                                | Manual visual regression process (replaced by Playwright screenshots)                |

## 4. Architecture

### 4.1 Module map

```
packages/
  analyzer-core/                            [REUSED — extended additively]
    src/
      types.ts                              + add: ProjectionResult, SensitivityResult,
                                              BreakEvenResult, BrrrrTimelineResult,
                                              AfterTaxResult (all optional in *Result)
      compute-projection.ts        [NEW]    30-yr cashflow / equity / IRR projection
      compute-sensitivity.ts       [NEW]    tornado: ±10% on rate/rent/vacancy/taxes/ins/exit-cap
      compute-breakeven.ts         [NEW]    break-even rent + occupancy
      compute-brrrr-timeline.ts    [NEW]    phase durations: buy / rehab / lease / season / refi
      compute-after-tax.ts         [NEW]    depreciation + interest deduction, by year
      __tests__/                            fast-check property tests for all new functions

  backend/src/
    analyzer/                               [EXTEND]
      analyzer.controller.ts        + GET /property-lookup
                                    + GET /ai-insights/header (streaming)
                                    + GET /ai-insights/section?id=<sectionId>
      analyzer.service.ts           refactor: remove direct Anthropic SDK use;
                                    delegate AI calls to AiInsightsService
      ai-insights.service.ts [NEW]  prompt assembly · cache · AiProviderService delegation
      ai-insights.cache.ts   [NEW]  Redis wrapper with composite-hash key, 24h TTL
      prompts/
        section-prompts.ts   [NEW]  one prompt template per sectionId

    rentcast/                               [NEW]
      rentcast.module.ts
      rentcast.service.ts            client · monthly cap (Redis counter) · 30d cache
      rentcast.types.ts              DTOs

    ai-provider/                            [EXTEND]
      ai-provider.service.ts        + .stream(purpose, request) method
                                    using OpenAI-compatible streaming SDK

  frontend/
    app/analyzer/                           [BIG-BANG REPLACE]
      page.tsx                              server entry; reads searchParams, passes to client
      AnalyzerClient.tsx                    root client component; ModeContext provider
      components/
        Hero/
          Hero.tsx                          composite header
          GradeRing.tsx                     letter grade + score
          AIQuoteHeader.tsx                 streaming AI verdict
          KPIStrip.tsx                      4-tile container
          KPITile.tsx                       single tile w/ sparkline + delta + benchmark
        StrategyCompare/
          StrategyCompare.tsx               container w/ ViewPicker
          ViewPicker.tsx                    A/B/C segmented control, persists pref
          ThreeStrategyGrid.tsx             B view (default)
          SingleStrategyTab.tsx             A view
          WinnerPlusOthers.tsx              C view
          BestPlayCallout.tsx               "★ best play" banner; deterministic pick
        InputPanel/
          InputPanel.tsx                    container
          FetchPropertyDataButton.tsx       RentCast trigger; Pro-gated
          NumField.tsx                      typed integer input w/ RentCast badge
          SliderField.tsx                   slider w/ live $ readout
          Nudge.tsx                         green/amber inline message
          RentCastBadge.tsx                 🟢 / 🟡 / ⚪ status
        sections/                           one per accordion section
          SectionWrapper.tsx                accordion shell + AI annotation slot + ↻ icon
          ProjectionSection.tsx
          ExpenseSection.tsx
          SensitivitySection.tsx
          CompsSection.tsx                  includes Mapbox map
          MarketContextSection.tsx
          NotesSection.tsx
          AfterTaxSection.tsx               (B&H only — power-user, collapsed by default)
        charts/
          chart-tokens.ts                   color/spacing constants from CSS vars
          D3Tooltip.tsx                     shared D3 hover tooltip
          MultiLineChart.tsx                Recharts
          BarByYearChart.tsx                Recharts
          StackedAreaChart.tsx              Recharts
          ComposedSensitivityChart.tsx      Recharts
          BulletBarChart.tsx                Recharts
          StackedBarYearChart.tsx           Recharts
          WaterfallChart.tsx                D3
          GaugeChart.tsx                    D3 (radial + horizontal)
          TornadoChart.tsx                  D3
          BrrrrTimelineChart.tsx            D3 + framer-motion (★ delight piece)
          DistributionViolinChart.tsx       D3
          ScoreRingChart.tsx                D3 (extends app/components/scoring/ScoreRing)
        cards/
          ComparisonCard.tsx                CSS only
          MaoScaleCard.tsx                  D3 horizontal scale embedded
          PrePostBarCard.tsx                CSS only
        ai/
          AIAnnotation.tsx                  per-section AI text + stale state + ↻ icon
          RefreshAllInsights.tsx            global button at top of accordion
        chrome/
          ModeToolbar.tsx                   ⚡Pro / 📊Present / 🖨PDF + ⌘P / ⌘E shortcuts
          MetricTooltip.tsx                 educational tooltip wrapper
        lib/
          glossary.ts                       ~30 metric definitions
          mode-context.tsx                  React context: 'pro' | 'present' | 'pdf'
          nudges.ts                         ~15 heuristic functions
          migrate-snapshot.ts               saved-snapshot version migrator

    lib/data/
      fetchers/
        property-lookup.ts            [NEW] RentCast wrapper
        ai-insights.ts                [NEW] section-keyed AI fetch
        ai-insights-stream.ts         [NEW] header AI streaming fetch
        analyzer-projection.ts        [NEW] 30-yr projection fetch
      hooks/
        usePropertyLookup.ts          [NEW] React Query, manual trigger, 24h staletime
        useAiHeaderVerdict.ts         [NEW] streaming, refetches 1.5s after settle
        useAiSectionAnnotation.ts     [NEW] manual refresh per section
      index.ts                              + export all new fetchers/hooks
```

### 4.2 Reused infrastructure

| Component                                     | Path                               | Why                                                                                                           |
| --------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `MetricResolutionService`                     | `backend/src/metric-resolution/`   | Drives `useMarketContext`; PIQ + 4 market metrics with fallback chain (CLAUDE.md §5.1)                        |
| `AiProviderService`                           | `backend/src/ai-provider/`         | Multi-provider AI; per-purpose DB config; DeepSeek default; **extended with `.stream()` method** in this work |
| `ai-usage-logger.ts`                          | `backend/src/ai-provider/`         | Per-call cost/token tracking; admin dashboard at `/admin/ai-usage` already surfaces it                        |
| `M3Card` + `CustomTooltip` + `ChartTypePills` | `frontend/app/graphs/components/`  | Shared chart chrome — visual coherence with `/graphs` page                                                    |
| `ScoreRing` pattern                           | `frontend/app/components/scoring/` | Existing radial score visualization; `ScoreRingChart` extends it for BRRRR                                    |
| `EntitlementsContext` + `useEntitlements()`   | `frontend/lib/entitlements/`       | Pro gating                                                                                                    |
| `Mapbox GL + react-map-gl`                    | already in deps                    | Comps map                                                                                                     |
| `framer-motion`                               | already in deps                    | Chart entrance animations                                                                                     |
| `recharts` 2.15 + `d3` v7                     | already in deps                    | Chart libraries                                                                                               |
| `geography_crosswalk` table                   | Supabase                           | Parent geography resolution for PIQ context                                                                   |
| `propertyiq_scores` table                     | Supabase                           | PIQ score lookup for AI grounding                                                                             |

### 4.3 Data flow on a fresh analysis

```
1. User picks address (Mapbox autocomplete)

2. useMarketContext fires
   ↓
   GET /api/analyzer/market-context  (existing endpoint)
   ↓
   MetricResolutionService → PIQ score, market heat, rent index, net migration

3. User clicks "Fetch property data" (Pro-only button)
   ↓
   usePropertyLookup fires
   ↓
   GET /api/analyzer/property-lookup?address=...
   ↓
   RentcastService:
     a. Redis cache check sha1(normalized-address) → hit returns
     b. Monthly counter `rentcast:usage:<YYYY-MM>` < RENTCAST_MONTHLY_CAP
     c. Parallel: GET /properties, /avm/value, /avm/rent/long-term
     d. Cache 30d
     e. Return PropertyLookupDto

4. Frontend prefills Price (AVM), Rent (rent estimate), Tax (assessor)
   Fields show 🟢 RentCast badges
   Heuristic nudges fire (e.g., tax > county_median × 1.5 → amber)

5. analyzer-core computes locally (sub-ms, deterministic):
   - computeRentalMetrics, computeFlipMetrics, computeBrrrrScore (existing)
   - computeProjection, computeSensitivity, computeBreakEven,
     computeBrrrrTimeline, computeAfterTax (NEW)

6. AI INSIGHTS PIPELINE (parallel, section-keyed):
   - Header verdict: useAiHeaderVerdict streams from
     GET /api/analyzer/ai-insights/header
   - Each visible section: useAiSectionAnnotation fetches
     GET /api/analyzer/ai-insights/section?id=<sectionId>
   - AiInsightsService:
     a. Compose composite hash → Redis cache check
     b. On miss: assemble grounded prompt (input + result + RentCast + PIQ)
     c. AiProviderService.stream(purpose='analyzer_header_verdict', ...)
        OR AiProviderService.complete(purpose='analyzer_section_annotation', ...)
     d. Cache result 24h
     e. Return { text, threadId, citedFacts, cacheHit }

7. User edits any input
   ↓
   50ms debounce → analyzer-core recomputes → all charts morph
   Heuristic nudges re-fire
   AI annotations VISUALLY stale-mark (faded text + ↻ icon)
   Header AI quote refetches 1.5s after settle (cache often hits via rounded inputs)
   Section annotations stay until user clicks ↻ or "Refresh all insights"
```

### 4.4 Cost model (per Pro-user analysis)

| Hit                                                | Cost                                                  |
| -------------------------------------------------- | ----------------------------------------------------- |
| Mapbox geocode (existing)                          | ~$0.0005                                              |
| `useMarketContext` (existing)                      | $0 (DB only)                                          |
| RentCast 3 calls (first time per address)          | $0.15 (free-tier overage) or $0.045 (Foundation tier) |
| RentCast on revisit within 30d                     | $0 (cache hit)                                        |
| AI header verdict (DeepSeek default)               | ~$0.001 streaming                                     |
| AI section annotations × 6-7 (DeepSeek default)    | ~$0.002 first-time                                    |
| Header refetch on edit-settle (cache hit majority) | ~$0.0001 effective                                    |
| Section annotation refresh (user-clicked ↻)        | ~$0.0003 each                                         |
| **Marginal first-time analysis cost**              | **~$0.155** (RentCast dominates)                      |
| **Marginal revisit / heavy-edit session**          | **~$0.005** (cache + heuristics dominate)             |

DeepSeek is ~10–13× cheaper than Claude Sonnet. RentCast tier upgrade ($74/mo Foundation = 1000 calls = $0.06/call effective) is the next cost lever as Pro adoption grows.

## 5. analyzer-core Extensions (Public Interface)

All extensions are **additive optional fields**. Existing types stay backward-compatible — MCP golden fixtures continue to pass.

```ts
// Extended in packages/analyzer-core/src/types.ts

export interface ProjectionResult {
  yearly: Array<{
    year: number; // 1..30
    grossRent: number;
    expenses: number;
    cashflow: number;
    principalPaydown: number;
    appreciationGain: number;
    cumulativeEquity: number;
    cumulativeCashflow: number;
    irrToDate: number; // annualized
    coCToDate: number;
  }>;
  horizons: {
    y1: { equity: number; irr: number; cashflow: number };
    y3: { equity: number; irr: number; cashflow: number };
    y5: { equity: number; irr: number; cashflow: number };
    y10: { equity: number; irr: number; cashflow: number };
    y20: { equity: number; irr: number; cashflow: number };
    y30: { equity: number; irr: number; cashflow: number };
  };
}

export interface SensitivityResult {
  baseIRR: number;
  factors: Array<{
    name: "rate" | "rent" | "vacancy" | "taxes" | "insurance" | "exitCap";
    irrAtMinus10pct: number;
    irrAtPlus10pct: number;
    impactMagnitude: number; // for sorting tornado
  }>;
}

export interface BreakEvenResult {
  rentMonthly: number; // minimum rent for cashflow ≥ 0
  occupancy: number; // minimum occupancy % for cashflow ≥ 0
  rentCushionPct: number; // current rent vs break-even, as %
  occupancyCushionPct: number;
}

export interface BrrrrTimelineResult {
  phases: Array<{
    id: "buy" | "rehab" | "lease" | "season" | "refi" | "stabilized";
    label: string;
    monthStart: number;
    monthEnd: number | null; // null for the open-ended final phase
  }>;
  monthsToFirstRefi: number;
}

export interface AfterTaxResult {
  yearly: Array<{
    year: number;
    preTaxCashflow: number;
    depreciationDeduction: number; // building basis ÷ 27.5
    interestDeduction: number;
    estimatedTaxBenefit: number; // assumes user marginal rate (default 24%)
    afterTaxCashflow: number;
  }>;
}

// Existing RentalResult extended:
export interface RentalResult {
  // ... existing fields unchanged
  projection?: ProjectionResult; // NEW optional
  sensitivity?: SensitivityResult; // NEW optional
  breakEven?: BreakEvenResult; // NEW optional
  afterTax?: AfterTaxResult; // NEW optional
}

// Existing BrrrrResult extended:
export interface BrrrrResult {
  // ... existing fields unchanged
  timeline?: BrrrrTimelineResult; // NEW optional
  sensitivity?: SensitivityResult; // NEW optional
  postRefiProjection?: ProjectionResult; // NEW optional, starts at refi month
}

// New pure functions:
export function computeProjection(
  input: DealInput,
  opts?: {
    years?: number;
    appreciationPct?: number;
    rentGrowthPct?: number;
    expenseGrowthPct?: number;
  },
): ProjectionResult;
export function computeSensitivity(input: DealInput): SensitivityResult;
export function computeBreakEven(input: DealInput): BreakEvenResult;
export function computeBrrrrTimeline(
  input: BrrrrInput,
  opts?: {
    rehabMonths?: number;
    leaseMonths?: number;
    seasoningMonths?: number;
  },
): BrrrrTimelineResult;
export function computeAfterTax(
  input: DealInput,
  opts?: { marginalTaxRate?: number; landValuePct?: number },
): AfterTaxResult;
```

**Hard rules carried forward:**

- All functions are pure (no `Date.now()`, no `Math.random()`, no IO)
- All numeric returns are JS `number`
- `null` collapses dependent outputs (functions never throw on null inputs)
- Negative outputs are valid analyses
- Default assumption knobs documented in JSDoc on each function

## 6. Backend HTTP Interface

All endpoints prefixed `/api/analyzer`.

| Method | Path                                  | Auth | Body / Query                                                         | Returns             | Notes                                                                             |
| ------ | ------------------------------------- | ---- | -------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------- |
| `GET`  | `/property-lookup`                    | Pro  | `?address=`                                                          | `PropertyLookupDto` | RentCast orchestration; 30d Redis cache; monthly cap                              |
| `GET`  | `/ai-insights/header`                 | Pro  | `?payloadHash=` (cache key derived server-side from latest analysis) | `text/event-stream` | Streaming via extended `AiProviderService.stream()`                               |
| `GET`  | `/ai-insights/section?id=<sectionId>` | Pro  | same `payloadHash`                                                   | `AIAnnotationDto`   | One-shot; cached by composite hash                                                |
| `GET`  | `/market-context`                     | none | (existing)                                                           | (existing)          | Unchanged                                                                         |
| `POST` | `/save`                               | Pro  | (existing)                                                           | (existing)          | Unchanged; `result_snapshot` may include new optional fields                      |
| `GET`  | `/saved/:id`                          | auth | (existing)                                                           | (existing)          | Unchanged; new renderer applies migrator                                          |
| `POST` | `/ai-verdict`                         | Pro  | (existing)                                                           | (existing)          | **Refactored** to delegate to `AiInsightsService` instead of direct Anthropic SDK |

DTOs use `class-validator` per CLAUDE.md §1.2. No `as any`, no default-fallback for any secret. `RENTCAST_API_KEY`, `RENTCAST_API_KEY_HEADER` (default `X-Api-Key`), and `RENTCAST_MONTHLY_CAP` (default 45) added to env config; backend crashes at boot if `RENTCAST_API_KEY` missing.

## 7. UI System

### 7.1 Page anatomy (desktop ≥900px)

Two-column layout, 62% / 38% split. Left column scrolls; right column (input panel) is sticky on desktop.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ AddressBar                                          ⚡Pro 📊Present 🖨PDF │  ◀ ModeToolbar
├──────────────────────────────────────────────────────┬───────────────────┤
│  HERO (sticky)                                       │                   │
│   [GradeRing] [AIQuoteHeader (streaming)]            │   INPUT PANEL     │
│   [KPITile × 4] each with sparkline + delta + bench  │   (D hybrid)      │
│                                                      │                   │
│  STRATEGY COMPARE (default B side-by-side)           │   📡 Fetch        │
│   ViewPicker [⊞ A B C]                              │   property data   │
│   ThreeStrategyGrid: B&H | Flip | BRRRR              │                   │
│   BestPlayCallout                                    │   Price 🟢        │
│                                                      │   Rent /mo 🟢     │
│  ▼ ProjectionSection           [↻ AI annotation]     │   Tax /yr 🟡 ⚠   │
│  ▼ ExpenseSection              [↻ AI annotation]     │   Insurance       │
│  ▼ CompsSection (Mapbox map)   [↻ AI annotation]     │   HOA             │
│  ▼ SensitivitySection          [↻ AI annotation]     │   ───────         │
│  ▶ MarketContextSection        [↻ AI annotation]     │   Down ━●━━ 20%  │
│  ▶ AfterTaxSection (B&H only)  [↻ AI annotation]     │   Rate ━━●━ 7.1% │
│  ▶ NotesSection                                      │   Term ━━━●  30y │
│                                                      │                   │
└──────────────────────────────────────────────────────┴───────────────────┘
```

### 7.2 Hero composition

| Element                    | Component                  | Notes                                                                       |
| -------------------------- | -------------------------- | --------------------------------------------------------------------------- |
| Letter grade + score       | `GradeRing`                | Same letter scale as PropertyIQ score: A+/A/A−/B+/B/B−/C+/C/C−/F            |
| 1–2 sentence AI verdict    | `AIQuoteHeader`            | Streams via `useAiHeaderVerdict`; refetches 1.5s after settle; serif italic |
| 4 KPI tiles                | `KPIStrip` → `KPITile` × 4 | **Cap · Cashflow · IRR(10y) · DSCR**                                        |
| Per-tile sparkline         | recharts `<Line>` no axes  | 30y data; `chart-tokens.ts` colors                                          |
| Per-tile delta + benchmark | text under value           | "▲ 1.2 vs metro avg" or "comfortable"                                       |

### 7.3 Strategy compare zone

| View               | Default                                | Component           | Description                                                            |
| ------------------ | -------------------------------------- | ------------------- | ---------------------------------------------------------------------- |
| **B side-by-side** | YES                                    | `ThreeStrategyGrid` | All 3 strategies render; "★ best play" callout from deterministic pick |
| A tabs             | user-selectable                        | `SingleStrategyTab` | Original tab pattern; less density                                     |
| C smart-default    | user-selectable / Present-mode default | `WinnerPlusOthers`  | Winner expanded; others collapsed                                      |

`ViewPicker` is a segmented control in the section header; preference persists to `localStorage` (anonymous) or DB (logged in). Present mode flips the default to C unless user has explicitly picked.

### 7.4 Input panel (D hybrid + live nudges)

| Field         | Input type             | RentCast badge | Heuristic nudge                                     |
| ------------- | ---------------------- | -------------- | --------------------------------------------------- |
| Price         | typed integer          | 🟢/🟡/⚪       | If outside RentCast AVM low–high range              |
| Rent /mo      | typed integer          | 🟢/🟡/⚪       | If outside RentCast rent comp 25–75 percentile      |
| Tax /yr       | typed integer          | 🟢/🟡/⚪       | If > county median × 1.5 (amber) or < × 0.5 (amber) |
| Insurance /yr | typed integer          | ⚪             | If > $5 per $1K of property value (amber)           |
| HOA /mo       | typed integer          | ⚪             | none                                                |
| Down %        | slider 0–50%           | n/a            | none                                                |
| Rate %        | slider 3–12% step 0.05 | n/a            | none                                                |
| Term yr       | slider 10–30 step 5    | n/a            | none                                                |

Three universal behaviors:

- **Live chart morphing.** Charts recompute via analyzer-core on every settled keystroke (50ms debounce + framer-motion easing).
- **RentCast field badges.** Three states: 🟢 RentCast (auto-filled, untouched) · 🟡 edited (user overrode RentCast) · ⚪ manual (no RentCast data, user typed). Badge tooltip: "from RentCast AVM, fetched 2 days ago".
- **Reset-to-fetched icon.** One-click revert any 🟡 field back to its RentCast value.

### 7.5 Mode mechanics

Single component tree, three renderings via `ModeContext`:

```tsx
type Mode = "pro" | "present" | "pdf";
const { mode } = useMode();
```

| Element                                 | Pro                                               | Present                                | PDF                                         |
| --------------------------------------- | ------------------------------------------------- | -------------------------------------- | ------------------------------------------- |
| Hero                                    | Full composite (grade + AI + 4 KPIs + sparklines) | Big grade + AI quote only              | Full + agent vanity name + watermark footer |
| Strategy zone                           | B side-by-side (3 cards)                          | C smart-default (winner only)          | C smart-default                             |
| Sections expanded                       | All 7                                             | Top 3 (Strategy · Projection · Comps)  | All 7 (paginated)                           |
| Tornado / sensitivity bands / after-tax | Inline                                            | Hidden                                 | Inline (appendix page)                      |
| Input panel                             | Visible, editable                                 | Collapsed (lock to unlock)             | Hidden                                      |
| Typography body                         | Roboto                                            | Roboto + Source Serif 4 headers        | Roboto + serif headers                      |
| Background                              | Surface `#FAFBFF`                                 | White + subtle gradient                | White                                       |
| Branding chrome                         | Standard PropertyIQ                               | Watermarked footer + agent vanity name | Brand cover page                            |

PDF rendering via `@media print` + a route-time `?mode=pdf` flag. Server-side Puppeteer generation is Phase 3 — the architecture is ready from Phase 1.

### 7.6 Mobile (<900px)

Sequential scroll, full fidelity:

1. AddressBar
2. ModeToolbar (icon-only)
3. **Inputs accordion** (collapsed by default)
4. Hero (no longer sticky)
5. Strategy compare — stacks 3 cards vertically (always B view; picker hidden)
6. All 7 sections — same content, all charts full-width
7. Floating "Edit inputs" FAB at bottom-right

Touch targets ≥44px. `framer-motion` `whileInView` defers chart entrance animations until scrolled into view to reduce initial render cost.

### 7.7 Educational layer

`MetricTooltip` wraps every metric label. Reads from `glossary.ts`:

```ts
export const GLOSSARY = {
  dscr: {
    name: "DSCR — Debt Service Coverage Ratio",
    formula: "NOI ÷ Annual Debt Service",
    plain:
      "How much rent covers your mortgage. Above 1.0 = rent pays the loan. Lenders typically want 1.20+.",
    whyMatters:
      "A DSCR below 1.0 means you cover the shortfall from your own pocket each month. Single biggest sustainability metric.",
  },
  // ~30 entries
};
```

Tooltip on hover; tap-to-expand on mobile. Labels marked with subtle dotted underline so users discover the affordance.

## 8. Chart Kit

### 8.1 The 15 components

| #   | Component                  | Library                                          | Used by (strategy / question #) |
| --- | -------------------------- | ------------------------------------------------ | ------------------------------- |
| 1   | `MultiLineChart`           | Recharts `LineChart`                             | B&H #1                          |
| 2   | `BarByYearChart`           | Recharts `BarChart`                              | B&H #3, Flip #7                 |
| 3   | `StackedAreaChart`         | Recharts `AreaChart` (stacked)                   | B&H #5, BRRRR #8                |
| 4   | `ComposedSensitivityChart` | Recharts `ComposedChart` (Area + Line)           | B&H #4                          |
| 5   | `BulletBarChart`           | Recharts horizontal `BarChart` + `ReferenceArea` | B&H #6                          |
| 6   | `StackedBarYearChart`      | Recharts `BarChart` (stacked)                    | B&H #10                         |
| 7   | `WaterfallChart`           | D3 (Recharts has no waterfall)                   | B&H #7, Flip #2, BRRRR #2       |
| 8   | `GaugeChart`               | D3 (radial + horizontal)                         | B&H #8, Flip #9, BRRRR #6       |
| 9   | `TornadoChart`             | D3                                               | B&H #9, BRRRR #9                |
| 10  | `BrrrrTimelineChart`       | D3 + framer-motion (★ delight piece)             | BRRRR #7                        |
| 11  | `DistributionViolinChart`  | D3                                               | B&H #2, Flip #4, Flip #8        |
| 12  | `ScoreRingChart`           | D3 (extends `app/components/scoring/ScoreRing`)  | BRRRR #1                        |
| 13  | `ComparisonCard`           | CSS only                                         | Flip #10, BRRRR #10             |
| 14  | `MaoScaleCard`             | CSS + embedded D3 scale                          | Flip #1                         |
| 15  | `PrePostBarCard`           | CSS only                                         | BRRRR #3                        |

**Total: ~17 Recharts uses + ~10 D3 uses + ~3 CSS cards across the 30 strategy questions.**

### 8.2 Shared infrastructure

Every chart wraps in:

```tsx
<M3Card title="..." tooltip={<MetricTooltip metric="..." />}>
  <ResponsiveContainer width="100%" height={CHART_HEIGHTS[viewport]}>
    <SomeChart data={...} />
  </ResponsiveContainer>
</M3Card>
```

`M3Card`, `CustomTooltip`, `ChartTypePills` all reused from `app/graphs/components/`. No new card chrome.

### 8.3 Color enforcement

`packages/frontend/app/analyzer/components/charts/chart-tokens.ts`:

```ts
export const CHART_TOKENS = {
  primary: "var(--md-primary)", // #3949AB
  positive: "var(--md-tertiary-positive)", // #00C853
  negative: "var(--md-error)", // #B3261E
  caution: "var(--md-warning)", // #FF8F00
  neutral: "var(--md-on-surface-variant)", // #5C6BC0
  gridline: "var(--md-outline-variant)",
  benchmark: {
    poor: "var(--md-error-container)",
    good: "var(--md-tertiary-container)",
    great: "var(--md-tertiary)",
  },
};
```

CSS variables resolve to PropertyIQ palette per CLAUDE.md §8.2. Dark-mode swap is automatic. No hex literals in any chart component.

### 8.4 Animation system (M3 motion)

| Trigger                                     | Motion                             | Duration                   | Where                                  |
| ------------------------------------------- | ---------------------------------- | -------------------------- | -------------------------------------- |
| First reveal of any chart on initial render | Fade + 8px rise                    | 400ms M3 standard ease     | Every chart card via `motion.div` wrap |
| Live recompute (input edit)                 | Recharts `isAnimationActive`       | 200ms M3 short ease        | All time-series charts (free)          |
| BRRRR Timeline phase reveal                 | Sequential dot fade-in along spine | 600ms total, 100ms stagger | `BrrrrTimelineChart` only              |

No bouncy springs, no parallax, no scroll-jacking. M3 motion spec strictly. `prefers-reduced-motion` disables entrance fades.

### 8.5 Responsive sizing

| Viewport           | Chart height                                               |
| ------------------ | ---------------------------------------------------------- |
| Desktop ≥1280px    | 280px                                                      |
| Desktop 900–1280px | 240px                                                      |
| Tablet 600–900px   | 220px (strategy compare → 2-col)                           |
| Mobile <600px      | 200px (strategy compare → vertical stack; sparklines 28px) |

`ResponsiveContainer` handles width. Heights via Tailwind responsive utilities on parent `<M3Card>`.

### 8.6 Tooltip & axis labeling

- Recharts: shared `CustomTooltip` with `formatMetricValue` from `@/lib/data` (no manual formatting; CLAUDE.md §6 enforcement)
- D3: shared `D3Tooltip` mirroring `CustomTooltip` visually, fed by D3 `pointer` event handlers
- Axis tick labels in `Roboto Mono` per CLAUDE.md §8.3
- All "$" via `formatValue(n, 'currency')` so $1,500,000 → `$1.5M`

## 9. AI Integration

### 9.1 Service architecture

```
AiInsightsService.complete(payload, sectionId):
  1. Compose composite hash
     sha1(roundedInputs(payload.input)
          + rentcastSnapshotHash(payload.rentcast.fetched_at)
          + piqSnapshotHash(payload.piq.fetched_at)
          + sectionId)
  2. AiInsightsCache.get(hash) → if hit, return cached result
  3. Assemble grounded prompt (see §9.2)
  4. AiProviderService.complete(purpose, request)
     OR .stream(purpose, request) for header
     - purpose='analyzer_header_verdict' (DB-routable, default DeepSeek)
     - purpose='analyzer_section_annotation' (DB-routable, default DeepSeek)
  5. Cache result 24h
  6. Return { text, threadId, citedFacts, cacheHit }
```

### 9.2 Prompt grounding (mandatory)

Every prompt includes all four context blocks. If RentCast data is missing (defensive — Pro flow guarantees presence), the prompt template explicitly instructs the AI to acknowledge the gap rather than invent numbers.

```
SYSTEM:
You are a precise, numerate real-estate analyst. Cite specific numbers from
the data provided. Never invent figures. Output 1-2 sentences max.

USER:
DEAL INPUT: {input}
COMPUTED METRICS: {analyzer-core results, deterministic}
PROPERTY DATA (RentCast, fetched Xd ago):
  - AVM: $... (range $...–$...)
  - Rent estimate: $...
  - Top 5 sales comps (relevance-ranked: distance + recency + bed/bath/sqft match)
  - Top 5 rental comps
MARKET CONTEXT (PropertyIQ):
  - PIQ Score / label
  - Market heat / rent index / net migration
TASK: {section-specific prompt}
```

Token budget: ~1.5–2.5K input, ~80–150 output. DeepSeek: ~$0.001 per call.

### 9.3 Section prompt templates

`packages/backend/src/analyzer/prompts/section-prompts.ts` — one entry per `sectionId`.

| `sectionId`         | Task prompt (paraphrased)                                             |
| ------------------- | --------------------------------------------------------------------- |
| `header_verdict`    | 1-2 sentence buy/negotiate/pass with strongest number + one risk      |
| `projection`        | 1 sentence on what drives the 30y wealth chart most                   |
| `expense_waterfall` | 1 sentence on what's eating rent; flag debt-service > 60%             |
| `sensitivity`       | Top 1-2 inputs the deal is most sensitive to + risk implication       |
| `comps`             | Compare price/sqft to comp distribution; flag negotiation opportunity |
| `market_context`    | Tailwind/headwind verdict citing PIQ + net migration                  |
| `after_tax`         | Highlight depreciation/interest-deduction value as % of return        |

### 9.4 Caching & staleness mechanic

| Component           | Refetch behavior                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header AI quote     | Streams; refetches 1.5s after settle. Cache-keyed on rounded inputs (price→$1K, rent→$25, tax→$100) so most settles hit cache.                                                  |
| Section annotations | One-shot on first render. On input change, visually stale-mark (50% opacity + ↻ icon). User clicks ↻ to refresh that one, or "Refresh all insights" button at top of accordion. |

### 9.5 Heuristic nudges (no AI)

`packages/frontend/app/analyzer/lib/nudges.ts` — ~15 pure functions. Pattern:

```ts
export function nudgeForTax(value, rentcastRecord, countyMedian) {
  if (countyMedian && value > countyMedian * 1.5) {
    return {
      level: "warn",
      text: `${pct(value / countyMedian - 1)} above county average — verify with assessor`,
    };
  }
  // ... other branches
  return null;
}
```

Fired on every keystroke without budget concern. Unit-tested for boundary values.

### 9.6 Hooks for future Phase 4 chat panel

`AiInsightsService.complete()` returns `{ text, threadId, citedFacts, cacheHit }`. The `threadId` lets a future `useAiChat(sectionId)` hook seed a conversation from the section annotation as the first turn — no migration required at that time.

### 9.7 Cost monitoring

`ai-usage-logger.ts` (existing) captures per-call `{ purpose, provider, model, input_tokens, output_tokens, cost_estimate, user_id, cache_hit }` to Supabase. `/admin/ai-usage` already surfaces this.

Optional `RENTCAST_MONTHLY_CAP`-style env var per AI purpose if anyone routes to Claude and wants a soft ceiling. Off by default for DeepSeek.

## 10. RentCast Integration

### 10.1 Service

`packages/backend/src/rentcast/rentcast.service.ts`:

- Methods: `getPropertyRecord(address)`, `getValueEstimate(address)`, `getRentEstimate(address)`
- Auth: API key via `RENTCAST_API_KEY_HEADER` env (default `X-Api-Key`); secret in `RENTCAST_API_KEY` env (no fallback per CLAUDE.md §1.2)
- Cache: Redis key `rentcast:<endpoint>:<sha1(normalizedAddress)>` TTL 30 days
- Monthly cap: Redis counter `rentcast:usage:<YYYY-MM>` increments on real API calls (not cache hits); throws typed `RentcastQuotaExceededError` at `RENTCAST_MONTHLY_CAP` (default 45 = 5-call buffer below 50 free-tier ceiling)
- Soft warn at 80% via structured log

### 10.2 Endpoint orchestration

`GET /api/analyzer/property-lookup` parallel-fires 3 RentCast calls, consolidates into `PropertyLookupDto`:

```ts
class PropertyLookupDto {
  avm: { value: number; low: number; high: number; comps_count: number } | null;
  rent: { value: number; low: number; high: number; comps_count: number } | null;
  property_record: { beds: number; baths: number; sqft: number; year_built: number; tax_assessment: number; ... } | null;
  sales_comps: ComparableDto[];
  rental_comps: ComparableDto[];
  cache_age_days: number;
  source: 'rentcast';
}
```

Per-field nullability: any one of the 3 RentCast calls failing degrades that section to `null`, never throws.

## 11. Mode-Switching & Routing

### 11.1 Single component tree

```tsx
<ModeProvider initial="pro">
  <AnalyzerClient>
    <ModeToolbar /> {/* ⚡Pro 📊Present 🖨PDF + ⌘P / ⌘E */}
    <Hero />
    <StrategyCompare />
    <SectionsAccordion />
  </AnalyzerClient>
</ModeProvider>
```

Components consume `useMode()` and conditionally render. Pro/Present share data; PDF triggers print stylesheet + `?mode=pdf` query.

### 11.2 URL strategy

- `/analyzer` — main analyzer; single route for all 3 modes (mode is React state, not URL)
- `/analyzer?address=...&zip=...&piq_market=...` — deep-link, unchanged from existing
- `/analyzer/saved/[id]` — saved analysis loader (uses `migrateSnapshot()` for back-compat)
- `/shared/analysis/[token]` — public read-only (Phase 3 polish; structure unchanged in Phase 1)
- `/analyzer/print/[id]` — PDF render route, server-side Puppeteer (Phase 3)

## 12. Saved-Snapshot Migration

`packages/frontend/app/analyzer/lib/migrate-snapshot.ts`:

```ts
export function migrateSnapshot(raw: unknown): AnalyzerInputState {
  // Idempotent. Detects shape via duck-typing.
  // Known shapes:
  //   - v1 (current /analyzer): price/rent/tax/insurance/HOA + financing
  //   - v0 (pre-deal-analyzer): older PropertyIQ analysis snapshots
  //   - v0-anonymous: anonymous-tier saves (different shape)
  // Returns the latest AnalyzerInputState shape always.
  // Fills new fields with `undefined` (not 0), preserving user intent.
}
```

Runs at load time on `/analyzer/saved/[id]`. Unit-tested with golden fixtures of all known shapes.

## 13. Build & Rollout (Big-Bang per Q10)

Branch: `feat/deal-analyzer` (existing). Six implementation phases internal to this Phase 1 work:

| Phase                     | Scope                                                                                                                                                                                                                 | Deploy gate                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **1A — Foundation**       | analyzer-core extensions (projection, sensitivity, break-even, timeline, after-tax) · RentcastService · AiProviderService streaming extension                                                                         | Unit tests green; no UI deploy yet                                                                     |
| **1B — Backend services** | AiInsightsService · `/api/analyzer/property-lookup` · `/api/analyzer/ai-insights/{header,section}` · saved-snapshot migrator backend-side · refactor existing `streamAiVerdict` to use AiProviderService              | Backend e2e green; new endpoints deploy live but dormant (no UI consumes them yet) until 1E wires them |
| **1C — Chart kit**        | All 15 chart components (Recharts + D3 + CSS cards) · `chart-tokens.ts` · `D3Tooltip` · framer-motion entrance                                                                                                        | Unit tests green; visual regression baselines captured                                                 |
| **1D — UI shell**         | New `AnalyzerClient` · `Hero` · `StrategyCompare` · `InputPanel` (D hybrid + nudges) · `ModeToolbar` · 7 section components · `MetricTooltip` · `glossary.ts`                                                         | Renders with mocked data; manual render check per `[[feedback_verify-after-every-task]]`               |
| **1E — Wire-up**          | Replace old `/analyzer` page · wire fetchers · saved-snapshot migrator on load · mobile breakpoints · accordion state persistence                                                                                     | Full E2E suite green; visual regression diff reviewed                                                  |
| **1F — Verification**     | Background `code-reviewer` + `data-layer-reviewer` + `security-reviewer` + `file-size-compliance` agents per CLAUDE.md §1.6 · production smoke test on staging · render check per `[[feedback_server-health-checks]]` | All gates green; merge to develop                                                                      |

Each phase is its own commit boundary. No "in-progress" merges to main.

## 14. Testing Strategy

| Layer                              | Tool                                        | Files                                                                   | What                                                                                                                                                          |
| ---------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit — analyzer-core extensions    | Vitest + fast-check                         | `packages/analyzer-core/src/**/*.test.ts`                               | Property-based tests for new computations; invariants (monotonic equity, MAO < ARV, etc.)                                                                     |
| Unit — RentcastService             | Jest                                        | `packages/backend/src/rentcast/**/*.spec.ts`                            | Cache hit skips fetch · monthly cap throws · malformed response → nulls · address normalization stable                                                        |
| Unit — AiInsightsService           | Jest                                        | `packages/backend/src/analyzer/__tests__/ai-insights.service.spec.ts`   | Prompt assembly (all 4 context blocks) · cache-key correctness · DeepSeek fallback when DB row missing · streams via Path-A AiProviderService.stream()        |
| Unit — AiProviderService streaming | Jest                                        | `packages/backend/src/ai-provider/__tests__/streaming.spec.ts`          | `.stream()` method works for all 4 providers · cancellation · error handling                                                                                  |
| Unit — heuristic nudges            | Vitest                                      | `packages/frontend/app/analyzer/lib/__tests__/nudges.test.ts`           | All ~15 functions: amber/green/null at boundary inputs                                                                                                        |
| Unit — chart components            | Vitest + RTL                                | `packages/frontend/app/analyzer/components/charts/__tests__/`           | Each of 15 renders with sample fixtures · snapshot D3 SVG paths · Recharts elements present                                                                   |
| Unit — saved-snapshot migrator     | Vitest                                      | `packages/frontend/app/analyzer/lib/__tests__/migrate-snapshot.test.ts` | Idempotent · all known old shapes load                                                                                                                        |
| Integration — backend e2e          | Jest + real Supabase + mocked RentCast HTTP | `packages/backend/test/analyzer.e2e-spec.ts`                            | Pro auth · cache hit/miss · monthly cap → 429 · saved analyses round-trip with new fields                                                                     |
| E2E — frontend                     | Playwright                                  | `packages/frontend/tests/e2e/analyzer.spec.ts`                          | All current scenarios + new ones: RentCast fetch · mode toggle · live morphing · stale-mark · ↻ refresh · saved snapshot loads via migrator · mobile collapse |
| Visual regression                  | Playwright screenshots                      | new `tests/visual/` dir                                                 | Each chart × 3 viewports · hero in 3 modes · BRRRR timeline mid-animation                                                                                     |

## 15. Risks & Mitigations

| Risk                                                                                    | Severity | Mitigation                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Big-bang regression breaks Pro user mid-analysis                                        | High     | Saved-snapshot migrator with golden tests; expanded Playwright covering all current flows; deploy off-hours                                                                                                  |
| AiProviderService streaming extension delays whole project                              | Medium   | Build first as Phase 1A (½ day); fall back to Path C (skeleton + non-streaming) if it slips                                                                                                                  |
| RentCast 50/mo cap exhausts in week 1                                                   | Medium   | Hard monthly cap with 429 + clear UI; soft warn at 80%; admin upgrades tier without code change                                                                                                              |
| Saved snapshot from anonymous-tier user (today) doesn't match Pro-only RentCast prefill | Low      | Migrator preserves manually-entered values; RentCast section shows "no comp data — fetch to populate" affordance                                                                                             |
| Charts feel laggy on mid-tier devices when sliding                                      | Medium   | 50ms input debounce; analyzer-core sub-ms; Recharts native animation optimized; drop entrance fade on `prefers-reduced-motion` if real testing shows jank                                                    |
| AI annotation hallucination                                                             | Medium   | Prompts grounded in deterministic results + RentCast + PIQ; system prompt explicitly forbids inventing figures; admin can route header to Claude if DeepSeek hallucinates more                               |
| Mobile UX collapses badly with 30 charts                                                | Medium   | `framer-motion` `whileInView` defers chart entrance until scrolled into view                                                                                                                                 |
| MetricResolutionService rate-limits at peak                                             | Low      | Existing 2h React Query cache; existing geography chain LRU cache                                                                                                                                            |
| Analyzer-core type extensions break MCP golden fixtures                                 | High     | Extend types additively (new optional fields); MCP golden fixture spec at `packages/mcp-server/src/tools/__tests__/investors.golden.spec.ts` enforces parity per `[[feedback_mcp-refactors-must-not-break]]` |

## 16. Acceptance Criteria

A reasonable senior reviewer should be able to walk through this list and check each box:

- [ ] Pro user picks a US address → `Fetch property data` button fetches RentCast → AVM, sales comps, rental comps render in their tiles within 2s
- [ ] Header shows D composite (grade + AI quote streaming + 4 KPI tiles with sparklines)
- [ ] AI quote uses DeepSeek by default; admin can route `analyzer_header_verdict` to Claude via `ai_model_config` table without code change
- [ ] All AI calls include RentCast comps + PIQ context (verifiable in `ai-usage-logger` payload)
- [ ] Strategy compare defaults to side-by-side (B); user toggles A/C via segmented control; preference persists per-user
- [ ] All 7 accordion sections render; top 3 expanded by default; user can expand/collapse
- [ ] Each section's AI annotation visually stale-marks on input change; ↻ icon refetches that one
- [ ] Header AI quote refetches 1.5s after settle; old text fades to new via stream
- [ ] Sliders for financing morph all charts in real-time (jank-free at 50ms debounce)
- [ ] Heuristic nudges fire correctly for tax / rent / rate edge cases (amber/green badges)
- [ ] All 30 chart positions render with realistic data; visual regression diff matches golden
- [ ] BRRRR timeline reveals with sequential dot animation on first scroll-into-view
- [ ] Mode toggle Pro ↔ Present visibly changes layout (sections, typography, KPI strip)
- [ ] **Phase 1 only:** Mode toggle "🖨 PDF" applies the `@media print` stylesheet correctly (browser print-preview shows hero + all expanded sections, no input panel, watermark footer). Server-side Puppeteer rendering pipeline is Phase 3 scope
- [ ] Mobile (<900px): inputs collapse to top accordion, strategy stacks vertically, all charts full-width, FAB scrolls to inputs
- [ ] Hovering any metric label shows `MetricTooltip` with plain-English + formula + why-it-matters from `glossary.ts`
- [ ] Existing saved analyses load via `migrateSnapshot()` without errors; user can re-edit and save
- [ ] Existing MCP `deal_analyzer` and `cashflow_estimate` golden fixtures still pass byte-for-byte
- [ ] Backend e2e against real Supabase test schema green in CI
- [ ] Playwright e2e green in CI (all existing scenarios + new ones for: RentCast fetch, mode toggle, live morphing, stale-mark/refresh, saved snapshot loads via migrator, mobile collapse)
- [ ] Background validation agents (code-reviewer, data-layer-reviewer, security-reviewer, file-size-compliance) per CLAUDE.md §1.6 report no CRITICAL/WARNING issues
- [ ] No file in new code exceeds CLAUDE.md §1.3 hard limits

## 17. Open Items Handed to Implementation Plan

These tactical questions surface during implementation, not at design time:

1. Exact DB schema additions (if any) for AI annotation persistence — depends on whether server-side eviction triggers vs client-only stale-marking
2. Specific Mapbox map style / pin design for comps — visual question; defer to implementation
3. Glossary content — the ~30 metric definitions need writing; defer to a content editor pass
4. Per-purpose model defaults in DB seed migration — initial values for `ai_model_config` rows
5. Visual regression golden image set — captured during 1C implementation, not pre-design

## 18. References

- Original deal-analyzer spec: [2026-05-14-deal-analyzer-design.md](./2026-05-14-deal-analyzer-design.md)
- Brainstorm session artifacts: `.superpowers/brainstorm/10983-1778805693/content/`
- Existing analyzer code:
  - `packages/frontend/app/analyzer/`
  - `packages/backend/src/analyzer/`
  - `packages/analyzer-core/`
  - `packages/backend/src/ai-provider/`
- Existing charting reference: `packages/frontend/app/graphs/components/`
- Existing M3 patterns: `packages/frontend/app/graphs/components/M3Card.tsx`, `app/tour/components/charts/`
- Project memory: `[[project_deal-analyzer]]`, `[[project_paperclip-agent]]`
- Memory feedback: `[[feedback_mcp-refactors-must-not-break]]`, `[[feedback_verify-after-every-task]]`, `[[feedback_server-health-checks]]`, `[[feedback_check-untracked-before-push]]`, `[[feedback_use-frontend-design-skill]]`, `[[feedback_dont-ask-to-continue]]`
- CLAUDE.md sections: §1.2 (security), §1.3 (file size), §1.6 (background agents), §5 (data layer), §5.1 (MetricResolutionService), §6 (metric config), §8 (M3 brand), §9 (score & confidence)
- RentCast API docs: https://developers.rentcast.io/reference/introduction
