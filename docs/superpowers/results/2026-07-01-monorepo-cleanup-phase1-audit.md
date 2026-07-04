# Monorepo Cleanup — Phase 1: Audit

**Date:** 2026-07-01
**Scope:** Report only. Zero code changes made during this phase.
**Method:** 6 parallel audit agents (git-tracked files, dead code × 2, stale artifacts, file-size compliance, structural issues) plus 2 manual `madge --circular` runs to verify circular-dependency claims.

---

## 0. Headline findings (read this first)

1. **A real, live credential is exposed in git history.** `packages/frontend/.env.test` is tracked and contains `TEST_ENTERPRISE_USER_PASSWORD=Youknowwhy$$12` for `TEST_ENTERPRISE_USER_EMAIL=troyhouston76@gmail.com`, pushed to `origin/develop`, `origin/main`, and `origin/feat/deal-analyzer`. **Already flagged to you separately — rotate this password now, independent of this cleanup's timeline.**
2. **A second, live, deployed PropertyIQ Score implementation actively violates CLAUDE.md.** `packages/propertyiq-analytics/app/services/scoring_service.py` (its own Railway service) uses Redfin inputs (forbidden by CLAUDE.md §9's "No Redfin" rule), a hardcoded zero-crossing of 55.6 (should be 50), retired quality-word labels, and a version number (`model_version = "4.0.0"`, also forbidden). No caller was found anywhere in the main app or MCP server, but it's a live, callable, wrong-scoring artifact sitting on a production service.
3. **77 files exceed CLAUDE.md's file-size hard limits** (23 RED/critical-path, 28 YELLOW, 26 GREEN, plus 6 test files and 6 multi-export violations). This is a large amount of structural debt — see §4 for the full breakdown and a recommended fix order.
4. **28 circular dependencies confirmed** via `madge --circular` (12 backend, 16 frontend) — not previously verified by grep alone.
5. A confirmed **CLAUDE.md formatting-rule violation**: `map/utils/metricUtils.ts` has its own `formatValue()`/`formatTooltipValue()`, separate from `lib/data/format.ts`'s `formatMetricValue()`. Both are live and used by core map data hooks. CLAUDE.md itself references both names in different sections (§1.1 and §6) — this may mean the spec itself needs reconciling, not just the code.
6. One dead component confirmed safe to delete: `GraphsPage` v1 (superseded by `GraphsPageV2`, zero importers).

---

## 1. Git-tracked files that shouldn't be

### RED

- **`packages/frontend/.env.test`** — tracked, contains a real plaintext password, pushed to 3 remote branches. Not a Phase 3 item — recommend rotating the credential immediately. Git-history scrubbing itself is a separate RED action requiring your explicit approval (per your own no-history-rewrite rule).

### GREEN — everything else here is clean

- No `node_modules`/`.next`/`dist`/`build` artifacts tracked.
- No real logs/coverage/OS-junk tracked (grep hits were legitimately-named source files like `usage-coverage.service.ts`, not actual reports).
- No IDE configs tracked.
- `.env.example` correctly tracked, real `.env`s correctly ignored at root, `packages/backend`, `packages/propertyiq-analytics`. `packages/propertyiq-analytics/venv/` (Python virtualenv) confirmed gitignored, zero files tracked (verified directly: `git check-ignore -v` → matches `.gitignore:9:venv/`).
- Minor gap: `packages/frontend` has no `.env.example` — low-priority addition.
- 106 Supabase migration files properly tracked under `supabase/migrations/`. No generated `database.types.ts` tracked (correct).
- The 4 stray `.claude/worktrees/*` directories are untracked and safe `git worktree prune` candidates — confirm no uncommitted work in each before pruning.

---

## 2. Dead code

### RED

- **`packages/propertyiq-analytics/app/services/scoring_service.py`** — see headline #2 above. Recommend: confirm zero external callers via Railway traffic/logs, then either delete the file/route entirely, or if the analytics service needs scoring capability, have it call the real backend engine instead of reimplementing the formula.
- **Duplicate formatting utilities** (`map/utils/metricUtils.ts`'s `formatValue()`/`formatTooltipValue()` vs `lib/data/format.ts`'s `formatMetricValue()`) — both live, both used by core map hooks (`useMarketFactorsData.ts`, `useMetricData.ts`). This is a direct CLAUDE.md single-source-of-truth violation, but touches the map rendering critical path — needs a careful consolidation plan, not a blind delete, and CLAUDE.md's own two references to these names should probably be reconciled at the same time.

### YELLOW

- **`lib/data/types/legacy.ts`**'s `@deprecated MetricDataEntry`/`MetricData` type aliases are still imported in 4 real files (`map/config/fetchMetricData.ts`, `map/config/index.ts`, `graphs/components/D3VisualizationSection.tsx`, `lib/visualizations/d3/CorrelationMatrix.tsx`) — migration candidates, not dead.
- Backend unused-exports / dead-controllers / duplicate-fallback-chain check was **inconclusive** — grep-based sweeps were too noisy to trust. Recommend a dedicated `ts-prune` (or equivalent TS-compiler unused-exports check) pass rather than relying on this audit's grep result.
- 4 more `-v2`-suffixed directories exist (`app/(app)/home-v2`, two under `reports/[id]/components/**/v2`, `app/components/home/landing-v2`) — not verified whether their non-v2 counterparts are dead like `GraphsPage` v1 was. Follow-up grep needed.

### GREEN

- **`GraphsPage` v1** (`app/(app)/graphs/components/GraphsPage/GraphsPage.tsx`, 238 lines) — zero importers anywhere, confirmed dead. `page.tsx` only uses `GraphsPageV2`. Safe to delete.
- `lib/api/client.ts` (the module CLAUDE.md §5 calls out as "never import from, deprecated") **no longer exists in the codebase at all** — this is stale documentation, not a code finding. Worth a one-line CLAUDE.md cleanup whenever convenient.

---

## 3. Stale artifacts

Mostly clean. No junk-named files (`utils2.*`, `temp*`, `*.bak`, `*-old.*`) anywhere in the tracked tree. `@deprecated` usage (14 files) is disciplined — every instance has a clear pointer to its replacement, not silent drift; the 3 legacy-score fields in `scoring.types.ts` are the already-known, intentionally-untouched tech debt. No lingering version-numbered naming (`scoring_v2`, etc.) — confirms the "no version numbers" rule is being followed in current code. One self-documented test skip (`grading-result.spec.ts:25`, `test.fixme` with an explanatory comment about a known Playwright env issue) — tracked debt, not silent rot, no action needed.

**Not fully verified:** a deeper "does this import resolve to the _wrong_ file" check (as opposed to "does it fail to resolve," which Phase 0's clean build already rules out) wasn't completed — flagged as unconfirmed, not claimed clean.

---

## 4. File-size compliance (CLAUDE.md §1.3)

**77 files exceed hard limits** (logic/hooks: 300, components: 400, tests: 500), plus 6 additional multi-export violations that must split regardless of line count.

| Category                                                                             | Count | Tier         |
| ------------------------------------------------------------------------------------ | ----- | ------------ |
| RED (critical-path: scoring engine, metrics/data controllers, reports orchestration) | 23    | Must-fix     |
| YELLOW (high-traffic services, admin pages, graph components)                        | 28    | Should-fix   |
| GREEN (isolated: D3 viz library, admin dashboards, presentation)                     | 26    | Nice-to-have |
| Test files (split by describe block)                                                 | 6     | Should-fix   |
| Multi-export violations (must split regardless of size)                              | 6     | Must-fix     |

**Worst offenders:** `zillow.service.ts` (1,862 lines, 6.2× limit), `metrics.controller.ts` (1,623 lines, 5.4×), `realtor.controller.ts` (1,288 lines, 4.3×), `scoring.controller.ts` (1,154 lines, 3.8×), `admin/ml-workflow/page.tsx` (1,470 lines), `lib/visualizations/d3/ScatterPlot.tsx` (1,389 lines, 4 exports).

**Full file-by-file list with proposed split strategies** (RED/YELLOW/GREEN/tests/multi-export, all 77 files) is preserved in this session's transcript — happy to re-render it into this doc or a separate tracking file if you want it as a standing checklist rather than prose.

**Recommended fix order (per the scanning agent, and consistent with your risk-tier rules):** RED violations first, in dependency order — `inheritance.service.ts` → `scoring-engine.ts` → `percentile.service.ts` → controllers — using characterization tests first, since these all sit on the PropertyIQ Score critical path. Multi-export violations should be fixed before other changes since they violate the rule regardless of line count. Rough effort estimate from the scan: 215–290 hours total across all 77 files — this is a multi-week Phase 3 effort on its own, not a quick pass.

---

## 5. Structural issues

### GREEN

- **NestJS module structure is consistent** — all 65 real feature-module directories under `packages/backend/src` have a matching `*.module.ts`. Non-module directories (`common/`, `config/`, `scripts/`) are correctly excluded; `admin/`'s 5 submodules are properly nested, not an inconsistency.
- **`analyzer-core` is genuinely shared correctly** — both frontend (84 import sites) and backend (14 import sites) consume `@propertyiq/analyzer-core` as a real dependency; spot-checked frontend "grading" references and confirmed they're API-client wrappers calling the backend, not reimplemented math. No cross-app grading/scoring duplication found.

### YELLOW

- `packages/frontend/lib/data` has 77 fetcher files but only 36 hook files — a notable asymmetry worth a follow-up pass to check for fetchers missing their `use*` hook wrapper per the CLAUDE.md data-layer pattern. Not confirmed as a defect (not every fetcher needs one), just flagged.
- Mixed-concerns audit (services combining unrelated responsibilities) — not deep-dived, no confident findings either way.

### RED/YELLOW — Circular dependencies (verified via `madge --circular`, not just grep)

**Backend (12):**

1. `ai-provider/ai-provider.types.ts` ↔ `ai-provider/ai-model-capabilities.ts`
2. `billing/billing.module.ts` ↔ `org-billing/org-billing.module.ts`
3. `entitlements/entitlements.service.ts` ↔ `entitlements/tier-resolver.service.ts`
4. `entitlements/entitlements.service.ts` ↔ `entitlements/trial-feature-usage-emitter.service.ts`
5. `timeseries/timeseries.service.ts` ↔ `timeseries/timeseries-computed.ts`
6. `content-pipeline/ranking/ranking-resolver.service.ts` ↔ `content-pipeline/ranking/ranking-queries.ts`
7. `market-analysis/market-analysis.service.ts` ↔ `market-analysis/market-analysis-fallback.ts`
8. `reports/narrative-insights.ts` ↔ `reports/narrative-insights-investment.ts`
   9-10. `reports/reports.service.ts` ↔ `reports/reports-orchestrator.ts` ↔ `reports/reports-orchestrator-v2-routing.ts` (3-way cycle)
   11-12. `market-intelligence/engines/market-stance.engine.ts` ↔ `market-intelligence/market-intelligence.types.ts` ↔ `market-intelligence/engines/risk-flags.engine.ts` (3-way cycle)

**Frontend (16)** — mostly module ↔ barrel-index cycles (e.g. `map/components/index.ts` → `BenchmarkPanel.tsx` → `map/config/index.ts` → `metric-categories.tsx`/`nav-items.tsx`), plus a few genuine pairwise cycles: `lib/data/comparisons.ts` ↔ each of `comparisons/{biggerpockets,mashvisor,neighborhoodscout,reventure}.ts` (4 of the 16), `analyzer/lib/strategy-secondary-mappers.ts` ↔ `strategy-secondary-commercial.ts`, `analyzer/lib/sensitivity-impacts.ts` ↔ `sensitivity-formulas.ts`.

None of these were individually risk-tiered or root-caused in this pass — `madge` confirms they exist, but whether each is a real problem (vs. a harmless barrel-export pattern) needs a case-by-case look before Phase 3 touches any of these files. Flagging as **YELLOW pending triage**, not automatically RED.

---

## 6. Open items for you

1. **Rotate `TEST_ENTERPRISE_USER_PASSWORD` now** (separate from this cleanup's timeline) — already flagged, repeating here since it's the most urgent Phase 1 finding.
2. **`propertyiq-analytics/scoring_service.py`** — confirm via Railway logs/traffic that nothing calls its `/scoring` route before deciding delete-vs-rewire.
3. **`formatValue()`/`formatTooltipValue()` vs `formatMetricValue()`** — CLAUDE.md itself references both; which is meant to be canonical? This blocks a clean Phase 3 consolidation plan.
4. File-size fix scope (77 files, ~215-290 hours per the scan's estimate) is large enough that it may deserve its own dedicated sub-plan rather than folding entirely into Phase 3 — want it scoped separately?
5. Want the full 77-file split-strategy list rendered into a standing checklist doc, or is the summary above sufficient for now?

No code has been changed. Ready for your review before Phase 2 (git hygiene) begins.
