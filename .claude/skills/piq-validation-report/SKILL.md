---
name: piq-validation-report
description: "Generate the PropertyIQ monthly validation report. Use this skill whenever asked to create, update, regenerate, or review the PropertyIQ validation report, score validation report, backtest report, or monthly PIQ report. This skill runs the backtest pipeline, reads the output JSON, and writes a complete validation_report.md. It enforces strict rules about what numbers can appear, what claims are permitted, and how metrics must be sourced — preventing fabrication and inconsistency across monthly runs."
---

# PropertyIQ Validation Report Generator

## What This Skill Does

Runs the PropertyIQ backtest pipeline and generates a validation report from the results. The report summarizes how well the single PropertyIQ Score predicted real estate excess returns.

> **NOTE:** The legacy 3-score system (HomeReady, InvestorEdge, MarketHealth) was replaced by a single PropertyIQ Score in March 2026. References to HomeReady/InvestorEdge in the report template and data dictionary below are from the legacy system and should be adapted to the single PropertyIQ Score when generating new reports.

## Before You Start

1. Read `references/report-template.md` in this skill's directory — it defines the exact report structure
2. Read `references/data-dictionary.md` in this skill's directory — it defines every metric and its JSON source path
3. Make sure you have database access (DATABASE_URL env var or Supabase credentials)

## Step 1: Run the Pipeline

Run these from the repo root. They generate the JSON files the report is built from.

```bash
# Generate optimized weights + OOS metrics for all geo levels
python scripts/analysis/optimize_weights.py --score-type both --output-dir scripts/analysis/output

# Generate in-sample validation metrics for both benchmarks
python scripts/analysis/validate_scores.py --benchmark both --output-dir scripts/analysis/output
```

Wait for both to complete. Verify these files exist before proceeding:

- `scripts/analysis/output/optimized_weights.json`
- `scripts/analysis/output/optimized_weights_county.json`
- `scripts/analysis/output/optimized_weights_zip.json`
- `scripts/analysis/output/validation_results_state.json`
- `scripts/analysis/output/validation_results_division.json`

If any file is missing, check the pipeline output for errors. Do not proceed without all five files.

## Step 2: Read the JSON Output

Load all five JSON files. Extract every metric you need using the paths documented in `references/data-dictionary.md`. Do not estimate, interpolate, or fabricate any value. If a field is missing from the JSON, write "N/A" in the report.

## Step 3: Write the Report

Write `scripts/analysis/output/validation_report.md` following the exact structure in `references/report-template.md`. Fill in every `{placeholder}` with data from the JSON files.

For dollar conversions, query the latest median home values from the database or use the most recent Zillow ZHVI values available. Cite the source month/year.

## Step 4: Run the Post-Generation Checklist

Before you're done, verify every item. If any check fails, fix the report.

- [ ] All numeric values traceable to the JSON files (spot-check at least 5 values against the raw JSON)
- [ ] Benchmark labeled as "state" everywhere describing the model's target
- [ ] No 1Y returns in headline metrics, executive summary, or dollar impact
- [ ] Dollar values derived from 3Y excess return spreads, not raw return spreads
- [ ] Degradation ratio uses state benchmark for both IS and OOS columns
- [ ] Section numbering sequential with no gaps or duplicates
- [ ] Score described as "excess return vs state" (not absolute rent + excess appreciation)
- [ ] Every quintile table column says "Excess Return (vs State)" or "Total Excess Return (vs State)"
- [ ] Known Limitations section updated with any new WATCH/WARN flags from the robustness checklist
- [ ] Median home value source and date cited in the dollar impact section
- [ ] The "Cost of Choosing Wrong" section (2.3) uses 3Y excess returns only, no ROE

## The Five Absolute Rules

These override everything else. If you find yourself about to violate one, stop and fix it.

### Rule 1: The Model Predicts 3Y Excess Returns vs State

