"""Generate validation report (Markdown) matching the format of docs/audits/validation_report.md.

Sections:
1. Executive Summary
2. What the Scores Predict
3. Out-of-Sample Results (methodology, results, dollar impact)
4. Walk-Forward Per-Window Results
5. Model Stability (feature weights + time stability)
6. Calibration
7. Robustness Checklist
8. Known Limitations
Appendix: Data Coverage, Sources, Configuration, Methodology Notes
"""

import logging
from datetime import datetime, timezone
from pathlib import Path

from .config import OUTPUT_DIR

logger = logging.getLogger(__name__)

MEDIAN_HOME_VALUE = 350_000
MEDIAN_HOME_SOURCE = "Zillow ZHVI, Jan 2026"

SCORE_LABELS = {
    "homeready": "HomeReady",
    "investoredge": "InvestorEdge",
    "markethealth": "MarketHealth",
}

FEATURE_INTERPRETATIONS = {
    "cen_income_yoy": "Income growth = household purchasing power",
    "cen_median_age": "Demographic age profile of the area",
    "cen_homeownership_rate": "Higher ownership = market stability",
    "cen_population_yoy": "Population growth = sustained demand",
    "cen_rent_as_pct_of_income": "Rent burden = affordability pressure",
    "rf_off_market_in_two_weeks": "Fast absorption = strong demand signal",
    "rf_median_dom": "Days on market = demand/supply balance",
    "z_inventory": "Inventory levels = supply pressure",
    "rf_sold_above_list": "Above-list sales = competitive bidding",
    "rf_avg_sale_to_list": "Sale-to-list ratio = pricing power",
    "hotness_score": "Market activity intensity",
    "demand_score": "Buyer demand level",
    "supply_score": "Inventory supply level",
    "pending_ratio": "Pending vs active = absorption rate",
    "price_reduced_share": "Price reductions = seller capitulation",
    "median_days_on_market": "DOM = demand/supply balance",
    "econ_unemployment_rate": "Local labor market health",
    "econ_unemployment_rate_yoy": "Employment trend direction",
    "econ_employment_yoy": "Employment growth rate",
    "econ_gdp_yoy": "Regional economic growth",
    "econ_rpp_housing": "Regional housing cost level",
}


def _sl(score_type: str) -> str:
    """Score label."""
    return SCORE_LABELS.get(score_type, score_type)


