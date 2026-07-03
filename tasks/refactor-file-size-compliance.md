# Refactor Backlog — File-Size Compliance (CLAUDE.md §1.3)

**Generated:** 2026-07-03 · **Branch:** develop · **HEAD:** bd804081
**Source:** beta-testing-propertyiq file-size audit → feedback tracker id `e05bba48-6af6-4a30-87a4-603341829d2c` (P2, still OPEN).

## The rule (§1.3 hard limits)
| Type | Target | Hard limit |
|---|---|---|
| Logic files (hooks, utils, plain .ts) | <200 | **300** |
| React components (.tsx) | <300 | **400** |
| Test files (.test/.spec) | <400 | **500** |

At the hard limit: analyze logical components → propose a refactor plan → execute the split. One exported component per file with its local helpers; **2+ exports ⇒ must split** regardless of line count.

## ⚠️ Read before splitting
- **Data / fixture / definition files are NOT logic — likely EXEMPT, do NOT blindly split.** Splitting a data table adds no clarity. Examples in the list below: `scoring/__tests__/fixtures/expected-scores.ts` (2660, pure fixture), `scoring/**/formula-weights.ts` (weights data), `lib/data/definitions.ts`, any `*.dto.ts`, `*-definitions.ts`, `*.constants.ts`, `metro-slug-data*`. Judge each: is it logic or data?
- **Documented intentional exception — LEAVE AS-IS:** `packages/backend/src/scoring/scoring.controller.ts` (~372). The catch-all route-ordering footgun requires it to stay a single file (see the `scoring-controller-catchall-ordering` reference note).
- Each split is its own careful refactor with real regression risk. Do them **one at a time**, verify after each (`tsc --noEmit` + relevant tests + render the affected page/endpoint), and **commit per split** (or per small batch). Prioritize the largest TRUE component/logic offenders first.
- NOTE: frontend tests are NOT in CI (unenforced), so a split that breaks a frontend test won't fail a build — run the affected specs locally.

## Total: 125 files over hard limit (as of HEAD above)

### React components — >400 lines (36 files)
- [ ] **1692** — `packages/frontend/app/(app)/graphs/components/D3VisualizationSection.tsx`
- [ ] **1470** — `packages/frontend/app/(app)/admin/ml-workflow/page.tsx`
- [ ] **1389** — `packages/frontend/lib/visualizations/d3/ScatterPlot.tsx`
- [ ] **1324** — `packages/frontend/app/(app)/admin/entitlements/users/page.tsx`
- [ ] **1049** — `packages/frontend/app/(app)/docs/api/components/UseCasesTab.tsx`
- [ ] **1018** — `packages/frontend/app/(app)/admin/propertyiq-scores/components/MLValidationTab.tsx`
- [ ] **979** — `packages/frontend/lib/visualizations/d3/RadarChart.tsx`
- [ ] **909** — `packages/frontend/app/(app)/graphs/components/GraphsPageV2/GraphsPageV2.tsx`
- [ ] **819** — `packages/frontend/app/(app)/graphs/components/AnimatedTimeSeriesChart.tsx`
- [ ] **762** — `packages/frontend/app/(app)/admin/propertyiq-scores/components/AutomatedRunsTab.tsx`
- [ ] **752** — `packages/frontend/lib/visualizations/d3/HorizontalBarChart.tsx`
- [ ] **732** — `packages/frontend/app/(app)/reports/q2-2026-by-state/page.tsx`
- [ ] **712** — `packages/frontend/app/(app)/graphs/components/Sidebar/Sidebar.tsx`
- [ ] **662** — `packages/frontend/app/(app)/graphs/components/ChartSection.tsx`
- [ ] **659** — `packages/frontend/app/(app)/reports/[id]/components/sections/agent/SupplyDemand.tsx`
- [ ] **648** — `packages/frontend/lib/visualizations/d3/WaterfallChart.tsx`
- [ ] **618** — `packages/frontend/app/(app)/reports/[id]/components/sections/agent/MarketPulse.tsx`
- [ ] **607** — `packages/frontend/app/(app)/admin/entitlements/trial/page.tsx`
- [ ] **606** — `packages/frontend/app/(app)/reports/[id]/components/sections/agent/PriceTrends.tsx`
- [ ] **593** — `packages/frontend/app/(app)/admin/propertyiq-scores/components/FormulaEditorTab.tsx`
- [ ] **574** — `packages/frontend/app/(app)/reports/[id]/components/sections/agent/TalkingPoints.tsx`
- [ ] **573** — `packages/frontend/app/(app)/map/components/BenchmarkPanel.tsx`
- [ ] **522** — `packages/frontend/app/(app)/admin/entitlements/playbook/page.tsx`
- [ ] **513** — `packages/frontend/app/(app)/admin/propertyiq-scores/components/ConfidenceTrendChart.tsx`
- [ ] **511** — `packages/frontend/app/(app)/admin/propertyiq-scores/components/BacktestingTab.tsx`
- [ ] **504** — `packages/frontend/app/(app)/graphs/components/ScoreCards.tsx`
- [ ] **484** — `packages/frontend/app/(app)/admin/content-pipeline/new/confirm-step.tsx`
- [ ] **476** — `packages/frontend/app/(app)/admin/propertyiq-scores/components/ComponentAnalysis.tsx`
- [ ] **476** — `packages/frontend/app/(app)/admin/content-pipeline/style-references/page.tsx`
- [ ] **458** — `packages/frontend/app/(app)/about/terms/TermsSectionsIntro.tsx`
- [ ] **457** — `packages/frontend/app/(app)/about/terms/TermsSectionsRights.tsx`
- [ ] **449** — `packages/frontend/app/(app)/scores/accuracy/components/PearsonVsSpearman.tsx`
- [ ] **422** — `packages/frontend/app/(app)/map/components/Icons.tsx`
- [ ] **419** — `packages/frontend/app/(app)/admin/propertyiq-scores/components/ScoreCardsTab.tsx`
- [ ] **419** — `packages/frontend/app/(app)/admin/feedback/components/TesterManager.tsx`
- [ ] **406** — `packages/frontend/components/ui/Select.tsx`