| Score | Training Target | Benchmark | Horizon |
|-------|----------------|-----------|---------|
| PropertyIQ | `excess_vs_state_3y` | State median appreciation CAGR | 3 years |
| (Legacy) InvestorEdge | `excess_vs_state_3y + rent excess` | State median total return CAGR | 3 years |

**NEVER** describe the model as predicting 1Y returns, raw returns, returns vs Census Division, or returns vs national median. Division metrics appear only in Section 5 (within-state validation) as a comparison.

### Rule 2: Every Number Must Have a Source

Every numeric value comes from the pipeline JSON output or a documented external source (e.g., Zillow ZHVI with month/year). No exceptions.

### Rule 3: Dollar Values Come from Excess Spreads

```
CORRECT:  dollar_alpha = (Q5_excess - Q1_excess) / 100 × median_home_value
WRONG:    dollar_alpha = (Q5_raw_return - Q1_raw_return) / 100 × median_home_value
```

### Rule 4: Same Benchmark for IS and OOS Comparison

Degradation = `1 - (OOS IC on state) / (IS IC on state)`. Never mix benchmarks.

### Rule 5: No Editorial Beyond the Data

State facts and flag thresholds. No superlatives ("strongest," "best"). No forward-looking claims ("will outperform"). No emotional framing ("concerning").

## Prohibited Content (Anywhere in the Report)

1. 1Y returns as headline metrics
2. Raw returns (beta) presented as model performance — always use excess returns (alpha)
3. ROE, leveraged returns, "on $X down payment" calculations
4. "Census Division" as the model's benchmark (it trains on state)
5. Fabricated confidence intervals — only report CIs from the JSON
6. Superlatives — "strongest," "best," "most powerful," "exceptional"
7. Forward-looking language — "will outperform," "expected to"
8. Mixed-benchmark degradation — OOS(state) / IS(division) is meaningless

## Report Section Order

The report has exactly these sections. See `references/report-template.md` for full templates with placeholders.

1. **Executive Summary** — OOS results table, dollar impact range, limitations list. Max 20 lines.
2. **What the Scores Predict** — What alpha vs beta means. No marketing.
   - 2.1 HomeReady 3Y Excess Return Quintiles (in-sample, all data)
   - 2.2 InvestorEdge 3Y Excess Total Return Quintiles
   - 2.3 The Cost of Choosing Wrong (3Y excess dollars, no ROE)
3. **Out-of-Sample Results** — The most important section.
   - 3.1 Methodology (dynamic windows: 24mo train, 12mo test, 1yr slide from Jan 2020)
   - 3.2 OOS Results Table
   - 3.3 OOS Quintile Tables
   - 3.4 Dollar Impact (from OOS excess spreads)
   - 3.5 IC Degradation (same benchmark both columns)
4. **In-Sample Metrics** — Summary table + quintile tables per geo × score type
5. **Within-State Validation** — State vs Division benchmark comparison (required)
6. **Model Stability** — Feature weights + IC by year
7. **Calibration** — Decile tables + MAD. Always include the standard interpretation paragraph.
8. **Robustness Checklist** — Pass/fail matrix
9. **Known Limitations** — Each item cites a specific metric
10. **Appendix** — Coverage, data sources, source file listing, methodology notes

## Edge Cases

**InvestorEdge falls back to appreciation-only:** If `target_column` in the JSON shows `excess_state_3y` instead of `excess_total_state_3y`, note: "InvestorEdge at [geo level] uses appreciation excess only due to insufficient rent data coverage."

**Partial walk-forward window:** The dynamic window generator may produce windows where only some test-period scores have complete 3Y outcomes. The pipeline handles this (skips rows, runs if ≥20 remain). Report the actual N per window from the JSON.

**Bootstrap not significant:** Report "Not Significant." Add to limitations.

**Quintile monotonicity breaks:** 1 adjacent swap = PASS. 2+ swaps = FAIL. Note the specific break.