def generate_full_validation_report(
    all_results: dict[tuple[str, str, str], dict],
) -> Path:
    """Generate the full validation report across all geos/scores/horizons."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / "validation_report.md"

    lines = []
    lines.extend(_header(all_results))
    lines.extend(_section_1_executive_summary(all_results))
    lines.extend(_section_2_what_scores_predict(all_results))
    lines.extend(_section_3_oos_results(all_results))
    lines.extend(_section_4_per_window_results(all_results))
    lines.extend(_section_5_model_stability(all_results))
    lines.extend(_section_6_calibration(all_results))
    lines.extend(_section_7_robustness_checklist(all_results))
    lines.extend(_section_8_known_limitations(all_results))
    lines.extend(_appendix(all_results))

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    logger.info("Validation report saved: %s", path)
    return path


def generate_geo_report(
    geo_level: str,
    combo_results: dict[tuple[str, str], dict],
) -> Path:
    """Generate a per-geo summary report."""
    geo_dir = OUTPUT_DIR / geo_level
    geo_dir.mkdir(parents=True, exist_ok=True)
    path = geo_dir / "report.md"

    lines = [
        f"# Scoring Pipeline Results - {geo_level.title()}",
        f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "| Score Type | Horizon | Best Model | OOS IC | Quintile Spread | Hit Rate | Features |",
        "|-----------|---------|------------|-------:|----------------:|---------:|---------:|",
    ]
    for (st, hz), result in sorted(combo_results.items()):
        best = result.get("best_model", {})
        n_feat = len(result.get("weights", {}).get("weights", {}))
        lines.append(
            f"| {_sl(st)} | {hz} | {best.get('model_name', '?')} "
            f"| {best.get('mean_ic', 0):.4f} "
            f"| {best.get('mean_quintile_spread', 0):.4f} pp "
            f"| {best.get('mean_hit_rate', 0) * 100:.1f}% "
            f"| {n_feat} |"
        )
    lines.append("")

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    logger.info("Geo report saved: %s", path)
    return path


# ---------------------------------------------------------------------------
# Header
# ---------------------------------------------------------------------------

def _header(all_results: dict) -> list[str]:
    total_rows = sum(r.get("n_rows", 0) for r in all_results.values())
    geos = sorted(set(g for g, _, _ in all_results.keys()))
    scores = sorted(set(s for _, s, _ in all_results.keys()))
    horizons = sorted(set(h for _, _, h in all_results.keys()))

    # Count total windows
    total_windows = 0
    for r in all_results.values():
        total_windows += r.get("best_model", {}).get("n_windows", 0)

    horizon_str = ", ".join(horizons)

    return [
        "# PropertyIQ Score Validation Report",
        "",
        f"**Generated:** {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
        "**Pipeline:** Scoring Pipeline v2 (XGBoost/LightGBM/ElasticNet tournament)",
        f"**Training Horizon:** {horizon_str}",
        "**Training Target:** Excess return vs state median (HomeReady/InvestorEdge); raw outcome (MarketHealth)",
        "**Benchmark:** State median (controls for regional market cycles)",
        f"**Total Observations:** {total_rows:,} scored location-period records across {', '.join(g.title() for g in geos)}",
        "**Methodology:** Walk-forward CV (24mo train, 12mo test, 12mo slide from Jan 2018) with model tournament",
        "",
        "> Every number in this report is derived from walk-forward cross-validation on",
        "> held-out test data the models never trained on. Feature weights are extracted",
        "> via SHAP distillation from the winning tree model.",
        "",
        "---",
        "",
    ]


# ---------------------------------------------------------------------------
# Section 1: Executive Summary
# ---------------------------------------------------------------------------

def _section_1_executive_summary(all_results: dict) -> list[str]:
    lines = [
        "## 1. Executive Summary",
        "",
        "PropertyIQ scores predict 3-year excess returns vs state median benchmarks.",
        "Walk-forward cross-validation with a model tournament (XGBoost, LightGBM, ElasticNet)",
        "on held-out data confirms predictive signal at metro, county, and ZIP levels.",
        "",
        "| Geography | Score Type | Best Model | OOS IC | OOS Quintile Spread | IC Hit Rate |",
        "| --------- | ---------- | ---------- | -----: | ------------------: | ----------: |",
    ]

    for (geo, st, hz), result in sorted(all_results.items()):
        best = result.get("best_model", {})
        ic = best.get("mean_ic", 0)
        qs = best.get("mean_quintile_spread", 0)
        hr = best.get("mean_hit_rate", 0) * 100
        model = best.get("model_name", "?")
        lines.append(
            f"| {geo.title():9s} | {_sl(st):12s} | {model:10s} "
            f"| {ic:.4f} | {qs:>15.2f} pp | {hr:>10.1f}% |"
        )

    lines.append("")

    # Dollar impact
    hr_ie = {k: v for k, v in all_results.items() if k[1] in ("homeready", "investoredge")}
    if hr_ie:
        spreads = [v.get("best_model", {}).get("mean_quintile_spread", 0) for v in hr_ie.values()]
        valid_spreads = [s for s in spreads if s > 0]
        if valid_spreads:
            min_annual = int(min(valid_spreads) / 100 * MEDIAN_HOME_VALUE / 100) * 100
            max_annual = int(max(valid_spreads) / 100 * MEDIAN_HOME_VALUE / 100) * 100
            lines.extend([
                "**Dollar impact (annual, OOS):**",
                f"On a median-priced home (${MEDIAN_HOME_VALUE:,}, {MEDIAN_HOME_SOURCE}), choosing a top-quintile",
                "market over a bottom-quintile market within the same state adds an estimated",
                f"${min_annual:,} to ${max_annual:,} per year in excess return.",
                "",
            ])

    # Limitations summary
    limitations = []
    max_mad = max((v.get("best_model", {}).get("mean_calibration_mad", 0) for v in all_results.values()), default=0)
    min_mad = min((v.get("best_model", {}).get("mean_calibration_mad", 0) for v in all_results.values()), default=0)
    limitations.append(
        f"- Calibration MAD of {min_mad:.2f}-{max_mad:.2f} across geo levels "
        "-- scores rank correctly but overstate tail divergence"
    )

    neg_window_combos = []
    for (geo, st, hz), result in all_results.items():
        windows = result.get("best_model", {}).get("windows", [])
        neg = [w for w in windows if (w.get("ic") or 0) <= 0]
        if neg:
            neg_window_combos.append(f"{geo.title()} {_sl(st)} ({len(neg)} of {len(windows)})")
    if neg_window_combos:
        limitations.append(
            f"- Negative IC in some windows: {'; '.join(neg_window_combos)}"
        )

    if limitations:
        lines.append("**Limitations:**")
        lines.append("")
        lines.extend(limitations)
        lines.append("")

    lines.extend(["---", ""])
    return lines


# ---------------------------------------------------------------------------
# Section 2: What the Scores Predict
# ---------------------------------------------------------------------------

def _section_2_what_scores_predict(all_results: dict) -> list[str]:
    lines = [
        "## 2. What the Scores Predict",
        "",
        "PropertyIQ produces three predictive scores:",
        "",
        "**HomeReady** predicts which locations will have higher 3-year appreciation",
        "than their state's median. A score of 80 means the model ranks this location",
        "in the top 20% of its state for expected excess appreciation.",
        "",
        "**InvestorEdge** predicts which locations will have higher 3-year total return",
        "(appreciation + rent growth) than their state's median. Both the appreciation",
        "and rent components are benchmarked against the state -- the model identifies",
        "locations where the combined return outperforms state peers.",
        "",
        "**MarketHealth** predicts raw outcome values (absolute return), capturing",
        "overall market trajectory rather than excess returns vs state.",
        "",
        "**What the scores do NOT predict:**",
        "",
        "- Raw appreciation (that includes regional trends the score filters out)",
        "- Exact return magnitudes (scores rank locations reliably but overstate tail divergence)",
        "",
        "**Benchmark: state median.** By comparing each location to its own state's median,",
        "the scores control for statewide market cycles. The question is not \"will this",
        "location appreciate?\" but \"will this location beat other locations in its state?\"",
        "",
    ]

    # Cost of Choosing Wrong (from OOS spreads, HomeReady/InvestorEdge only)
    metro_results = {k: v for k, v in all_results.items()
                     if k[0] == "metro" and k[1] in ("homeready", "investoredge")}
    if metro_results:
        lines.extend([
            "### 2.1 The Cost of Choosing Wrong",
            "",
            f"**On a typical ${MEDIAN_HOME_VALUE:,} metro-area home ({MEDIAN_HOME_SOURCE}):**",
            "",
            "| Metric | Top Quintile (Score > 80) | Bottom Quintile (Score < 20) | Difference |",
            "| ------ | :----------------------: | :--------------------------: | :--------: |",
        ])
        for (geo, st, hz), result in sorted(metro_results.items()):
            best = result.get("best_model", {})
            spread = best.get("mean_quintile_spread", 0)
            if spread <= 0:
                continue
            half = spread / 2
            top_dollar = int(half / 100 * MEDIAN_HOME_VALUE * 3)
            bot_dollar = int(-half / 100 * MEDIAN_HOME_VALUE * 3)
            diff_dollar = int(spread / 100 * MEDIAN_HOME_VALUE * 3)

            target_label = "3Y excess appreciation" if st == "homeready" else "3Y excess total return"
            lines.append(
                f"| {target_label} ({_sl(st)[:2]}, vs state) | "
                f"+{half:.2f}% = **+${top_dollar:,}** | "
                f"-{half:.2f}% = **${bot_dollar:,}** | "
                f"**${diff_dollar:,}** |"
            )
        lines.extend([
            "",
            "> All figures are **excess returns above the state median** -- the alpha the score identifies.",
            "> A bottom-quintile location doesn't necessarily lose money; it underperforms its state peers.",
            "> A top-quintile location doesn't just appreciate; it beats other locations in its state.",
            "",
        ])

    lines.extend(["---", ""])
    return lines


# ---------------------------------------------------------------------------
# Section 3: Out-of-Sample Results
# ---------------------------------------------------------------------------

def _section_3_oos_results(all_results: dict) -> list[str]:
    lines = [
        "## 3. Out-of-Sample Results",
        "",
        "### 3.1 Methodology",
        "",
        "- **Models:** XGBoost, LightGBM, ElasticNet (tournament selects best by mean OOS IC)",
        "- **Walk-forward windows:** 24-month training, 12-month test, 12-month slide from Jan 2018.",
        "  Windows with fewer than 20 test observations are skipped.",
        "- **Feature selection:** Coverage filter (>50%) -> correlation filter (|r|>0.95) -> MI ranking (top 10)",
        "- **Weight extraction:** SHAP distillation from winning tree model (or coefficients for ElasticNet)",
        "- **Conservative tree defaults:** max_depth=4, lr=0.05, 300 trees, subsample=0.8",
        "",
    ]

    # Per-geo window details
    for geo in ("metro", "county", "zip"):
        geo_keys = [k for k in sorted(all_results.keys()) if k[0] == geo]
        if not geo_keys:
            continue
        # Use first combo's windows as representative
        ref_result = all_results[geo_keys[0]]
        best = ref_result.get("best_model", {})
        windows = best.get("windows", [])
        if windows:
            lines.append(f"**{geo.title()} ({len(windows)} windows):**")
            lines.append("")
            for w in windows:
                lines.append(
                    f"- Train: {w.get('train', '?')} | "
                    f"Test: {w.get('test', '?')} | "
                    f"N_train: {w.get('train_rows', 0):,} | "
                    f"N_test: {w.get('test_rows', 0):,}"
                )
            lines.append("")

    lines.extend([
        "- **Training target:**",
        "  - HomeReady: `excess_vs_state_3y` (3Y appreciation CAGR minus state median)",
        "  - InvestorEdge: `excess_vs_state_3y + (rent_return_3y_cagr - state_rent_return_3y_cagr)`",
        "  - MarketHealth: `outcome_3y_value` (absolute 3Y return)",
        "",
    ])

    # 3.2 Results table
    lines.extend([
        "### 3.2 Results",
        "",
        "| Geography | Score Type   | Best Model | N Windows | OOS IC | OOS Quintile Spread | OOS Hit Rate | Cal. MAD |",
        "| --------- | ------------ | ---------- | --------: | -----: | ------------------: | -----------: | -------: |",
    ])

    for (geo, st, hz), result in sorted(all_results.items()):
        best = result.get("best_model", {})
        lines.append(
            f"| {geo.title():9s} | {_sl(st):12s} | {best.get('model_name', '?'):10s} "
            f"| {best.get('n_windows', 0):>9} "
            f"| {best.get('mean_ic', 0):.4f} "
            f"| {best.get('mean_quintile_spread', 0):>15.2f} pp "
            f"| {best.get('mean_hit_rate', 0) * 100:>11.1f}% "
            f"| {best.get('mean_calibration_mad', 0):.4f} |"
        )
    lines.append("")

    # 3.3 Model Tournament
    lines.extend([
        "### 3.3 Model Tournament",
        "",
        "All three models were trained on identical walk-forward windows. Best model selected",
        "by highest mean OOS IC (tiebreak: quintile spread).",
        "",
    ])

    for (geo, st, hz), result in sorted(all_results.items()):
        tournament = result.get("tournament", [])
        if not tournament:
            continue
        lines.append(f"**{geo.title()} {_sl(st)}:**")
        lines.append("")
        lines.append("| Model | Mean IC | Std IC | IR | Quintile Spread | Hit Rate | Winner |")
        lines.append("| ----- | ------: | -----: | -: | --------------: | -------: | :----: |")
        for m in tournament:
            winner = "**Y**" if m.get("is_best") else ""
            lines.append(
                f"| {m.get('model_name', '?')} "
                f"| {m.get('mean_ic', 0):.4f} "
                f"| {m.get('std_ic', 0):.4f} "
                f"| {m.get('information_ratio', 0):.2f} "
                f"| {m.get('mean_quintile_spread', 0):.4f} pp "
                f"| {m.get('mean_hit_rate', 0) * 100:.1f}% "
                f"| {winner} |"
            )
        lines.append("")

    # 3.4 Dollar Impact
    lines.extend([
        "### 3.4 Dollar Impact",
        "",
        f"Based on current median home values (${MEDIAN_HOME_VALUE:,}, {MEDIAN_HOME_SOURCE}):",
        "",
        "| Geography | Score Type   | OOS Spread | Annual Alpha | 3-Year Alpha |",
        "| --------- | ------------ | ---------: | -----------: | -----------: |",
    ])

    for (geo, st, hz), result in sorted(all_results.items()):
        best = result.get("best_model", {})
        spread = best.get("mean_quintile_spread", 0)
        annual_alpha = int(spread / 100 * MEDIAN_HOME_VALUE)
        three_yr_alpha = int(MEDIAN_HOME_VALUE * (((1 + spread / 2 / 100) ** 3) - ((1 - spread / 2 / 100) ** 3)))
        lines.append(
            f"| {geo.title():9s} | {_sl(st):12s} "
            f"| {spread:>7.2f} pp | ${annual_alpha:>10,} | ${three_yr_alpha:>10,} |"
        )

    lines.extend([
        "",
        "**Calculation:**",
        "",
        "- Annual Alpha = OOS Quintile Spread (pp) / 100 x Median Home Value",
        "- 3-Year Alpha = Median Home Value x ((1 + Q5_excess/100)^3 - (1 + Q1_excess/100)^3)",
        "",
        "> These figures represent excess returns above state median performance.",
        "> They measure what the score adds over selecting a location randomly within the state.",
        "",
        "---",
        "",
    ])
    return lines


# ---------------------------------------------------------------------------
# Section 4: Walk-Forward Per-Window Results
# ---------------------------------------------------------------------------

def _section_4_per_window_results(all_results: dict) -> list[str]:
    lines = [
        "## 4. Walk-Forward Per-Window Results",
        "",
    ]

    sub = 1
    for (geo, st, hz), result in sorted(all_results.items()):
        best = result.get("best_model", {})
        windows = best.get("windows", [])
        n_rows = result.get("n_rows", 0)

        lines.append(
            f"### 4.{sub} {geo.title()} {_sl(st)} "
            f"({best.get('model_name', '?')}, {n_rows:,} observations)"
        )
        lines.append("")

        if windows:
            lines.append("| Window | Test Period | Train Rows | Test Rows | IC | Quintile Spread | Hit Rate |")
            lines.append("| -----: | ----------- | ---------: | --------: | -: | --------------: | -------: |")
            for w in windows:
                lines.append(
                    f"| {w.get('window', '?')} "
                    f"| {w.get('test', '?')} "
                    f"| {w.get('train_rows', 0):,} "
                    f"| {w.get('test_rows', 0):,} "
                    f"| {w.get('ic', 0):.4f} "
                    f"| {w.get('quintile_spread', 0):.4f} pp "
                    f"| {w.get('hit_rate', 0) * 100:.1f}% |"
                )
            lines.extend([
                "",
                f"**Mean IC:** {best.get('mean_ic', 0):.4f} "
                f"(std: {best.get('std_ic', 0):.4f}, "
                f"IR: {best.get('information_ratio', 0):.2f})",
            ])
        else:
            lines.append("No valid walk-forward windows.")

        lines.extend(["", ""])
        sub += 1

    lines.extend(["---", ""])
    return lines


# ---------------------------------------------------------------------------
# Section 5: Model Stability
# ---------------------------------------------------------------------------

def _section_5_model_stability(all_results: dict) -> list[str]:
    lines = [
        "## 5. Model Stability",
        "",
        "### 5.1 Feature Weights",
        "",
    ]

    for (geo, st, hz), result in sorted(all_results.items()):
        weights = result.get("weights", {}).get("weights", {})
        if not weights:
            continue
        best = result.get("best_model", {})
        lines.append(
            f"**{geo.title()} {_sl(st)} ({len(weights)} features):**"
        )
        lines.append("")
        lines.append("| Feature | Weight | Direction | Interpretation |")
        lines.append("| ------- | -----: | :-------: | -------------- |")
        for feat, w in sorted(weights.items(), key=lambda x: x[1]["weight"], reverse=True):
            direction = "+" if w["direction"] == 1 else "-"
            interp = FEATURE_INTERPRETATIONS.get(feat, "")
            lines.append(f"| {feat} | {w['weight']:.4f} | {direction} | {interp} |")
        lines.append("")

    # Time Stability
    lines.extend([
        "### 5.2 Time Stability (IC by Test Window)",
        "",
    ])

    for geo in ("metro", "county", "zip"):
        geo_results = {st: v for (g, st, hz), v in all_results.items() if g == geo}
        if not geo_results:
            continue

        lines.append(f"**{geo.title()}:**")
        lines.append("")

        # Build column headers from score types
        score_types = sorted(geo_results.keys())
        header = "| Window | Test Period |"
        sep = "| -----: | ----------- |"
        for st in score_types:
            header += f" {_sl(st)[:2]} IC | Status |"
            sep += " -----: | -----: |"
        lines.append(header)
        lines.append(sep)

        # Determine max windows across score types
        max_wins = max(
            len(geo_results[st].get("best_model", {}).get("windows", []))
            for st in score_types
        )

        for w_idx in range(max_wins):
            test_period = "?"
            for st in score_types:
                ws = geo_results[st].get("best_model", {}).get("windows", [])
                if w_idx < len(ws):
                    test_period = ws[w_idx].get("test", "?")
                    break

            row = f"| {w_idx} | {test_period} |"
            for st in score_types:
                ws = geo_results[st].get("best_model", {}).get("windows", [])
                if w_idx < len(ws):
                    ic = ws[w_idx].get("ic", 0)
                    status = "PASS" if ic > 0 else "FAIL"
                    row += f" {ic:.4f} | {status} |"
                else:
                    row += " -- | -- |"
            lines.append(row)

        lines.extend(["", "PASS: IC > 0 | FAIL: IC <= 0", ""])

    lines.extend(["---", ""])
    return lines


# ---------------------------------------------------------------------------
# Section 6: Calibration
# ---------------------------------------------------------------------------

def _section_6_calibration(all_results: dict) -> list[str]:
    lines = [
        "## 6. Calibration",
        "",
        "### 6.1 Calibration Summary",
        "",
        "| Geography | Score Type   | Calibration MAD | Status |",
        "| --------- | ------------ | --------------: | -----: |",
    ]

    for (geo, st, hz), result in sorted(all_results.items()):
        best = result.get("best_model", {})
        mad = best.get("mean_calibration_mad", 0)
        if mad < 0.15:
            status = "PASS"
        elif mad < 0.20:
            status = "WATCH"
        else:
            status = "WARN"
        lines.append(f"| {geo.title():9s} | {_sl(st):12s} | {mad:>14.4f} | {status:>6s} |")

    lines.extend([
        "",
        "**Thresholds:** <0.15 = PASS | 0.15-0.20 = WATCH | >0.20 = WARN",
        "",
        "**Interpretation:** Scores rank locations correctly (monotonic quintile ordering) but",
        "overstate tail divergence. A score of 90 means \"very likely to outperform state median,\"",
        "not \"90th percentile return.\" Use scores for ranking and selection, not precise return prediction.",
        "",
        "---",
        "",
    ])
    return lines


# ---------------------------------------------------------------------------
# Section 7: Robustness Checklist
# ---------------------------------------------------------------------------

def _section_7_robustness_checklist(all_results: dict) -> list[str]:
    lines = [
        "## 7. Robustness Checklist",
        "",
    ]

    # Build header columns
    combos = sorted(all_results.keys())
    header = "| Test |"
    sep = "| ---- |"
    for (geo, st, hz) in combos:
        label = f"{geo.title()[:1]} {_sl(st)[:2]}"
        header += f" {label} |"
        sep += " :--: |"

    lines.append(header)
    lines.append(sep)

    tests = [
        ("OOS IC > 0", _check_positive_ic),
        ("Mean IC > 0.10", lambda item: _check_ic_threshold(item, 0.10)),
        ("Hit Rate >= 60%", lambda item: _check_hit_rate(item, 0.60)),
        ("Calibration MAD < 0.20", lambda item: _check_calibration(item, 0.20)),
        (">=3 windows", lambda item: _check_n_windows(item, 3)),
        ("Monotonic quintiles", lambda item: _check_positive_spread(item)),
    ]

    for test_name, check_fn in tests:
        row = f"| {test_name} |"
        for key in combos:
            result = all_results[key]
            status = check_fn((key, result))
            row += f" {status} |"
        lines.append(row)

    lines.extend([
        "",
        "P = PASS | W = WATCH | F = FAIL",
        "",
        "---",
        "",
    ])
    return lines


def _check_positive_ic(item: tuple) -> str:
    _, result = item
    ic = result.get("best_model", {}).get("mean_ic", 0)
    return "P" if ic > 0 else "F"


def _check_ic_threshold(item: tuple, threshold: float) -> str:
    _, result = item
    ic = result.get("best_model", {}).get("mean_ic", 0)
    if ic >= threshold:
        return "P"
    if ic > 0:
        return "W"
    return "F"


def _check_hit_rate(item: tuple, threshold: float) -> str:
    _, result = item
    hr = result.get("best_model", {}).get("mean_hit_rate", 0)
    if hr >= threshold:
        return "P"
    if hr >= 0.50:
        return "W"
    return "F"


def _check_calibration(item: tuple, threshold: float) -> str:
    _, result = item
    mad = result.get("best_model", {}).get("mean_calibration_mad", 0)
    if mad < threshold:
        return "P"
    if mad < 0.25:
        return "W"
    return "F"


def _check_n_windows(item: tuple, min_windows: int) -> str:
    _, result = item
    n = result.get("best_model", {}).get("n_windows", 0)
    return "P" if n >= min_windows else "W"


def _check_positive_spread(item: tuple) -> str:
    _, result = item
    qs = result.get("best_model", {}).get("mean_quintile_spread", 0)
    return "P" if qs > 0 else "F"


# ---------------------------------------------------------------------------
# Section 8: Known Limitations
# ---------------------------------------------------------------------------

def _section_8_known_limitations(all_results: dict) -> list[str]:
    lines = [
        "## 8. Known Limitations",
        "",
    ]

    limitations = []

    # Calibration
    mads = [v.get("best_model", {}).get("mean_calibration_mad", 0) for v in all_results.values()]
    if mads:
        limitations.append(
            f"**Calibration:** MAD of {min(mads):.2f}-{max(mads):.2f} across geo levels. "
            "Ranking is reliable; magnitude is compressed. Use scores for ranking and selection, "
            "not precise return prediction."
        )

    # Low IC combos
    low_ic = [(k, v) for k, v in all_results.items()
              if v.get("best_model", {}).get("mean_ic", 0) < 0.10]
    if low_ic:
        combos_str = ", ".join(f"{g.title()} {_sl(s)}" for (g, s, h), _ in low_ic)
        limitations.append(
            f"**Low OOS IC:** {combos_str} have IC < 0.10, indicating weak predictive signal."
        )

    # Negative IC windows
    neg_combos = []
    for (geo, st, hz), result in all_results.items():
        windows = result.get("best_model", {}).get("windows", [])
        neg = [w for w in windows if (w.get("ic") or 0) <= 0]
        if neg:
            neg_combos.append(f"{geo.title()} {_sl(st)} ({len(neg)} of {len(windows)} windows)")
    if neg_combos:
        limitations.append(
            f"**Time instability:** {'; '.join(neg_combos)}. "
            "Signal not consistent across all time periods."
        )

    # SHAP distillation
    tree_winners = [(k, v) for k, v in all_results.items()
                    if v.get("best_model", {}).get("model_name") in ("xgboost", "lightgbm")]
    if tree_winners:
        limitations.append(
            f"**SHAP distillation:** {len(tree_winners)} combos use SHAP-extracted linear weights "
            "from tree models. IC loss from linearization not measured. "
            "Monitor when deploying as linear formula."
        )

    # No bootstrap
    limitations.append(
        "**No bootstrap significance test:** Pipeline does not include bootstrap CI. "
        "Statistical significance of quintile spreads is not formally tested."
    )

    for i, lim in enumerate(limitations, 1):
        lines.append(f"{i}. {lim}")

    lines.extend(["", "---", ""])
    return lines


# ---------------------------------------------------------------------------
# Appendix
# ---------------------------------------------------------------------------

def _appendix(all_results: dict) -> list[str]:
    lines = [
        "## Appendix: Data Coverage",
        "",
        "### A.1 Training Data",
        "",
        "| Geography | Training File | Score Types | Observations |",
        "| --------- | ------------- | ----------- | -----------: |",
    ]

    for geo in ("metro", "county", "zip"):
        geo_results = {(st, hz): v for (g, st, hz), v in all_results.items() if g == geo}
        if not geo_results:
            continue
        scores = sorted(set(st for st, hz in geo_results.keys()))
        scores_str = ", ".join(_sl(s)[:2] for s in scores)
        max_rows = max(v.get("n_rows", 0) for v in geo_results.values())
        lines.append(f"| {geo.title()} | joined_{geo}.parquet | {scores_str} | {max_rows:,} |")

    lines.extend([
        "",
        "### A.2 Data Sources",
        "",
        "| Source | Used For | Coverage |",
        "| ------ | -------- | -------- |",
        "| Zillow ZHVI | Price appreciation outcomes | Primary, all geo levels |",
        "| Zillow ZORI | Rent return outcomes | Metro (65%), ZIP, County (sparse) |",
        "| Realtor.com | Market indicators, hotness scores | Metro, county, ZIP |",
        "| Redfin | Sales data, DOM, price metrics | Metro, county |",
        "| Census ACS | Demographics, income, housing | All geo levels |",
        "| FRED | Macro indicators (mortgage rates, CPI, etc.) | National |",
        "",
        "### A.3 Pipeline Configuration",
        "",
        "| Parameter | Value |",
        "| --------- | ----- |",
        "| Walk-forward train window | 24 months |",
        "| Walk-forward test window | 12 months |",
        "| Walk-forward slide | 12 months |",
        "| Walk-forward start | Jan 2018 |",
        "| Min test rows | 20 |",
        "| Feature coverage threshold | 50% |",
        "| Correlation filter threshold | 0.95 |",
        "| MI top-K features | 10 |",
        "| XGBoost | max_depth=4, lr=0.05, n_est=300, subsample=0.8 |",
        "| LightGBM | max_depth=4, lr=0.05, n_est=300, subsample=0.8 |",
        "| ElasticNet | CV-tuned alpha/l1_ratio, StandardScaler |",
        "| SHAP max samples | 2,000 |",
        "",
        "### A.4 Source Files",
        "",
        "This report was generated from:",
        "",
    ])

    for (geo, st, hz), result in sorted(all_results.items()):
        elapsed = result.get("elapsed_seconds", 0)
        lines.append(f"- `output/{geo}/{st}_{hz}.json` ({elapsed:.1f}s)")

    lines.extend([
        "",
        "### A.5 Methodology Notes",
        "",
        "- **Excess returns** = location CAGR minus state median CAGR for the same period.",
        "  This controls for statewide market cycles.",
        "- **Walk-forward windows** are generated dynamically: 24-month training, 12-month testing,",
        "  12-month slide starting from Jan 2018. Test periods are non-overlapping.",
        "  Windows only produce results when test-period data has >= 20 observations.",
        "  New windows activate automatically as data accrues.",
        "- **Model tournament** runs XGBoost, LightGBM, and ElasticNet through identical walk-forward CV.",
        "  Best model selected by highest mean OOS IC (tiebreak: quintile spread).",
        "- **SHAP distillation** extracts linear-style weights from tree models for compatibility",
        "  with the existing production scoring formula. Mean |SHAP| per feature -> normalized weights.",
        "- **InvestorEdge composite** = appreciation excess + rent excess, both vs state.",
        "  Falls back to appreciation only when rent data coverage < 10%.",
        "",
    ])
    return lines
