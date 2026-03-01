# PropertyIQ Backtest Fix List

**Purpose:** Ensure scores, training, and validation all target the same thing every month.  
**Rule:** Whatever the model trains on must be exactly what validation measures and exactly what marketing claims.

---

## 🔴 FIX 0: Rotate Database Password (DO NOW)

Both files have your Supabase password hardcoded and the repo is now public.

**Files:**
- `scripts/analysis/optimize_weights.py` — line 127
- `scripts/analysis/validate_scores.py` — line 65
- `scripts/analysis/backfill_z_scores.py` — line 61

**Action:**
1. Rotate the Supabase DB password immediately in your Supabase dashboard
2. Replace all three hardcoded defaults with empty string:
   ```python
   password = os.environ.get("SUPABASE_DB_PASSWORD", "")
   ```
3. Store the new password in a `.env` file (already gitignored) or use environment variables exclusively
4. Audit git history — the old password is in every commit. Consider using `git filter-repo` to scrub it, or treat the old password as permanently compromised

---

## 🔴 FIX 1: InvestorEdge Training Target — Add Rent Benchmark

**The problem:**  
`optimize_weights.py` line 164-168 defines the InvestorEdge target as:
```
excess_vs_state_3y + rent_return_3y_cagr
```
This adds **absolute rent return** to **excess appreciation**. The rent component is not benchmarked. A market with 8% rent growth in a state where every market got 8% rent growth gets credit for 8%, when its alpha is actually 0%.

**The fix:**  
You already have `state_rent_return_3y_cagr` in the backtest outcomes table (populated in `repopulate-backtest-outcomes.sql` Phase 5b). Use it.

**File:** `scripts/analysis/optimize_weights.py`  
**Lines:** 160-168

**Replace:**
```python
    # Determine target column based on score type
    if score_type == "homeready":
        target_expr = "bo.excess_vs_state_3y"
        target_alias = "target"
    else:
        # investoredge: 3Y total return excess = appreciation excess + rent yield excess
        target_expr = """CASE WHEN bo.rent_return_3y_cagr IS NOT NULL
            THEN (bo.excess_vs_state_3y + bo.rent_return_3y_cagr)
            ELSE bo.excess_vs_state_3y END"""
        target_alias = "target"
```

**With:**
```python
    # Determine target column based on score type
    if score_type == "homeready":
        target_expr = "bo.excess_vs_state_3y"
        target_alias = "target"
    else:
        # investoredge: 3Y total return excess = appreciation excess + rent excess
        # Both components benchmarked against state to measure true alpha
        target_expr = """CASE
            WHEN bo.rent_return_3y_cagr IS NOT NULL
                 AND bo.state_rent_return_3y_cagr IS NOT NULL
            THEN bo.excess_vs_state_3y + (bo.rent_return_3y_cagr - bo.state_rent_return_3y_cagr)
            ELSE bo.excess_vs_state_3y
            END"""
        target_alias = "target"
```

**Why:** Now both halves of the InvestorEdge target measure excess vs state. The model learns to identify markets that outperform their state peers on BOTH appreciation AND rent — which is actual alpha.

---

## 🔴 FIX 2: Validation Must Use Same Benchmark as Training

**The problem:**  
Training targets `excess_vs_state_3y` (state benchmark). But `validate_scores.py` defaults to `benchmark="division"`, so the headline in-sample Spearman ρ and IC are computed against Census Division excess returns. The OOS metrics come from `optimized_weights.json` which trained on state. The degradation ratio divides OOS-on-state by IS-on-division — two different targets.

**The fix:**  
Force validation to run against the state benchmark as the PRIMARY report. Division can be a secondary comparison.

**File:** `scripts/analysis/validate_scores.py`  
**Lines:** 1076-1078

**Replace:**
```python
    if args.benchmark == "both":
        benchmarks = ["division", "state"]
    else:
        benchmarks = [args.benchmark]
```

**With:**
```python
    if args.benchmark == "both":
        benchmarks = ["state", "division"]  # state first = primary (matches training target)
    else:
        benchmarks = [args.benchmark]
```

And change the CLI default:

**Lines:** 1033-1036

**Replace:**
```python
    parser.add_argument(
        "--benchmark",
        choices=["division", "state", "both"],
        default="both",
        help="Benchmark level for excess returns (default: both)",
    )
```

**With:**
```python
    parser.add_argument(
        "--benchmark",
        choices=["state", "division", "both"],
        default="state",
        help="Benchmark level for excess returns (default: state, matches training target)",
    )
```

**Why:** The number you put on the website must come from measuring performance against the same target the model was trained on. If you train on state and validate on division, you're grading a Spanish test with a French answer key.

---

## 🔴 FIX 3: Validation InvestorEdge Target Must Match Training Target

**The problem:**  
`validate_scores.py` computes InvestorEdge total return excess at line 191-222 as:
```python
total_return_3y = outcome_3y + rent_return_3y_cagr  # absolute rent, not excess
excess_total_state_3y = total_return_3y - median(total_return_3y) within state
```
This cross-sectionally de-means total return within each state at validation time. But the training target in `optimize_weights.py` adds raw `rent_return_3y_cagr` to `excess_vs_state_3y` — those are different calculations that can produce different numbers for the same market.

