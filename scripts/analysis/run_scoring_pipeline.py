#!/usr/bin/env python3
"""
PropertyIQ Scoring Pipeline — CLI Entry Point
==============================================

Runs XGBoost/LightGBM/ElasticNet model tournament with walk-forward CV
to find optimal scoring formula weights.

Usage:
    # Run everything for one geo level
    python scripts/analysis/run_scoring_pipeline.py --geo metro

    # Run one score type + horizon
    python scripts/analysis/run_scoring_pipeline.py --geo county --score-type homeready --horizon 3y

    # Run all geo levels (resumes from checkpoints)
    python scripts/analysis/run_scoring_pipeline.py --geo all

    # Force re-run (ignore existing checkpoints)
    python scripts/analysis/run_scoring_pipeline.py --geo metro --force

    # Feature selection only (inspect what survives)
    python scripts/analysis/run_scoring_pipeline.py --geo zip --step features
"""

import argparse
import json
import logging
import sys
import time
from pathlib import Path

# Add parent to path for relative imports
sys.path.insert(0, str(Path(__file__).resolve().parent))

from scoring_pipeline.config import (
    ALL_GEO_LEVELS,
    ALL_SCORE_TYPES,
    DEFAULT_HORIZONS,
    OUTPUT_DIR,
)
from scoring_pipeline.data_loader import load_training_data, prepare_dataset
from scoring_pipeline.evaluation import select_best_model
from scoring_pipeline.export_weights import (
    clear_geo_output,
    combo_result_exists,
    export_weights_summary,
    load_feature_selection,
    save_combo_result,
    save_feature_selection,
)
from scoring_pipeline.feature_selection import select_features
from scoring_pipeline.models import get_all_models
from scoring_pipeline.report import generate_full_validation_report, generate_geo_report
from scoring_pipeline.shap_weights import extract_linear_weights, extract_shap_weights
from scoring_pipeline.walk_forward import run_walk_forward

logger = logging.getLogger("scoring_pipeline")