### Logic / hooks / utils — >300 lines (77 files)
- [ ] **871** — `packages/frontend/lib/data/definitions.ts`
- [ ] **733** — `packages/backend/src/permits/permits.service.ts`
- [ ] **708** — `packages/backend/src/scoring/formula-weights.ts`
- [ ] **697** — `packages/backend/src/scoring/validation/validation.service.ts`
- [ ] **677** — `packages/frontend/app/(app)/reports/types.ts`
- [ ] **658** — `packages/backend/src/scoring/admin/admin.controller.ts`
- [ ] **651** — `packages/backend/src/health/metric-definitions.ts`
- [ ] **649** — `packages/frontend/app/(app)/graphs/hooks/useWaterfallData.ts`
- [ ] **643** — `packages/frontend/app/(app)/graphs/hooks/useGraphSearch.ts`
- [ ] **625** — `packages/frontend/app/(app)/graphs/hooks/useGraphsState.ts`
- [ ] **623** — `packages/frontend/app/(app)/reports/builder/hooks/useBuilderState.ts`
- [ ] **597** — `packages/backend/src/scoring/versioning/ab-test.service.ts`
- [ ] **577** — `packages/backend/test/integration/api-endpoints.integration-spec.ts`
- [ ] **518** — `packages/frontend/app/(app)/graphs/constants.ts`
- [ ] **517** — `packages/backend/src/metrics/pipelines/investment-metrics-zips.service.ts`
- [ ] **506** — `packages/backend/src/metrics/pipelines/investment-metrics-counties.service.ts`
- [ ] **502** — `packages/backend/src/metrics/pipelines/investment-metrics-metros.service.ts`
- [ ] **489** — `packages/backend/src/scoring/dto/score-response.dto.ts`
- [ ] **477** — `packages/backend/src/scoring/versioning/formula-version.service.ts`
- [ ] **475** — `packages/backend/src/ml-workflow/ml-workflow.service.ts`
- [ ] **471** — `packages/backend/src/scoring/backtest-runs/backtest-runs.service.ts`
- [ ] **471** — `packages/backend/src/metrics/pipelines/affordability-metrics.service.ts`
- [ ] **465** — `packages/backend/src/scoring/backtest/backtest-runner.service.ts`
- [ ] **458** — `packages/frontend/app/(app)/map/config/metric-availability.ts`
- [ ] **453** — `packages/backend/src/zillow/zillow.controller.ts`
- [ ] **418** — `packages/backend/src/scoring/ml-validation/ml-validation.service.ts`
- [ ] **418** — `packages/backend/src/admin/features/features.service.ts`
- [ ] **415** — `packages/backend/src/timeseries/timeseries-metric-mapping.ts`
- [ ] **411** — `packages/backend/src/health/data-freshness.service.ts`
- [ ] **403** — `packages/frontend/app/(app)/graphs/hooks/useMultiMetricData.ts`
- [ ] **399** — `packages/frontend/app/(app)/map/hooks/useMapLayers.ts`
- [ ] **396** — `packages/backend/src/geography/geography.service.ts`
- [ ] **395** — `packages/frontend/lib/data/fetchers/snapshot.ts`
- [ ] **394** — `packages/backend/src/reports/reports-narrative-template-vars.ts`
- [ ] **390** — `packages/backend/src/reports/reports-market-comparison.ts`
- [ ] **378** — `packages/backend/src/benchmarks/benchmarks.service.ts`
- [ ] **374** — `packages/backend/src/timeseries/timeseries-region-filter.ts`
- [ ] **372** — `packages/backend/src/scoring/scoring.controller.ts`
- [ ] **366** — `packages/backend/src/content-pipeline/gates/data-verifier.service.ts`
- [ ] **350** — `packages/backend/src/scoring/backtest/outcome-benchmark.service.ts`
- [ ] **350** — `packages/backend/src/economic/economic.service.ts`
- [ ] **348** — `packages/backend/src/alerts/alerts.service.ts`
- [ ] **345** — `packages/backend/src/admin/features/user-features.service.ts`
- [ ] **344** — `packages/backend/src/redis/redis.service.ts`
- [ ] **342** — `packages/frontend/lib/data/fetchers/reports.ts`
- [ ] **342** — `packages/backend/src/user-analytics/conversion-analytics.service.ts`
- [ ] **338** — `packages/backend/src/scoring/backtest-runs/backtest-runs.controller.ts`
- [ ] **337** — `packages/backend/src/billing/stripe.service.ts`
- [ ] **336** — `packages/backend/test/enterprise/rls-policies.e2e-spec.ts`
- [ ] **335** — `packages/backend/src/scoring/scoring.service.ts`
- [ ] **333** — `packages/backend/src/content-pipeline/analytics/performance.service.ts`
- [ ] **332** — `packages/backend/src/reports/reports.service.ts`
- [ ] **331** — `packages/backend/src/content-pipeline/drivers/anthropic-ranking-script.ts`
- [ ] **331** — `packages/backend/src/census/census.controller.ts`
- [ ] **330** — `packages/backend/src/reports/reports-score-context.ts`
- [ ] **329** — `packages/backend/src/analytics-persistence/conversations.service.ts`
- [ ] **327** — `packages/backend/src/admin/features/grandfathering.controller.ts`
- [ ] **326** — `packages/frontend/app/(app)/map/hooks/useMetricOptions.ts`
- [ ] **326** — `packages/backend/src/zillow/helpers/crosswalk.ts`
- [ ] **324** — `packages/frontend/test/enterprise/org-admin-portal.e2e-spec.ts`
- [ ] **322** — `packages/frontend/middleware.ts`
- [ ] **321** — `packages/backend/src/content-pipeline/orchestrator/job-handlers/publish-youtube-shorts.handler.ts`
- [ ] **320** — `packages/frontend/app/(app)/admin/content-pipeline/lib/content-pipeline-api.ts`
- [ ] **317** — `packages/backend/src/admin/trial/trial.service.ts`
- [ ] **316** — `packages/frontend/app/(app)/reports/hooks/useReportSearch.ts`
- [ ] **312** — `packages/backend/src/scoring/backtest/confidence-calculator.service.ts`
- [ ] **311** — `packages/backend/src/data-ingestion/sources/redfin.service.ts`
- [ ] **309** — `packages/backend/src/analytics-persistence/watchlist.service.ts`
- [ ] **308** — `packages/backend/src/health/data-cards-health.service.ts`
- [ ] **307** — `packages/frontend/app/(app)/map/hooks/useRightPanelData.ts`
- [ ] **307** — `packages/backend/src/scoring/backtest/outcome-cache-preloader.service.ts`
- [ ] **307** — `packages/backend/src/content-pipeline/content-pipeline.module.ts`
- [ ] **304** — `packages/backend/src/org-billing/org-billing.service.ts`
- [ ] **303** — `packages/frontend/lib/visualizations/d3/utils/axes.ts`
- [ ] **303** — `packages/backend/src/content-pipeline/orchestrator/job-handlers/render-video.handler.ts`
- [ ] **302** — `packages/backend/src/timeseries/timeseries.service.ts`
- [ ] **301** — `packages/frontend/app/(app)/map/utils/metricUtils.ts`

