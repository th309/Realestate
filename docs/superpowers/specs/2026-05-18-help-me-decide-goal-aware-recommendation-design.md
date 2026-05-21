# "Help Me Decide" — Goal-Aware Strategy Recommendation

**Date**: 2026-05-18
**Status**: Design
**Surface**: `/analyzer` compare mode (existing UI label: "Help me decide")

## Background

The analyzer's `compare` mode already grades all three strategies (Buy & Hold,
Fix & Flip, BRRRR) against the user's deal inputs and surfaces a winning
"Best Play" via `pickBestPlay()` (`BestPlayCallout.tsx:19-23`). Today that
function is a hardcoded oracle:

```
if (brrrr.score >= 80 && brrrr.postRefiCashflow > 0) → BRRRR
if (flip.roiPct >= 20 && flip.profit >= $30k) → Fix & Flip
else → Buy & Hold
```

This doesn't reflect what the user actually wants from the deal. A property
that grades B+ for Buy & Hold and A for Fix & Flip is the F&F winner under
the current rule, even when the user's goal is monthly cash flow — for that
goal, the B+ B&H is the right answer.

Real deals frequently work as one strategy and not another (the user
acknowledged this as the _whole point_ of "Help me decide"):

| Deal type                         | B&H             | F&F           | BRRRR               |
| --------------------------------- | --------------- | ------------- | ------------------- |
| Stabilized rental at market       | **A/B**         | F (no margin) | F (nothing to refi) |
| Distressed in cash-flow market    | C               | D/F           | **A**               |
| Tired house in hot market         | D               | **A**         | C (trapped equity)  |
| Coastal duplex, appreciation play | F (by cashflow) | B             | F                   |

The recommendation needs a goal axis to be honest.

## Goals

1. Let the user pick one of **4 investment goals**: Cash flow, Long-term
   wealth, Fast cash, Recycle capital.
2. Use the goal to re-rank strategies via per-goal scoring functions.
3. Reframe the AI recommendation narrative around the chosen goal.
4. Pre-select the goal that best fits the deal so first-load shows a
   meaningful recommendation.

## Non-goals

- **No changes to focused mode** (single-strategy view). Goal selection is
  compare-mode-only.
- **No changes to grading thresholds.** Conservative/Balanced/Aggressive
  presets remain orthogonal to goal selection. Grades are still computed
  the same way; only the **winner pick** and **narrative framing** change.
- **No re-ordering of the 3-up strategy grid.** The grid stays in fixed
  `[B&H, F&F, BRRRR]` order. The Best Play callout indicates which strategy
  is the recommendation.
- **No goal-specific metric tiles** in strategy cards. Each card keeps its
  strategy-native KPIs (cap rate for B&H, ROI for F&F, BRRRR score for BRRRR).
- **No new database tables.** Goal selection is client-side state +
  localStorage.

## User experience

1. User toggles to "Help me decide" mode (existing label for `analysisMode ===
"compare"` at `StrategyControls.tsx:16-31`).
2. A row of 4 chips appears above the Best Play callout: **Cash flow**,
   **Long-term wealth**, **Fast cash**, **Recycle capital**.
3. On first render with a gradable deal: the system computes goal-fit scores
   for the deal and pre-selects the goal whose top-strategy score is highest.
   ("This deal's best play is best understood as a `<goal>` play.")
4. User can switch goals by clicking another chip. Selection persists to
   localStorage (`analyzer.investorGoal`) for the next session.
5. Each chip-switch:
   - Recomputes `bestPlay` via the goal-aware scoring function.
   - Updates the Best Play callout (winner, hero metric, tagline).
   - Invalidates the AI `recommendation_analysis` cache key (goal is part
     of the cache key) and triggers a fresh narrative fetch framed around
     the goal.

## Architecture

### Data flow

```
User selects goal in GoalPicker
       │
       ├──► AnalyzerClient: setSelectedGoal(g)
       │     │
       │     ├──► localStorage.setItem("analyzer.investorGoal", g)
       │     │
       │     ├──► pickBestPlayForGoal(results, goal)  →  Strategy
       │     │     (replaces today's pickBestPlay call; `results` is the
       │     │      same { rental, flip, brrrr, projection } bundle used
       │     │      by the current pickBestPlay())
       │     │
       │     └──► useSectionAiInsights({ ..., goal })
       │           │
       │           ├──► AiInsightPayload now includes `goal: InvestorGoal | null`
       │           └──► Backend cache key includes goal so each goal gets
       │                 its own cached narrative per (input, result, piq) tuple
       │
       └──► StrategyCompare re-renders with new winner + new narrative
```

### Components

**New:**

- `app/analyzer/lib/goal-types.ts` — `InvestorGoal` union type, label map,
  short descriptions for tooltip copy.
- `app/analyzer/lib/goal-scoring.ts` — pure scoring functions per goal +
  the `pickBestPlayForGoal(scores, goal)` orchestrator + the
  `inferDefaultGoal(scores)` first-render helper.
- `app/analyzer/components/StrategyCompare/GoalPicker.tsx` — chip row UI.

**Modified:**

