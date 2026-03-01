---
name: piq-validation-report
description: "Generate the PropertyIQ monthly validation report from backtest pipeline output. Use this skill whenever asked to create, update, regenerate, or review a PropertyIQ validation report, score validation report, backtest report, or monthly PIQ report. Also trigger when the user mentions validation metrics like IC, quintile spread, OOS results, or degradation in the context of PropertyIQ scores. This skill enforces strict rules about what numbers can appear, what claims are permitted, and how metrics must be sourced — preventing fabrication and inconsistency across monthly runs."
---

# PropertyIQ Validation Report Generator

## Overview

This skill generates the monthly PropertyIQ score validation report from structured JSON output files. The report summarizes how well PropertyIQ scores (HomeReady, InvestorEdge) predicted real estate excess returns in a walk-forward backtest.

**Critical context:** The model predicts **3-year excess returns vs state median**. Every number, claim, and table in the report must be consistent with this fact. Violations of this principle were found in prior reports (1Y raw returns as headlines, mixed benchmarks, fabricated editorial claims). This skill exists to prevent those errors from recurring.

## Before You Start

Read the reference files in this skill's `references/` directory:

1. **`references/data-dictionary.md`** — Defines every metric, where it comes from, and what it means
2. **`references/report-template.md`** — The exact section structure, table formats, and permitted language

Read both files completely before generating any content.

## Required Inputs

The report is generated from these files. Verify all exist before starting:

| File | Location | Contains |
|------|----------|----------|
| Validation JSON (state) | `scripts/analysis/output/validation_results_state.json` | IS metrics against state benchmark |
| Optimized weights (metro) | `scripts/analysis/output/optimized_weights.json` | OOS metrics, feature weights, window results |
| Optimized weights (county) | `scripts/analysis/output/optimized_weights_county.json` | County-level OOS metrics |
| Optimized weights (zip) | `scripts/analysis/output/optimized_weights_zip.json` | ZIP-level OOS metrics |
| Validation JSON (division) | `scripts/analysis/output/validation_results_division.json` | IS metrics against division benchmark (for Section 5) |

If any file is missing, state which file is missing and stop. Do not estimate or fabricate values.

## Absolute Rules

These rules override everything else. No exceptions.

### Rule 1: The Model Predicts 3Y Excess Returns vs State

| Score | Training Target | Benchmark | Horizon |
|-------|----------------|-----------|---------|
| HomeReady | `excess_vs_state_3y` | State median appreciation CAGR | 3 years |
| InvestorEdge | `excess_vs_state_3y + (rent_return_3y_cagr - state_rent_return_3y_cagr)` | State median total return CAGR | 3 years |

**NEVER** describe the model as predicting 1Y returns, raw returns, returns vs Census Division, or returns vs national median. Division metrics appear in Section 5 (within-state validation) as a comparison to the primary state benchmark.

### Rule 2: Every Number Must Have a Source

Every numeric value must come from the JSON output files listed above, or from a documented external source (e.g., Zillow ZHVI with month/year cited). If you cannot trace a number to a source file and field path, do not include it.

**Examples of what this means:**
- OOS IC → `optimized_weights.json` → `summary.avg_test_ic`
- IS Spearman r → `validation_results_state.json` → `[score_type].insample.spearman_r`
- Quintile spread → JSON → `insample.quintile_table` or `summary.avg_test_quintile_spread`
- Sample size → JSON → `n_with_target` or `summary.n_test`

### Rule 3: Dollar Values Come from Excess Spreads Only

```
CORRECT:  dollar_alpha = (Q5_excess - Q1_excess) / 100 × median_home_value
WRONG:    dollar_alpha = (Q5_raw_return - Q1_raw_return) / 100 × median_home_value
```

The model adds value over random selection within a state. Dollar impact measures that marginal value, not the total market return.

### Rule 4: Same Benchmark for IS and OOS

Degradation = `1 - (OOS IC on state) / (IS IC on state)`

Never divide OOS IC computed against one benchmark by IS IC computed against a different benchmark.

### Rule 5: No Editorial Beyond the Data

| Permitted | Prohibited |
|-----------|------------|
| "OOS IC = 0.159" | "This is a strong signal" |
| "Metro IE OOS IC (0.24) exceeds Metro HR (0.16)" | "InvestorEdge is the best model" |
| "County degradation is 52%, above 50% threshold" | "County results are concerning" |
| "Historically outperformed" | "Will outperform" |

