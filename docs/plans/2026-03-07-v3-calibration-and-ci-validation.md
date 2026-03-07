# v3.0 Calibration Update & CI Validation Wiring — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update stale v2.0 calibration artifacts to v3.0, add markethealth+zip support to calibration training, wire live validation and recalibration into the monthly CI pipeline.

**Architecture:** The scoring pipeline runs monthly via `post-import-refresh.yml`. After scores are computed, two new parallel jobs validate score quality (`validate-v3-scoring-live.ts`) and retrain isotonic calibration (`train_calibration.py`). The `SCORE_CALIBRATION` quintile table in `formula-weights.ts` is updated with live v3.0 backtest data queried via `get_quintile_performance()` RPC.

**Tech Stack:** Python (sklearn isotonic regression), TypeScript (NestJS backend), GitHub Actions YAML

---

### Task 1: Add markethealth + zip to train_calibration.py

**Files:**

- Modify: `scripts/analysis/train_calibration.py:53-54` (SCORE_TYPES and GEO_LEVELS constants)
- Modify: `scripts/analysis/train_calibration.py:205-216` (target_col_for_score function)
- Modify: `scripts/analysis/train_calibration.py:517-529` (CLI argparse choices)

**Step 1: Update constants at line 53-54**

Change:

```python
SCORE_TYPES = ["homeready", "investoredge"]
GEO_LEVELS = ["metro", "county"]
```

To:

```python
SCORE_TYPES = ["homeready", "investoredge", "markethealth"]
GEO_LEVELS = ["metro", "county", "zip"]
```

**Step 2: Update target_col_for_score at line 205-216**

Change:

```python
def target_col_for_score(score_type: str) -> str:
    """Return the primary excess-return column for a given score type.

    HomeReady   -> 3Y appreciation CAGR excess vs division median
    InvestorEdge -> 3Y total return CAGR excess vs division median
    """
    if score_type == "homeready":
        return "excess_div_3y"
    elif score_type == "investoredge":
        return "excess_total_div_3y"
    else:
        raise ValueError(f"Unknown score type: {score_type}")
```

To:

```python
def target_col_for_score(score_type: str) -> str:
    """Return the primary excess-return column for a given score type.

    HomeReady    -> 3Y appreciation CAGR excess vs division median
    InvestorEdge -> 3Y total return CAGR excess vs division median
    MarketHealth -> 3Y appreciation CAGR excess vs division median
    """
    if score_type == "homeready":
        return "excess_div_3y"
    elif score_type == "investoredge":
        return "excess_total_div_3y"
    elif score_type == "markethealth":
        return "excess_div_3y"
    else:
        raise ValueError(f"Unknown score type: {score_type}")
```

**Step 3: Update CLI argparse choices at line 518-529**

Change:

```python
    parser.add_argument(
        "--score-type",
        choices=["homeready", "investoredge", "both"],
        default="both",
        help="Which score type(s) to train (default: both)",
    )
    parser.add_argument(
        "--geo-level",
        choices=["metro", "county", "all"],
        default="all",
        help="Geography level to train (default: all = metro + county)",
    )
```

To:

```python
    parser.add_argument(
        "--score-type",
        choices=["homeready", "investoredge", "markethealth", "all"],
        default="all",
        help="Which score type(s) to train (default: all)",
    )
    parser.add_argument(
        "--geo-level",
        choices=["metro", "county", "zip", "all"],
        default="all",
        help="Geography level to train (default: all = metro + county + zip)",
    )
```

**Step 4: Update the argparse resolution logic at line 564-573**

Change:

```python
    if args.score_type == "both":
        score_types = SCORE_TYPES
    else:
        score_types = [args.score_type]

    if args.geo_level == "all":
        geo_levels = GEO_LEVELS
    else:
        geo_levels = [args.geo_level]
```

To:

```python
    if args.score_type == "all":
        score_types = SCORE_TYPES
    else:
        score_types = [args.score_type]

    if args.geo_level == "all":
        geo_levels = GEO_LEVELS
    else:
        geo_levels = [args.geo_level]
```

**Step 5: Verify syntax**

Run: `python -c "import ast; ast.parse(open('scripts/analysis/train_calibration.py').read()); print('OK')"`
Expected: `OK`

**Step 6: Commit**

