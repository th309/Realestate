# PropertyIQ Score → True Within-State, + De-versioning

Status: PLAN (approved decisions below). Started 2026-05-23.

## Decisions locked

- **Method:** switch the score from national percentile to **rank WITHIN state** (true state-relative). Matches every published claim (tour, FAQ, blog `propertyiq-score-methodology.mdx`, `llms.txt`, glossary): "50 = state average", "z-scored within the state", "not comparable across states".
- **Small states / cross-state metros:** peer-group cascade — rank within **state** if it has ≥ N markets; else fall back to **Census division** (9, via `census_division_mapping`) → region → national. (Threshold N decided empirically in B0.)
- **Sequencing:** do **Phase A (de-version + delete dead v3) first**, as its own verified commit, so the modeling change lands on clean names.
- **Re-validation:** mandatory, via the authoritative `piq-validation-report` skill; verify real thresholds from actual reports (do NOT trust second-hand threshold summaries).
- **No score is broken silently:** snapshot before every write; recompute policy decided in B4.

## Context (verified this session)

- Live engine ranks NATIONALLY (`recentered_score.py:93` groups by period only); the site claims within-state → product currently contradicts its own docs. This change fixes that.
- Write path: `ScoringService` → `propertyiq_scores_v2` (base table; `propertyiq_scores` is a view). Persistence fix already committed (`09e50ae0`).
- v4 is the only live engine; v3 (homeready/investoredge/markethealth) is dead, not computed, not persisted as a version, not API-exposed.
- State per geo: county = fips prefix; zip = `geography_crosswalk.zip_code`; metro = crosswalk primary/"first" state (CBSAs cross state lines).

## Phase A — De-version + delete dead v3 (do first)

- [ ] A1. Confirm each v3 unit is truly unreferenced on the live path before deleting (grep every importer).
- [ ] A2. Delete dead v3: `scoring-engine.ts` (v3 math), `scoring-data-fetcher.ts` `fetchAllMetrics` + v3 multi-table fetch, v3 `FORMULA_WEIGHTS`/`COMPONENT_GROUPS`/`MODEL_CORRELATIONS`/`LegacyScoreType`, unused v3 imports in `scoring.service.ts`. Keep shared `scoring-data-helpers.ts`.
- [ ] A3. Rename v4 → unversioned: files `v4-scoring-engine.ts→scoring-engine.ts`, `v4-scoring-data-fetcher.ts→scoring-data-fetcher.ts`; identifiers `calculateV4Scores→calculatePropertyIqScores`, `V4_ZERO_CROSSING→ZERO_CROSSING`, `V4_FORMULA_METRICS→FORMULA_METRICS`, `V4_METRIC_DIRECTIONS→METRIC_DIRECTIONS`, `V4_FORMULA_VERSION→FORMULA_VERSION`, `fetchV4Metrics→fetchMetrics`, `runV4Engine→runEngine`.
- [ ] A4. Update tests + `scoring.types.ts` re-exports. Build + scoring test suites green.
- [ ] A5. Commit to develop (no push). Verify branch first.

## Phase B — Rank within state (modeling)

- [ ] B0. **Prototype (read-only):** compute, on current data per geo, scores under national vs within-state vs division-pooled; highlight small-state cases; pick the min-N threshold + fallback ladder from real numbers. Report before/after.
- [ ] B1. Peer-group resolver: derive each market's peer set (state / division / region) per geo. Metro→state = crosswalk primary state (parity; flag largest-pop refinement for later).
- [ ] B2. Engine: rank percentile within peer group (not national). Keep z-score signal definition. Re-center via zero-crossing fit on the NEW within-peer percentiles.
- [ ] B3. Re-fit zero-crossing(s) on within-peer percentiles (Python). Store/load (table or constant per geo).
- [ ] B4. **Re-validate via `piq-validation-report` skill** — gate: must meet documented bar (IC, hit-rate, monotonicity, per-state sanity, no zero-IC states). Verify real thresholds.
- [ ] B5. Recompute (policy: going-forward + deliberate full recompute w/ snapshot). Reconcile site copy: fix the one contradictory line (`app/scores/page.tsx` "national distribution" → within state/peer group). Update CLAUDE.md §9.

## Open empirical decisions (resolve in B0)

- Min-N threshold for state-vs-division ranking (and whether to shrink rather than hard-switch).
- Metro state-assignment: keep crosswalk "first state" (parity) vs largest-population state.
- Recompute scope: going-forward only vs full historical recompute (note: Redfin revises history → re-running old months diverges; see memory `redfin-rescore-history-diverges`).

## Risks / rollback

- Snapshot `propertyiq_scores_v2` for any period before recompute.
- Phase A: pure refactor — guarded by build + scoring test suites; no DB/API change.
- Phase B changes ALL scores (within-state ≠ national); published validation numbers may change → must update site copy numbers if so.