State facts and flag thresholds. No superlatives, no forward-looking claims, no emotional framing.

## Prohibited Content (Anywhere in Report)

1. **1Y returns as headline metrics** — banned from executive summary, quintile tables, dollar impact
2. **Raw returns (beta) presented as model performance** — always use excess returns (alpha)
3. **ROE, leveraged returns, "on $X down payment" calculations** — adds unvalidated assumptions
4. **"Census Division" as the model's benchmark** — the model trains on state
5. **Fabricated confidence intervals** — only report CIs that appear in the JSON
6. **Superlatives** — "strongest," "best," "most powerful," "exceptional"
7. **Forward-looking language** — "will outperform," "expected to"
8. **Mixed-benchmark degradation** — OOS(state) / IS(division) is meaningless

## Report Generation Workflow

### Step 1: Load and Validate Inputs

```python
import json
from pathlib import Path

base = Path("scripts/analysis/output")
required = [
    base / "validation_results_state.json",
    base / "optimized_weights.json",
]

for f in required:
    if not f.exists():
        raise FileNotFoundError(f"Missing required file: {f}")

with open(base / "validation_results_state.json") as f:
    val_state = json.load(f)

with open(base / "optimized_weights.json") as f:
    oos_metro = json.load(f)
```

Load county and ZIP weight files similarly. Check that all expected keys exist.

### Step 2: Extract Metrics

For each score_type × geo_level combination, extract:

**From validation JSON (in-sample):**
- `insample.spearman_r` → IS Spearman correlation
- `insample.mean_ic` → IS mean Information Coefficient
- `insample.ic_ir` → IC Information Ratio
- `insample.ic_hit_rate` → % of periods with positive IC
- `insample.quintile_table` → 5-row quintile breakdown
- `insample.decile_spread` → top decile minus bottom decile excess return
- `n_with_target` → sample size

**From optimized_weights JSON (out-of-sample):**
- `summary.avg_test_ic` → OOS IC (averaged across windows)
- `summary.avg_test_quintile_spread` → OOS quintile spread in pp
- `summary.avg_test_hit_rate` → OOS hit rate
- `summary.bootstrap_significant` → boolean
- `summary.bootstrap_ci` → [lower, upper] 95% CI
- `stable_features` → list of features with weights and directions
- `window_results` → per-window detail

### Step 3: Generate Report

Follow the exact template in `references/report-template.md`. Fill in values from the extracted metrics. Do not add sections, rearrange sections, or add commentary not specified in the template.

### Step 4: Post-Generation Checklist

Before presenting the report, verify every item:

- [ ] All numeric values traceable to JSON files (spot-check at least 5)
- [ ] Benchmark labeled as "state" everywhere describing the model's target
- [ ] No 1Y returns in headline metrics or executive summary
- [ ] Dollar values derived from excess return spreads, not raw return spreads
- [ ] Degradation ratio uses same benchmark for IS and OOS
- [ ] Section numbering sequential with no gaps or duplicates
- [ ] InvestorEdge described as "excess total return vs state"
- [ ] Every quintile table column says "Excess Return (vs State)" or "Total Excess Return (vs State)"
- [ ] Known Limitations updated with any new WATCH/WARN flags
- [ ] Median home value source and date cited in dollar impact section

If any check fails, fix it before presenting the report.

## Output

Write the final report to: `scripts/analysis/output/validation_report.md`

The report is a Markdown file. See `references/report-template.md` for exact structure.

## Handling Edge Cases

**Missing geo-level weights file:** Report the gap. Show "N/A" for that geo level's OOS metrics. Do not estimate from other geo levels.

**InvestorEdge falls back to appreciation-only:** If `target_column` in the JSON shows `excess_state_3y` instead of `excess_total_state_3y`, note this explicitly: "InvestorEdge at [geo level] uses appreciation excess only due to insufficient rent data coverage."

**Limited walk-forward windows:** Windows are generated dynamically (24-month train, 12-month test, 1-year slide from Jan 2020) and require complete 3Y outcomes in the test period. The number of usable windows grows automatically each year. Report the exact count: "OOS metrics averaged across {N} walk-forward windows." If only 1 window ran, note this as a limitation.

**Bootstrap not significant:** Report "Not Significant" in the table. In limitations, note which combination failed and recommend monitoring.

**Quintile monotonicity breaks:** Flag in robustness checklist. Allow 1 adjacent swap as PASS; 2+ swaps as FAIL. Note the specific break in the quintile table with a footnote.