```bash
git add scripts/analysis/train_calibration.py
git commit -m "feat(scoring): add markethealth + zip support to calibration training"
```

---

### Task 2: Update SCORE_CALIBRATION in formula-weights.ts

**Files:**

- Modify: `packages/backend/src/scoring/formula-weights.ts:460-567` (SCORE_CALIBRATION block)

**Step 1: Create a script to query live quintile data**

Create `scripts/query-quintile-calibration.ts` (temporary, will delete after use):

```typescript
/**
 * One-shot script to query v3.0 quintile excess returns from backtest data.
 * Output is used to update SCORE_CALIBRATION in formula-weights.ts.
 *
 * Usage: npx ts-node -P packages/backend/tsconfig.json scripts/query-quintile-calibration.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../packages/backend/.env") });

const SCORE_TYPES = ["homeready", "investoredge", "markethealth"] as const;

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  for (const scoreType of SCORE_TYPES) {
    console.log(`\n--- ${scoreType} (metro, 3y horizon) ---`);
    const { data, error } = await supabase.rpc("get_quintile_performance", {
      p_score_type: scoreType,
      p_geography_type: "metro",
      p_horizon: "3y",
    });

    if (error) {
      console.error(`  Error: ${error.message}`);
      continue;
    }

    if (!data || data.length === 0) {
      console.log("  No data returned");
      continue;
    }

    for (const row of data) {
      const excess =
        row.avg_excess_vs_state_3y ?? row.avg_excess_vs_division_3y ?? "N/A";
      console.log(
        `  Q${row.quintile}: score ${row.score_min?.toFixed(0)}-${row.score_max?.toFixed(0)}, ` +
          `n=${row.count}, avgReturn3y=${row.avg_return_3y?.toFixed(2)}, ` +
          `avgExcess=${typeof excess === "number" ? excess.toFixed(2) : excess}`,
      );
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

**Step 2: Run the query script**

Run: `npx ts-node -P packages/backend/tsconfig.json scripts/query-quintile-calibration.ts`
Expected: Quintile data for all 3 score types with avgExcess values

**Step 3: Update SCORE_CALIBRATION with live data**

Replace lines 460-567 of `formula-weights.ts`. Update the doc comment to remove PROVISIONAL and reference v3.0. Replace the `avgExcessReturn` values with the numbers from the query output.

The comment block should become:

```typescript
/**
 * Calibration table: maps score quintiles to average historical excess return.
 * v3.0: Generated from get_quintile_performance() RPC on v3.0 backtest outcomes.
 * Used for frontend tooltips, dollar impact calculations, and interpretation.
 *
 * Score semantics (percentile rank normalization):
 *   Score 50 = median metro, predicted to earn roughly the benchmark return
 *   Score 80 = top 20%, predicted to significantly outperform
 *   Score 20 = bottom 20%, predicted to significantly underperform
 *
 * avgExcessReturn: 3-year annualized excess return vs regional benchmark (percentage points)
 */
```

**Step 4: Delete the temporary query script**

Run: `rm scripts/query-quintile-calibration.ts`

**Step 5: Verify TypeScript compiles**

Run: `cd packages/backend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in formula-weights.ts

**Step 6: Commit**

```bash
git add packages/backend/src/scoring/formula-weights.ts
git commit -m "feat(scoring): update SCORE_CALIBRATION with v3.0 backtest data"
```

---

### Task 3: Update CalibrationService doc comment

**Files:**

- Modify: `packages/backend/src/scoring/calibration/calibration.service.ts:1-10` (doc comment)

**Step 1: Update the doc comment**

Change:

```typescript
/**
 * Calibration Service
 *
 * Applies isotonic calibration to raw percentile scores.
 * Loads a JSON lookup table (trained by scripts/analysis/train_calibration.py)
 * and uses piecewise-linear interpolation to map raw scores to calibrated scores.
 *
 * This compresses the score range to better match actual return percentiles,
 * reducing MAD (Mean Absolute Deviation) below the 15 pp target.
 */
```

To:

```typescript
/**
 * Calibration Service (v3.0)
 *
 * Applies isotonic calibration to raw percentile scores.
 * Loads a JSON lookup table (trained by scripts/analysis/train_calibration.py)
 * and uses piecewise-linear interpolation to map raw scores to calibrated scores.
 *
 * Supports all 9 score combinations (3 geos x 3 scores: homeready, investoredge, markethealth).
 * Calibration tables are regenerated monthly by the post-import-refresh CI workflow.
 *
 * This compresses the score range to better match actual return percentiles,
 * reducing MAD (Mean Absolute Deviation) below the 15 pp target.
 */
```

**Step 2: Commit**

```bash
git add packages/backend/src/scoring/calibration/calibration.service.ts
git commit -m "docs(scoring): update CalibrationService comment to v3.0"
```

---

### Task 4: Wire validate-v3-scoring-live.ts into post-import-refresh.yml

**Files:**

- Modify: `.github/workflows/post-import-refresh.yml` (add validate-scores job after run-scoring-pipeline)

**Step 1: Add the validate-scores job**

Insert after the `run-scoring-pipeline` job (after line 174), before `notify-on-failure`:

```yaml
validate-scores:
  needs: run-scoring-pipeline
  runs-on: ubuntu-latest
  timeout-minutes: 30
  if: ${{ needs.run-scoring-pipeline.outputs.scoring_status == 'success' }}

  steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: "20"
        cache: "npm"

    - name: Install dependencies
      run: npm ci

    - name: Run v3 scoring live validation
      id: validate
      env:
        SUPABASE_URL: "${{ secrets.SUPABASE_URL }}"
        SUPABASE_SERVICE_KEY: "${{ secrets.SUPABASE_SERVICE_KEY }}"
      run: |
        echo "=============================================="
        echo "Running v3.0 Scoring Live Validation - $(date)"
        echo "=============================================="

        npx ts-node -P packages/backend/tsconfig.json scripts/validate-v3-scoring-live.ts 2>&1 | tee validation-output.txt

        if [ $? -eq 0 ]; then
          echo "validate_status=success" >> $GITHUB_OUTPUT
        else
          echo "validate_status=issues_found" >> $GITHUB_OUTPUT
        fi

    - name: Upload Validation Log
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: scoring-validation-log-${{ github.run_id }}
        path: validation-output.txt
        retention-days: 30

  outputs:
    validate_status: ${{ steps.validate.outputs.validate_status }}
```

**Step 2: Update notify-on-failure needs to include validate-scores**

Change:

```yaml
notify-on-failure:
  needs: [refresh-calculated-metrics, run-scoring-pipeline]
```

To:

```yaml
notify-on-failure:
  needs:
    [
      refresh-calculated-metrics,
      run-scoring-pipeline,
      validate-scores,
      recalibrate-scores,
    ]
```

**Step 3: Update notify-on-success needs similarly**

Change:

```yaml
notify-on-success:
  needs: [refresh-calculated-metrics, run-scoring-pipeline]
```

To:

```yaml
notify-on-success:
  needs:
    [
      refresh-calculated-metrics,
      run-scoring-pipeline,
      validate-scores,
      recalibrate-scores,
    ]
```

**Step 4: Add validation result to success log**

In `notify-on-success`, add after the existing echo lines:

```yaml
echo ""
echo "Score Validation:"
echo "  - v3.0 live validation passed (9 score combos, 210 sampled locations)"
echo ""
echo "Calibration:"
echo "  - Isotonic calibration tables regenerated (9 keys)"
```

**Step 5: Verify YAML syntax**

Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/post-import-refresh.yml')); print('OK')"`
Expected: `OK`

**Step 6: Commit**

```bash
git add .github/workflows/post-import-refresh.yml
git commit -m "ci(scoring): wire v3 live validation into post-import-refresh"
```

---

### Task 5: Wire train_calibration.py into post-import-refresh.yml

**Files:**

- Modify: `.github/workflows/post-import-refresh.yml` (add recalibrate-scores job)

**Step 1: Add the recalibrate-scores job**

Insert after the `validate-scores` job:

```yaml
recalibrate-scores:
  needs: run-scoring-pipeline
  runs-on: ubuntu-latest
  timeout-minutes: 60
  if: ${{ needs.run-scoring-pipeline.outputs.scoring_status == 'success' }}

  steps:
    - name: Checkout repository
      uses: actions/checkout@v4
      with:
        token: ${{ secrets.GITHUB_TOKEN }}

    - name: Set up Python
      uses: actions/setup-python@v5
      with:
        python-version: "3.11"
        cache: "pip"

    - name: Install Python dependencies
      run: |
        pip install --upgrade pip
        pip install numpy pandas scikit-learn sqlalchemy psycopg2-binary

    - name: Run isotonic calibration training
      id: calibrate
      env:
        DATABASE_URL: ${{ secrets.DATABASE_URL }}
      run: |
        echo "=============================================="
        echo "Running Isotonic Calibration Training - $(date)"
        echo "=============================================="

        cd scripts/analysis
        python train_calibration.py 2>&1 | tee calibration-output.txt

        if [ $? -eq 0 ]; then
          echo "calibrate_status=success" >> $GITHUB_OUTPUT
        else
          echo "calibrate_status=failed" >> $GITHUB_OUTPUT
        fi

    - name: Check for calibration table changes
      id: check_changes
      run: |
        if git diff --quiet packages/backend/src/scoring/calibration/calibration-tables.json; then
          echo "changed=false" >> $GITHUB_OUTPUT
          echo "No changes to calibration tables"
        else
          echo "changed=true" >> $GITHUB_OUTPUT
          echo "Calibration tables updated"
          git diff --stat packages/backend/src/scoring/calibration/calibration-tables.json
        fi

    - name: Commit updated calibration tables
      if: steps.check_changes.outputs.changed == 'true'
      run: |
        git config user.name "github-actions[bot]"
        git config user.email "github-actions[bot]@users.noreply.github.com"
        git add packages/backend/src/scoring/calibration/calibration-tables.json
        git commit -m "data(scoring): regenerate v3.0 isotonic calibration tables

        Automated monthly recalibration from post-import-refresh pipeline.
        Trained on latest backtest outcomes for all 9 score combos."
        git push

    - name: Upload Calibration Log
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: calibration-log-${{ github.run_id }}
        path: scripts/analysis/calibration-output.txt
        retention-days: 30

  outputs:
    calibrate_status: ${{ steps.calibrate.outputs.calibrate_status }}
```

**Step 2: Verify YAML syntax**

Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/post-import-refresh.yml')); print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add .github/workflows/post-import-refresh.yml
git commit -m "ci(scoring): wire monthly isotonic recalibration into post-import-refresh"
```

---

### Task 6: Run existing scoring tests to verify no regressions

**Files:**

- Test: `packages/backend/src/scoring/__tests__/unit/weight-validation.spec.ts`
- Test: `packages/backend/src/scoring/__tests__/unit/weight-cross-validation.spec.ts`

**Step 1: Run the weight validation tests**

Run: `cd packages/backend && npx jest --testPathPattern="weight-validation|weight-cross-validation" --verbose 2>&1 | tail -20`
Expected: All tests pass

**Step 2: Run the full scoring test suite**

Run: `cd packages/backend && npx jest --testPathPattern="scoring" --verbose 2>&1 | tail -30`
Expected: All tests pass

**Step 3: Final commit (squash if desired)**

```bash
git add -A
git commit -m "chore(scoring): verify v3.0 calibration and CI wiring complete"
```

---

## Summary of Changes

| Task | File                                                              | What                                                      |
| ---- | ----------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | `scripts/analysis/train_calibration.py`                           | Add markethealth + zip, update CLI args                   |
| 2    | `packages/backend/src/scoring/formula-weights.ts`                 | Replace PROVISIONAL SCORE_CALIBRATION with live v3.0 data |
| 3    | `packages/backend/src/scoring/calibration/calibration.service.ts` | Update doc comment to v3.0                                |
| 4    | `.github/workflows/post-import-refresh.yml`                       | Add validate-scores job                                   |
| 5    | `.github/workflows/post-import-refresh.yml`                       | Add recalibrate-scores job                                |
| 6    | (none)                                                            | Run existing tests to verify no regressions               |

## Execution Notes

- Task 2 requires running a query against live Supabase to get current quintile excess returns. The temporary script queries `get_quintile_performance()` RPC and outputs the numbers to paste into `formula-weights.ts`.
- Tasks 4 and 5 both modify the same workflow file. They can be done in a single editing session but are listed separately for clarity.
- The two new CI jobs (`validate-scores` and `recalibrate-scores`) run in parallel after `run-scoring-pipeline` completes, since neither depends on the other.