- `app/analyzer/AnalyzerClient.tsx` — owns `selectedGoal` state; reads/writes
  localStorage; threads goal to `StrategyCompare` and `useSectionAiInsights`;
  computes `bestPlay = pickBestPlayForGoal(scores, selectedGoal)`.
- `app/analyzer/components/StrategyCompare/StrategyCompare.tsx` — renders
  `<GoalPicker>` above the existing `BestPlayCallout`. Forwards goal-derived
  winner.
- `app/analyzer/components/cards/BestPlayCallout.tsx` — optional `goal`
  prop; tagline updates ("Best for <goal>: <strategy>").
- `app/analyzer/lib/use-section-ai-insights.ts` — adds `goal` to payload;
  adds goal to `piqDiscriminator` so the queryKey discriminates by goal.
- `lib/data/fetchers/ai-insights.ts` — adds optional `goal` field to
  `AiInsightPayload`.
- `backend/src/analyzer/dto/ai-insights.dto.ts` — adds optional `goal`
  enum field on the inner `payload`.
- `backend/src/analyzer/ai-insights.service.ts` — includes goal in the
  assembled prompt as a small leading block when present.
- `backend/src/analyzer/prompts/section-prompts.ts` — appends a short
  goal-aware block (3-4 sentences) to `recommendation_analysis`
  instructions. Kept short to avoid the v2-style prompt-paralysis regression.
- `backend/src/analyzer/ai-insights.cache.ts` — embeds `goal` in the cache
  key; bumps `PROMPT_REVISION` to invalidate any cached v4 narratives that
  were generated without goal awareness.

## Scoring math

### Type contract

```ts
type InvestorGoal =
  | "cash_flow"
  | "long_term_wealth"
  | "fast_cash"
  | "recycle_capital";

type StrategyKey = "buyAndHold" | "flip" | "brrrr";

interface GoalScores {
  buyAndHold: number;
  flip: number;
  brrrr: number;
}

function scoreForGoal(
  goal: InvestorGoal,
  results: { rental; flip; brrrr; projection },
): GoalScores;

function pickBestPlayForGoal(results, goal: InvestorGoal | null): StrategyKey; // when goal=null, falls back to current pickBestPlay()

function inferDefaultGoal(results): InvestorGoal;
```

### Per-goal scoring

All four scoring functions return positive numbers (never `-Infinity` or
`null`) so the winner is always meaningful — per the user's "soft-penalize
but keep all 3 strategies scorable" preference. The penalties for "this
strategy doesn't naturally apply" are proxies, not disqualifications.

**Cash flow** — monthly recurring income.

- B&H: `rental.cashflowMonthly`
- F&F: `(flip.projectedProfit / holdMonths) × 0.4` — proxy: "if you flipped
  and parked the lump sum in a bond ladder, this is the monthly drip." The
  0.4 multiplier discounts gross profit for capital-gains tax (~25% blended)
  and the opportunity cost of one-shot vs ongoing income (further ~50%
  haircut so a strong flip's monthly proxy lands below a typical B&H's real
  cashflow on the same dollars).
- BRRRR: `brrrr.postRefiCashflowMonthly`

**Long-term wealth** — 30-year equity position.

- B&H: `projection.horizons.y30.equity`
- F&F: `flip.projectedProfit × (1.07)^30` (proxy: profit compounds at 7%
  annualized in an index fund). One-time payout, no rolling-flip multiplier
  (we assume one deal, not a treadmill).
- BRRRR: same as B&H's `y30.equity` but using the BRRRR projection if
  available (`brrrr.postRefiProjection.horizons.y30.equity`); otherwise
  use B&H's projection as a proxy since post-refi BRRRR behaves like B&H.

**Fast cash** — short-term lump sum within 12 months.

- B&H: `(projection.horizons.y1.equity − initialEquity) × 0.7` — proxy: a
  cash-out HELOC at year 1 can extract ~70% of the new equity (appreciation
  - paydown). Falls back to `0` when the projection isn't available
    (e.g., insufficient input); the soft-penalty path is the projection-less
    formula `totalCashInvested × 0.05` already used below for Recycle Capital
    scaling, ensuring B&H never hard-disqualifies on Fast Cash.