### Test files — >500 lines (12 files)
- [ ] **2660** — `packages/backend/src/scoring/__tests__/fixtures/expected-scores.ts`
- [ ] **990** — `packages/backend/src/scoring/__tests__/unit/missing-metrics.service.spec.ts`
- [ ] **723** — `packages/frontend/tests/e2e/admin-dashboard.spec.ts`
- [ ] **672** — `packages/backend/src/scoring/__tests__/integration/monitoring.spec.ts`
- [ ] **647** — `packages/frontend/tests/e2e/tier-access.spec.ts`
- [ ] **577** — `packages/backend/src/scoring/__tests__/unit/runtime-assertions.spec.ts`
- [ ] **552** — `packages/frontend/tests/e2e/score-display.spec.ts`
- [ ] **533** — `packages/backend/src/scoring/__tests__/unit/normalization.service.spec.ts`
- [ ] **523** — `packages/backend/src/scoring/__tests__/unit/inheritance.service.spec.ts`
- [ ] **521** — `packages/frontend/__tests__/location-coverage.test.ts`
- [ ] **517** — `packages/frontend/__tests__/graph-matrix.test.ts`
- [ ] **501** — `packages/backend/src/scoring/__tests__/integration/scoring-pipeline.spec.ts`

---
_Re-scan any time with the batched `find … | xargs -0 wc -l | awk` one-liner (classify by extension: .tsx=400, .ts=300, test=500). This list will drift as the codebase changes; regenerate before a big pass._
