"""Minimum-feature forward add with bootstrap-95% CI stopping rule.

Per spec §6.3. The K we ship is the smallest such that ALL four
metrics' bootstrap-95% lower CI bounds clear the strict bar.
"""

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler


@dataclass
class StrictBar:
    ic_min: float
    hit_min: float
    spread_min: float
    mono_freq_min: float
    k_max: int


@dataclass
class ForwardAddResult:
    selected: list[str]
    k: int
    shipped: bool
    last_bootstrap: dict
    ridge_alpha: float
    feature_means: dict
    feature_stdevs: dict
    ridge_weights: dict


def _bootstrap_metrics(df, feature_cols, target_col, year_col, n_bootstrap, rng):
    years = sorted(df[year_col].unique())
    metrics = {"ic": [], "hit": [], "spread": [], "mono": []}

    for _ in range(n_bootstrap):
        chosen_years = rng.choice(years, size=len(years), replace=True)
        sample = pd.concat([df[df[year_col] == y] for y in chosen_years])
        holdout_year = sample[year_col].max()
        train = sample[sample[year_col] < holdout_year]
        test = sample[sample[year_col] == holdout_year]
        if len(train) < 200 or len(test) < 50:
            continue

        scaler = StandardScaler()
        X_tr = scaler.fit_transform(train[feature_cols].values)
        X_te = scaler.transform(test[feature_cols].values)

        model = Ridge(alpha=1.0)
        model.fit(X_tr, train[target_col].values)
        pred = model.predict(X_te)
        y = test[target_col].values

        ic, _ = stats.spearmanr(pred, y)
        if not np.isfinite(ic):
            continue
        hit = float(np.mean((pred > 0) == (y > 0)))
        try:
            t = test.copy()
            t["pred"] = pred
            t["dec"] = pd.qcut(t["pred"].rank(method="first"), 10, labels=range(1, 11))
            dm = t.groupby("dec", observed=True)[target_col].mean()
            spread = float(dm.iloc[-1] - dm.iloc[0])
            mono = bool(dm.is_monotonic_increasing)
        except Exception:
            spread, mono = 0.0, False

        metrics["ic"].append(ic)
        metrics["hit"].append(hit)
        metrics["spread"].append(spread)
        metrics["mono"].append(1.0 if mono else 0.0)

    if not metrics["ic"]:
        return None

    return {
        "ic_5pct": float(np.percentile(metrics["ic"], 5)),
        "hit_5pct": float(np.percentile(metrics["hit"], 5)),
        "spread_5pct": float(np.percentile(metrics["spread"], 5)),
        "mono_freq": float(np.mean(metrics["mono"])),
    }


def _clears_bar(b: dict, bar: StrictBar) -> bool:
    return (
        b["ic_5pct"] >= bar.ic_min
        and b["hit_5pct"] >= bar.hit_min
        and b["spread_5pct"] >= bar.spread_min
        and b["mono_freq"] >= bar.mono_freq_min
    )


def forward_add_with_ci_gate(
    panel: pd.DataFrame,
    *,
    target_col: str,
    ranked_features: list[str],
    bar: StrictBar,
    year_col: str = "year",
    n_bootstrap: int = 1000,
    seed: int = 42,
) -> ForwardAddResult:
    rng = np.random.default_rng(seed)
    selected: list[str] = []
    last_b = None

    for f in ranked_features:
        selected.append(f)
        df = panel.dropna(subset=selected + [target_col])
        if len(df) < 500:
            selected.pop()
            continue

        b = _bootstrap_metrics(df, selected, target_col, year_col, n_bootstrap, rng)
        if b is None:
            selected.pop()
            continue
        last_b = b

        if _clears_bar(b, bar):
            scaler = StandardScaler().fit(df[selected].values)
            model = Ridge(alpha=1.0).fit(scaler.transform(df[selected].values), df[target_col].values)
            return ForwardAddResult(
                selected=selected, k=len(selected), shipped=True,
                last_bootstrap=b, ridge_alpha=1.0,
                feature_means=dict(zip(selected, scaler.mean_)),
                feature_stdevs=dict(zip(selected, scaler.scale_)),
                ridge_weights=dict(zip(selected, model.coef_)),
            )

        if len(selected) >= bar.k_max:
            break

    return ForwardAddResult(
        selected=selected, k=0, shipped=False, last_bootstrap=last_b or {},
        ridge_alpha=1.0, feature_means={}, feature_stdevs={}, ridge_weights={},
    )