def setup_logging(verbose: bool = False) -> None:
    """Configure logging."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    # Suppress noisy libraries
    logging.getLogger("shap").setLevel(logging.WARNING)
    logging.getLogger("xgboost").setLevel(logging.WARNING)
    logging.getLogger("lightgbm").setLevel(logging.WARNING)


def run_feature_selection_step(geo_level: str, force: bool = False) -> dict | None:
    """Run or load cached feature selection for a geo level.

    Feature selection is target-agnostic for the coverage and correlation filters,
    but the MI ranking step depends on the target. We run it once with the most
    common target (homeready/3y) and reuse the selected features.
    """
    if not force:
        cached = load_feature_selection(geo_level)
        if cached is not None:
            logger.info("Using cached feature selection for %s (%d features)",
                        geo_level, len(cached.get("selected_features", [])))
            return cached

    # Load data with default target for feature selection
    dataset = prepare_dataset(geo_level, "homeready", "3y")
    if dataset is None:
        logger.error("Cannot load data for %s — no homeready/3y target", geo_level)
        return None

    X, y, feature_names, meta, _ = dataset

    # Run feature selection (pass geo_ids for per-geo consistency check)
    result = select_features(X, y, geo_ids=meta["_geo_id"])
    if result["selected_features"]:
        save_feature_selection(geo_level, result)

    return result


def run_single_combo(
    geo_level: str,
    score_type: str,
    horizon: str,
    selected_features: list[str],
) -> dict | None:
    """Run the full pipeline for one geo × score_type × horizon combo.

    Returns result dict or None if target is unavailable.
    """
    logger.info("=" * 60)
    logger.info("Running: %s / %s / %s", geo_level, score_type, horizon)
    logger.info("=" * 60)

    t0 = time.time()

    # Step 1: Load data with this specific target
    dataset = prepare_dataset(geo_level, score_type, horizon)
    if dataset is None:
        logger.warning("Skipping %s/%s/%s — target unavailable", geo_level, score_type, horizon)
        return None

    X, y, all_features, meta, is_unique_target = dataset

    # Skip InvestorEdge when it falls back to same target as HomeReady
    if score_type == "investoredge" and not is_unique_target:
        logger.warning(
            "Skipping %s/%s/%s — InvestorEdge falls back to pure appreciation "
            "(same target as HomeReady) due to insufficient rent data",
            geo_level, score_type, horizon,
        )
        return None

    # Filter to selected features that exist in this dataset
    features = [f for f in selected_features if f in X.columns]
    if len(features) < 3:
        logger.warning("Only %d features available after filtering, skipping", len(features))
        return None

    logger.info("Using %d features: %s", len(features), features)

    # Step 2: Model tournament via walk-forward CV
    models = get_all_models()
    tournament_results = []

    for model in models:
        wf_result = run_walk_forward(model, X, y, meta, features)
        result_dict = wf_result.to_dict()
        tournament_results.append(result_dict)

    # Step 3: Select best model
    best = select_best_model(tournament_results)
    if best is None:
        logger.warning("No valid model results for %s/%s/%s", geo_level, score_type, horizon)
        return None

    # Mark winner in tournament
    for r in tournament_results:
        r["is_best"] = r["model_name"] == best["model_name"]

    # Step 4: Extract weights from best model
    # Re-train the winning model on all data for weight extraction
    logger.info("Extracting weights from %s...", best["model_name"])
    X_features = X[features]
    train_medians = X_features.median()
    X_filled = X_features.fillna(train_medians)
    y_filled = y.fillna(y.median())

    winning_model = None
    for model in models:
        if model.name == best["model_name"]:
            winning_model = model
            break

    weights_data = {"weights": {}, "raw_shap_importance": {}, "n_samples": 0}

    if winning_model is not None:
        winning_model.fit(X_filled.values, y_filled.values)

        if winning_model.is_tree_model:
            try:
                weights_data = extract_shap_weights(winning_model, X_filled, features)
            except Exception as e:
                logger.warning("SHAP extraction failed: %s. Falling back to native importances.", e)
                importances = winning_model.get_feature_importances(features)
                weights_data = {
                    "weights": {
                        f: {"weight": round(v, 4), "direction": 1}
                        for f, v in importances.items() if v >= 0.01
                    },
                    "raw_shap_importance": importances,
                    "n_samples": 0,
                }
        else:
            weights_data = extract_linear_weights(winning_model, features)

    elapsed = time.time() - t0

    result = {
        "tournament": tournament_results,
        "best_model": best,
        "weights": weights_data,
        "features_used": features,
        "n_rows": len(X),
        "elapsed_seconds": round(elapsed, 1),
    }

    logger.info("Completed %s/%s/%s in %.1fs — best IC=%.4f (%s)",
                geo_level, score_type, horizon, elapsed,
                best.get("mean_ic", 0), best.get("model_name", "?"))

    return result


def run_geo_level(
    geo_level: str,
    score_types: list[str] | None = None,
    horizons: list[str] | None = None,
    force: bool = False,
) -> dict[tuple[str, str], dict]:
    """Run pipeline for all combos within a geo level.

    Returns { (score_type, horizon): result_dict }
    """
    logger.info("=" * 70)
    logger.info("GEO LEVEL: %s", geo_level.upper())
    logger.info("=" * 70)

    if force:
        clear_geo_output(geo_level)

    # Step 1: Feature selection (shared across score types)
    feature_data = run_feature_selection_step(geo_level, force=force)
    if feature_data is None or not feature_data.get("selected_features"):
        logger.error("Feature selection failed for %s, aborting", geo_level)
        return {}

    selected_features = feature_data["selected_features"]

    # Step 2: Run each score_type × horizon combo
    if score_types is None:
        score_types = ALL_SCORE_TYPES
    combo_results: dict[tuple[str, str], dict] = {}

    for score_type in score_types:
        type_horizons = horizons or DEFAULT_HORIZONS.get(score_type, ["3y"])
        for horizon in type_horizons:
            # Check for existing result (checkpoint)
            if not force and combo_result_exists(geo_level, score_type, horizon):
                logger.info("Skipping %s/%s/%s — already completed (use --force to re-run)",
                            geo_level, score_type, horizon)
                # Load existing result for report
                path = OUTPUT_DIR / geo_level / f"{score_type}_{horizon}.json"
                with open(path) as f:
                    combo_results[(score_type, horizon)] = json.load(f)
                continue

            result = run_single_combo(geo_level, score_type, horizon, selected_features)
            if result is not None:
                save_combo_result(geo_level, score_type, horizon, result)
                combo_results[(score_type, horizon)] = result

    # Step 3: Generate report
    if combo_results:
        generate_geo_report(geo_level, combo_results)

    return combo_results


def main() -> None:
    parser = argparse.ArgumentParser(
        description="PropertyIQ Scoring Pipeline — XGBoost/LightGBM Weight Optimizer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--geo", required=True,
        choices=ALL_GEO_LEVELS + ["all"],
        help="Geography level to run (or 'all')",
    )
    parser.add_argument(
        "--score-type",
        choices=ALL_SCORE_TYPES,
        help="Run only this score type (default: all)",
    )
    parser.add_argument(
        "--horizon",
        choices=["1y", "3y", "5y"],
        help="Run only this horizon (default: per score type defaults)",
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Force re-run, ignoring existing checkpoints",
    )
    parser.add_argument(
        "--step",
        choices=["features", "full"],
        default="full",
        help="Run only a specific step (default: full pipeline)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Enable debug logging",
    )

    args = parser.parse_args()
    setup_logging(args.verbose)

    t0 = time.time()
    geo_levels = ALL_GEO_LEVELS if args.geo == "all" else [args.geo]
    score_types = [args.score_type] if args.score_type else None
    horizons = [args.horizon] if args.horizon else None

    # Feature selection only mode
    if args.step == "features":
        for geo in geo_levels:
            feature_data = run_feature_selection_step(geo, force=args.force)
            if feature_data:
                print(f"\n{geo.upper()} — Selected {len(feature_data['selected_features'])} features:")
                for feat in feature_data["selected_features"]:
                    mi = feature_data.get("mi_scores", {}).get(feat, 0)
                    print(f"  {feat}: MI={mi:.4f}")
                print(f"\nStages: {json.dumps(feature_data.get('all_stages', {}), indent=2)}")
        return

    # Full pipeline
    all_results: dict[tuple[str, str, str], dict] = {}

    for geo in geo_levels:
        combo_results = run_geo_level(geo, score_types, horizons, args.force)
        for (st, hz), result in combo_results.items():
            all_results[(geo, st, hz)] = result

    # Export weights summary + validation report
    if all_results:
        export_weights_summary(all_results)
        report_path = generate_full_validation_report(all_results)
        logger.info("Validation report: %s", report_path)

    elapsed = time.time() - t0
    logger.info("Pipeline complete in %.1fs — %d combos processed", elapsed, len(all_results))

    # Print summary
    print(f"\n{'=' * 60}")
    print(f"Pipeline Complete — {len(all_results)} combos in {elapsed:.1f}s")
    print(f"{'=' * 60}")
    for (geo, st, hz), result in sorted(all_results.items()):
        best = result.get("best_model", {})
        ic = best.get("mean_ic", 0)
        model = best.get("model_name", "?")
        n_weights = len(result.get("weights", {}).get("weights", {}))
        print(f"  {geo}/{st}/{hz}: IC={ic:.4f} ({model}, {n_weights} weights)")
    print(f"\nOutput: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