- F&F: `flip.projectedProfit` (the cleanest fast-cash strategy by design)
- BRRRR: `brrrr.refinanceCashOut − totalCashInvested` (net cash returned
  at the refi event; can be negative if refi doesn't cover what was put in,
  in which case score is `max(0, ...)` so it's never disqualifying)

**Recycle capital** — minimize trapped capital per unit time (velocity).

- B&H: `totalCashInvested × 0.05` (proxy: dollar-years trapped earn ~5%
  on a portfolio averaging basis; low score)
- F&F: `totalCashInvested / max(holdMonths, 1)` × 12 (cash recovered per
  year via sale + redeployment)
- BRRRR: `max(0, totalCashInvested − brrrr.remainingCashInDeal) /
max(refiSeasoningMonths, 1)` × 12 (cash recovered per year via refi; the
  closer `remainingCashInDeal` is to 0, the higher this score)

Each goal's `pickBestPlayForGoal()` returns `argmax(scoreForGoal(goal))`.

### Default goal inference

`inferDefaultGoal(results)` computes scores for all 4 goals and returns the
goal whose _top-strategy score_ is highest after normalization. Normalize
within each goal so cross-goal comparison is meaningful — e.g., a Cash Flow
score of $300/mo normalizes to 0.6 on a 0-to-1 scale where $500/mo is 1.0;
a Fast Cash score of $40k normalizes to 0.6 where $80k is 1.0.

The normalization anchors:

| Goal             | Score = 1.0 anchor        |
| ---------------- | ------------------------- |
| Cash flow        | $500/door/month           |
| Long-term wealth | $500k at year 30          |
| Fast cash        | $80k in year 1            |
| Recycle capital  | $40k/year cash redeployed |

The anchors are tuned to typical Balanced-preset A-grade outcomes so a
strong deal lands around 1.0 on its best-fit goal.

## Backend changes

### DTO

`AiInsightsBodyDto.payload` gains:

```ts
goal?: 'cash_flow' | 'long_term_wealth' | 'fast_cash' | 'recycle_capital' | null;
```

Optional + nullable so existing callers (focused mode, saved/shared routes)
keep working without changes.

### Prompt

Appended to `recommendation_analysis` in `section-prompts.ts`:

> "If a USER GOAL is provided in the payload (one of: cash flow, long-term
> wealth, fast cash, recycle capital), frame the verdict around it. If the
> winning strategy has a lower overall grade than another strategy, say
> explicitly why it still wins for THIS goal (e.g., 'Fix & Flip grades
> higher overall but delivers no monthly income; for a cash-flow goal the
> B&H's $312/mo beats the F&F lump sum'). If no strategy fits the goal
> well, say so — 'this deal isn't a cash-flow play; the least-bad option
> is BRRRR's $50/mo, but consider passing.'"

This addition is short (3-4 sentences) — not the wall of `NEVER do X` that
broke the narrative in the v2 rollout. Keeps the existing prompt structure.

### Cache key

`ai-insights.cache.ts` `computeKey()` adds `goal ?? 'none'` between
`strategy` and `inputHash`:

```
ai-insights:${PROMPT_REVISION}:${sectionId}:${strategy}:${goal}:${inputHash}:${rcHash}:${piqHash}
```

Each goal gets its own cache entry per (deal, section). `PROMPT_REVISION`
bumps to `v5` to invalidate all current v4 entries (which were generated
without goal awareness).

## Testing

- **Unit tests** — `goal-scoring.test.ts` covers each scoring function with
  representative result fixtures (strong B&H, strong F&F, strong BRRRR, all-F).
- **Default-goal inference test** — verify the four anchor properties
  (strong rental deal → cash_flow default; strong flip → fast_cash default;
  etc.).
- **`pickBestPlayForGoal` cross-table test** — for each (goal × deal type)
  combination, assert the expected winner. ~12 cases.
- **GoalPicker component test** — render with no selected goal, verify
  inferDefault renders the right chip as active; click a different chip,
  verify it becomes active + onChange fires.
- **AnalyzerClient integration test** — verify selectedGoal flows through
  to BestPlayCallout (winner changes) and to useSectionAiInsights
  (queryKey changes).
- **Backend prompt test** — verify the goal block is included in
  `assemblePrompt()` output when payload.goal is set, omitted when null.

## Open questions resolved during brainstorming

1. **4 goals**: Cash flow, Long-term wealth, Fast cash, Recycle capital ✓
2. **Effect of picking a goal**: Change Best Play winner + reframe AI
   narrative ✓
3. **Picker location**: Inline above Best Play callout, only in compare
   mode ✓
4. **Default state**: Pre-select the goal that fits this deal best ✓
5. **Penalty math**: Soft-penalize, keep all 3 strategies scorable ✓

## Risks

- **Soft-penalty math feels dishonest in edge cases**. A deal that grades F
  across the board for cash flow will still surface a "winner" because no
  strategy is fully disqualified. Mitigation: the AI narrative prompt
  explicitly handles the "least bad" case and may say "consider passing."
- **Prompt bloat** in `recommendation_analysis` — we recently rolled back
  a similar prompt addition (v3) because the model got paralyzed. This
  addition is intentionally short (3-4 sentences, no `NEVER` walls). If it
  breaks the narrative again, the fix is to remove ONLY this block, not
  wholesale-revert prompt history.
- **Default-goal inference may flicker on first load** while results
  resolve. Hold the picker in a "computing…" state until `grading.data`
  resolves; once it does, snap to the inferred default. Tested against
  React Query's `isPending` flag.

## Out of scope (future work)

- Personalized thresholds per goal (Conservative for Cash Flow goal, etc.)
- Per-goal lever ranking in the upgrade-path panels (today shows all
  levers; could prioritize the ones that move the goal-relevant metric)
- Goal-driven 3-up grid re-ordering (the user explicitly excluded this
  during brainstorming)
- Saved/shared route goal serialization (today the goal lives in
  localStorage; sharing a deal URL won't carry the goal)
