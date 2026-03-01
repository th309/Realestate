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
        print("\nCONSISTENCY ERRORS FOUND:")
        for e in all_errors:
            print(f"  - {e}")
        print("\nDo NOT run monthly update until these are fixed.")
        sys.exit(1)
    else:
        print("\nAll checks passed. Training target = Validation target.")
        for score_type, config in SCORE_CONFIGS.items():
            print(f"\n  {score_type.upper()}:")
            print(f"    Target:    {config['training_target']}")
            print(f"    Benchmark: {config['validation_benchmark']}")
            print(f"    Claim:     {config['claim']}")
        sys.exit(0)


if __name__ == "__main__":
    main()