After you apply Fix 1, the training target becomes: `excess_vs_state_3y + (rent_return_3y_cagr - state_rent_return_3y_cagr)`. The validation target should match exactly.

**File:** `scripts/analysis/validate_scores.py`  
**Lines:** 191-223

**Replace the total return and excess computation block with:**
```python
    # --- Total return excess vs state (matches training target in optimize_weights) ---
    # excess = (appreciation - state appreciation) + (rent - state rent)
    # This matches: excess_vs_state_3y + (rent_return_3y_cagr - state_rent_return_3y_cagr)
    if "state_rent_return_3y_cagr" not in df.columns:
        # If column missing from query, fall back to appreciation-only excess
        logger.warning("state_rent_return_3y_cagr not in data — InvestorEdge will use appreciation excess only")
        df["excess_total_state_3y"] = df["excess_state_3y"]
        df["excess_total_div_3y"] = df["excess_div_3y"]
    else:
        # Rent excess vs state = rent_return - state_rent_return
        df["rent_excess_state_3y"] = np.where(
            df["rent_return_3y_cagr"].notna() & df["state_rent_return_3y_cagr"].notna(),
            df["rent_return_3y_cagr"] - df["state_rent_return_3y_cagr"],
            0.0,  # No rent data = no rent alpha, fall back to appreciation excess only
        )

        # Total excess vs state = appreciation excess + rent excess
        df["excess_total_state_3y"] = np.where(
            df["excess_state_3y"].notna(),
            df["excess_state_3y"] + df["rent_excess_state_3y"],
            np.nan,
        )

        # Total excess vs division = appreciation excess + rent excess (same rent excess)
        df["excess_total_div_3y"] = np.where(
            df["excess_div_3y"].notna(),
            df["excess_div_3y"] + df["rent_excess_state_3y"],
            np.nan,
        )
```

**Also update the SQL query** in `load_backtest_data()` (line 87-109) to include `state_rent_return_3y_cagr`:

**Add to the SELECT list (after line 101):**
```sql
        bo.state_rent_return_3y_cagr::float,
```

---

## 🟡 FIX 4: Walk-Forward Window Overlap

**The problem:**  
`WALK_FORWARD_WINDOWS` (line 95-102) has 4 windows with overlapping test periods. If multiple windows produce results, the averaged OOS metrics are not independent. Today only 1 window has enough 3Y outcome data, but as time passes more windows will activate and the overlap will silently inflate OOS numbers.

**File:** `scripts/analysis/optimize_weights.py`  
**Lines:** 95-102

**Replace:**
```python
WALK_FORWARD_WINDOWS = [
    # Primary 24-month train / 12-month test
    (date(2020, 12, 1), date(2022, 11, 1), date(2022, 12, 1), date(2023, 11, 1)),
    (date(2021, 12, 1), date(2023, 11, 1), date(2023, 12, 1), date(2024, 11, 1)),
    # 6-month shifted windows for additional test periods
    (date(2021, 6, 1), date(2023, 5, 1), date(2023, 6, 1), date(2024, 5, 1)),
    (date(2021, 3, 1), date(2023, 2, 1), date(2023, 3, 1), date(2024, 2, 1)),
]
```

**With:**
```python
# Walk-forward windows: NON-OVERLAPPING test periods only.
# Each test period must not share any months with another test period.
# Add new windows as more 3Y outcome data becomes available.
WALK_FORWARD_WINDOWS = [
    # 24-month train / 12-month test, strictly non-overlapping tests
    (date(2020, 12, 1), date(2022, 11, 1), date(2022, 12, 1), date(2023, 11, 1)),
    (date(2021, 12, 1), date(2023, 11, 1), date(2023, 12, 1), date(2024, 11, 1)),
    # Add next window when 3Y outcomes exist through Nov 2025:
    # (date(2022, 12, 1), date(2024, 11, 1), date(2024, 12, 1), date(2025, 11, 1)),
]
```

**Why:** Non-overlapping test periods mean each OOS metric is independent. When you average them, the IC and quintile spread numbers are honest.

---

## 🟡 FIX 5: Document NaN-Fill Assumption

**The problem:**  
`optimize_weights.py` line 215 fills missing z-scores with 0.0. This treats "no data" as "perfectly average." If missingness correlates with market type (small/rural markets have more missing data), the model learns a biased signal.

**File:** `scripts/analysis/optimize_weights.py`  
**Line:** 215

**Add a comment and a coverage check after line 215:**
```python
    # Fill remaining NaN z-scores with 0 (neutral assumption: missing = average)
    # WARNING: If missingness correlates with market characteristics, this biases results
    df[z_cols] = df[z_cols].fillna(0.0)

    # Log missing data rates for audit trail
    for col in z_cols:
        missing_rate = (df[col] == 0.0).mean()  # includes true zeros + filled NaNs
        if missing_rate > 0.3:
            print(f"    [WARN] {col}: {missing_rate:.0%} zero/missing — may bias results")
```

No code change needed for now, but monitor these warnings. If any feature is >30% missing, consider dropping it from the candidate list for that geo level.

---

## 🟡 FIX 6: Add Automated Consistency Check

Create a pre-validation check that runs before every monthly update to catch target mismatches.

**New file:** `scripts/analysis/preflight_check.py`

```python
#!/usr/bin/env python3
"""
Pre-flight check: Ensure training target, validation target,
and marketing claims are all aligned before running monthly update.

Run this BEFORE optimize_weights.py and validate_scores.py.
Exit code 0 = all clear, 1 = mismatch detected.
"""

import sys

# Define the single source of truth
SCORE_CONFIGS = {
    "homeready": {
        "training_target": "excess_vs_state_3y",
        "validation_benchmark": "state",
        "claim": "Predicts which markets will have excess appreciation vs their state",
    },
    "investoredge": {
        "training_target": "excess_vs_state_3y + (rent_return_3y_cagr - state_rent_return_3y_cagr)",
        "validation_benchmark": "state",
        "claim": "Predicts which markets will have excess total return (appreciation + rent) vs their state",
    },
}


def check_optimize_weights():
    """Verify optimize_weights.py targets match config."""
    with open("scripts/analysis/optimize_weights.py", "r") as f:
        code = f.read()

    errors = []

    # HomeReady should target excess_vs_state_3y
    if 'excess_vs_state_3y' not in code:
        errors.append("optimize_weights.py: HomeReady target not found")

    # InvestorEdge should subtract state_rent_return_3y_cagr
    if 'state_rent_return_3y_cagr' not in code:
        errors.append("optimize_weights.py: InvestorEdge target missing state rent benchmark")

    return errors


def check_validate_scores():
    """Verify validate_scores.py computes excess the same way."""
    with open("scripts/analysis/validate_scores.py", "r") as f:
        code = f.read()

    errors = []

    if 'state_rent_return_3y_cagr' not in code:
        errors.append("validate_scores.py: InvestorEdge validation missing state rent benchmark")

    return errors


def main():
    print("=" * 60)
    print("  PropertyIQ Pre-Flight Consistency Check")
    print("=" * 60)

    all_errors = []
    all_errors.extend(check_optimize_weights())
    all_errors.extend(check_validate_scores())

    if all_errors:
        print("\n❌ CONSISTENCY ERRORS FOUND:")
        for e in all_errors:
            print(f"  - {e}")
        print("\nDo NOT run monthly update until these are fixed.")
        sys.exit(1)
    else:
        print("\n✅ All checks passed. Training target = Validation target.")
        for score_type, config in SCORE_CONFIGS.items():
            print(f"\n  {score_type.upper()}:")
            print(f"    Target:    {config['training_target']}")
            print(f"    Benchmark: {config['validation_benchmark']}")
            print(f"    Claim:     {config['claim']}")
        sys.exit(0)


if __name__ == "__main__":
    main()
```

---

## Monthly Update Runbook (After Fixes Applied)

Run in this exact order every month:

```bash
# 0. Pre-flight
python scripts/analysis/preflight_check.py || exit 1

# 1. Ingest new data (Zillow, Realtor, Census, etc.)
# (your existing ingestion pipeline)

# 2. Backfill z-scores for new month
python scripts/analysis/backfill_z_scores.py --geo-level all

# 3. Repopulate backtest outcomes with new data
psql $DATABASE_URL -f scripts/repopulate-backtest-outcomes.sql

# 4. Optimize weights (re-train with all available data)
python scripts/analysis/optimize_weights.py --score-type both --geo-level all

# 5. Validate (primary = state benchmark to match training)
python scripts/analysis/validate_scores.py --score-type both --geo-level all --benchmark state

# 6. Sanity check: OOS IC should be within 40% of in-sample IC
# If degradation > 50%, investigate before publishing
```

---

## Summary Table

| # | Severity | File | What's Wrong | What To Do |
|---|----------|------|-------------|------------|
| 0 | 🔴 SECURITY | 3 files | Hardcoded DB password in public repo | Rotate password, use env vars |
| 1 | 🔴 ACCURACY | optimize_weights.py | InvestorEdge trains on raw rent, not excess rent | Subtract `state_rent_return_3y_cagr` |
| 2 | 🔴 CONSISTENCY | validate_scores.py | Validates on division, trains on state | Default to `--benchmark state` |
| 3 | 🔴 CONSISTENCY | validate_scores.py | InvestorEdge validation computes total return differently than training | Match the excess computation exactly |
| 4 | 🟡 INTEGRITY | optimize_weights.py | Overlapping test windows | Use non-overlapping windows only |
| 5 | 🟡 TRANSPARENCY | optimize_weights.py | Silent NaN fill with 0 | Log warning when >30% missing |
| 6 | 🟡 PROCESS | New file | No automated consistency check | Add preflight_check.py to pipeline |

After applying fixes 1-3, you need to re-run `optimize_weights.py` and `validate_scores.py`. The InvestorEdge numbers will change because the target is now harder (true alpha vs partial beta). HomeReady numbers should stay the same.
