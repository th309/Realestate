#!/usr/bin/env python3
"""
Full County-Level Backtest + Validation Battery
================================================
Same 3-metric Redfin formula as metro. Streamlined queries for large tables.
"""

import os, sys, warnings
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.isotonic import IsotonicRegression

warnings.filterwarnings("ignore")

# Force unbuffered output
_print = print
def print(*args, **kwargs):
    _print(*args, **kwargs)
    sys.stdout.flush()


def get_engine():
    from sqlalchemy import create_engine
    from urllib.parse import quote_plus
    ref = "pysflbhpnqwoczyuaaif"
    pw = os.environ.get("SUPABASE_DB_PASSWORD", "IHatedoingpt12")
    host = "aws-1-us-east-1.pooler.supabase.com"
    url = f"postgresql://postgres.{ref}:{quote_plus(pw)}@{host}:6543/postgres?sslmode=require"
    return create_engine(url, connect_args={"options": "-c statement_timeout=120000"})


def load_and_score(engine):
    print("Loading crosswalk...")
    xw = pd.read_sql("""
        SELECT DISTINCT county_fips, state_abbrev,
               zillow_county_region_id::text AS zc_id,
               zillow_state_region_id::text AS zs_id
        FROM geography_crosswalk
        WHERE county_fips IS NOT NULL
          AND zillow_county_region_id IS NOT NULL
          AND zillow_state_region_id IS NOT NULL
    """, engine)
    xw = xw.drop_duplicates(subset="county_fips", keep="first")
    print(f"  {len(xw)} county->state mappings")

    print("Loading county ZHVI (2010+)...")
    county_zhvi = pd.read_sql("""
        SELECT region_id::text AS region_id, period_date, value AS zhvi
        FROM zillow_county
        WHERE metric_name = 'zhvi' AND value IS NOT NULL AND period_date >= '2010-01-01'
    """, engine)
    county_zhvi["period_date"] = pd.to_datetime(county_zhvi["period_date"])
    print(f"  {len(county_zhvi):,} rows, {county_zhvi['region_id'].nunique()} counties")

    print("Loading state ZHVI (2010+)...")
    state_zhvi = pd.read_sql("""
        SELECT region_id::text AS region_id, period_date, value AS zhvi
        FROM zillow_state
        WHERE metric_name = 'zhvi' AND value IS NOT NULL AND period_date >= '2010-01-01'
    """, engine)
    state_zhvi["period_date"] = pd.to_datetime(state_zhvi["period_date"])

    print("Loading Redfin county data (2012+, All Residential only)...")
    # Only load the 3 columns we need + fips + date, filtered early
    redfin = pd.read_sql("""
        SELECT fips_code AS county_fips, period_end AS period_date,
               sold_above_list, median_dom, months_of_supply
        FROM redfin_county
        WHERE property_type = 'All Residential'
          AND period_end >= '2012-01-01'
          AND sold_above_list IS NOT NULL
          AND median_dom IS NOT NULL
          AND months_of_supply IS NOT NULL
    """, engine)
    redfin["period_date"] = pd.to_datetime(redfin["period_date"])
    print(f"  {len(redfin):,} rows, {redfin['county_fips'].nunique()} counties")
    print(f"  Date range: {redfin['period_date'].min().date()} to {redfin['period_date'].max().date()}")

    # Compute returns
    print("Computing forward returns...")
    cp = county_zhvi.pivot_table(index="period_date", columns="region_id", values="zhvi")
    sp = state_zhvi.pivot_table(index="period_date", columns="region_id", values="zhvi")

    frames = []
    for h, lab in [(12, "1y"), (36, "3y")]:
        cr = (cp.shift(-h) / cp - 1).stack().reset_index()
        cr.columns = ["period_date", "region_id", f"county_return_{lab}"]
        sr = (sp.shift(-h) / sp - 1).stack().reset_index()
        sr.columns = ["period_date", "zs_id", f"state_return_{lab}"]
        m = cr.merge(xw[["zc_id","zs_id","county_fips","state_abbrev"]],
                      left_on="region_id", right_on="zc_id", how="inner")
        m = m.merge(sr, on=["period_date","zs_id"], how="inner")
        m[f"excess_{lab}"] = m[f"county_return_{lab}"] - m[f"state_return_{lab}"]
        frames.append(m[["period_date","region_id","county_fips","state_abbrev",
                         f"county_return_{lab}",f"state_return_{lab}",f"excess_{lab}"]])

    base = frames[0].merge(frames[1],
        on=["period_date","region_id","county_fips","state_abbrev"], how="outer")
    base = base.dropna(subset=["county_fips"])

    # Join Redfin
    base["period_month"] = base["period_date"].dt.to_period("M")
    rf = redfin.copy()
    rf["period_month"] = rf["period_date"].dt.to_period("M")
    df = base.merge(rf[["county_fips","period_month","sold_above_list","median_dom","months_of_supply"]],
                     on=["county_fips","period_month"], how="inner")
    df = df.dropna(subset=["sold_above_list","median_dom","months_of_supply"])

    # Z-scores and signal
    for col, name in [("sold_above_list","z_sal"),("median_dom","z_dom"),("months_of_supply","z_mos")]:
        df[name] = df.groupby("period_date")[col].transform(lambda x: (x - x.mean()) / max(x.std(), 0.001))
    df["signal"] = df["z_sal"] - df["z_dom"] - df["z_mos"]
    df["pct_rank"] = df.groupby("period_date")["signal"].rank(pct=True) * 100

    # Re-center
    valid_3y = df.dropna(subset=["excess_3y"])
    if len(valid_3y) > 1000:
        iso = IsotonicRegression(increasing=True, out_of_bounds="clip")
        iso.fit(valid_3y["pct_rank"].values, valid_3y["excess_3y"].values)
        test_pcts = np.linspace(1, 99, 9901)
        test_excess = iso.predict(test_pcts)
        zc = test_pcts[np.argmin(np.abs(test_excess))]
    else:
        zc = 50.0
    print(f"  Zero crossing: pct_rank = {zc:.1f}")

    df["score"] = np.where(
        df["pct_rank"] <= zc,
        1 + (df["pct_rank"] / zc) * 49,
        50 + ((df["pct_rank"] - zc) / (100 - zc)) * 49
    )
    df["score"] = df["score"].round(0).astype(int).clip(1, 99)
    df = df[df["period_date"] >= "2012-01-01"]
    df["year"] = df["period_date"].dt.year

    print(f"\n  SCORED: {len(df):,} observations, {df['county_fips'].nunique()} counties")
    print(f"  With 1Y returns: {df['excess_1y'].notna().sum():,}")
    print(f"  With 3Y returns: {df['excess_3y'].notna().sum():,}")
    return df


def full_analysis(df):
    print("\n" + "="*70)
    print("COUNTY-LEVEL FULL ANALYSIS")
    print("="*70)

    # --- Overall ---
    print("\n--- 1. OVERALL PREDICTIVE POWER ---")
    for h in ["1y","3y"]:
        col = f"excess_{h}"
        v = df.dropna(subset=[col])
        if len(v) < 100:
            print(f"  {h}: insufficient data"); continue
        ic,p = stats.spearmanr(v["score"],v[col])
        hit = np.mean((v["score"]>50)==(v[col]>0))
        print(f"  {h.upper()}: IC={ic:.4f} (p={p:.2e})  Hit={hit*100:.1f}%  N={len(v):,}")

    # --- Decile tables ---
    print("\n--- 2. SCORE DECILE TABLES ---")
    for h in ["1y","3y"]:
        col = f"excess_{h}"
        v = df.dropna(subset=[col]).copy()
        if len(v) < 100: continue
        v["decile"] = pd.cut(v["score"], bins=[0,10,20,30,40,50,60,70,80,90,100],
                              labels=[10,20,30,40,50,60,70,80,90,100], include_lowest=True)
        tbl = v.groupby("decile",observed=True).agg(
            mean_excess=(col,"mean"), median_excess=(col,"median"),
            std=(col,"std"), hit=(col,lambda x:(x>0).mean()), n=(col,"count")).reset_index()
        mono = tbl["mean_excess"].is_monotonic_increasing
        print(f"\n  {h.upper()} (monotonic: {'YES' if mono else 'NO'}):")
        print(f"  {'Score':<8} {'Mean Excess':>12} {'Median':>10} {'Std':>8} {'P(Beat)':>10} {'N':>8}")
        print(f"  {'-'*58}")
        for _,r in tbl.iterrows():
            mk = "  <-- state avg" if int(r["decile"])==50 else ""
            print(f"  {int(r['decile']):<8d} {r['mean_excess']*100:>+11.2f}% "
                  f"{r['median_excess']*100:>+9.2f}% {r['std']*100:>7.1f}% "
                  f"{r['hit']*100:>9.1f}% {int(r['n']):>7d}{mk}")
        if len(tbl)>=2:
            top = tbl[tbl["decile"].astype(int)>=80]["mean_excess"].mean()
            bot = tbl[tbl["decile"].astype(int)<=20]["mean_excess"].mean()
            print(f"  Spread: {(top-bot)*100:+.2f}pp")

    # --- Year-by-year ---
    print("\n--- 3. YEAR-BY-YEAR IC ---")
    for h in ["1y","3y"]:
        col = f"excess_{h}"
        v = df.dropna(subset=[col]).copy()
        print(f"\n  {h.upper()}:")
        print(f"  {'Year':<6} {'IC':>8} {'Hit%':>8} {'Q5>Q1':>7} {'N':>8}")
        print(f"  {'-'*40}")
        yics = []
        for yr in sorted(v["year"].unique()):
            s = v[v["year"]==yr]
            if len(s)<50: continue
            ic,_ = stats.spearmanr(s["score"],s[col])
            hit = np.mean((s["score"]>50)==(s[col]>0))
            s = s.copy()
            s["q"] = pd.qcut(s["score"].rank(method="first"),5,labels=[1,2,3,4,5])
            qm = s.groupby("q")[col].mean()
            q5w = "Y" if len(qm)>=5 and qm[5]>qm[1] else "N"
            yics.append(ic)
            print(f"  {yr:<6d} {ic:>+.4f} {hit*100:>7.1f}% {q5w:>7} {len(s):>7d}")
        if yics:
            avg=np.mean(yics); std=np.std(yics); ir=avg/std if std>0 else 0
            print(f"  {'-'*40}")
            print(f"  Avg IC: {avg:+.4f}  IR: {ir:.2f}  %Positive: {np.mean([x>0 for x in yics])*100:.0f}%")

    # --- Walk-forward ---
    print("\n--- 4. WALK-FORWARD ---")
    for h in ["1y","3y"]:
        col = f"excess_{h}"
        v = df.dropna(subset=[col])
        years = sorted(v["year"].unique())
        print(f"\n  {h.upper()}:")
        print(f"  {'Year':<6} {'IC':>8} {'Hit%':>8} {'Spread':>10}")
        print(f"  {'-'*35}")
        oics = []
        for ty in years:
            if ty < 2015: continue
            t = v[v["year"]==ty]
            if len(t)<50: continue
            ic,_ = stats.spearmanr(t["score"],t[col])
            hit = np.mean((t["score"]>50)==(t[col]>0))
            t = t.copy()
            t["q"] = pd.qcut(t["score"].rank(method="first"),5,labels=[1,2,3,4,5])
            qm = t.groupby("q")[col].mean()
            sp = qm.iloc[-1]-qm.iloc[0] if len(qm)>=2 else 0
            oics.append(ic)
            print(f"  {ty:<6d} {ic:>+.4f} {hit*100:>7.1f}% {sp*100:>+9.2f}pp")
        if oics:
            print(f"  Avg OOS IC: {np.mean(oics):+.4f}  %Pos: {np.mean([x>0 for x in oics])*100:.0f}%")

    # --- Permutation ---
    print("\n--- 5. PERMUTATION TEST (5,000 shuffles) ---")
    for h in ["1y","3y"]:
        col = f"excess_{h}"
        v = df.dropna(subset=[col])
        if len(v)<100: continue
        aic,_ = stats.spearmanr(v["score"],v[col])
        rng = np.random.RandomState(42)
        pics = [stats.spearmanr(rng.permutation(v["score"].values),v[col].values)[0] for _ in range(5000)]
        pics = np.array(pics)
        ns = aic/pics.std() if pics.std()>0 else 0
        nb = (np.abs(pics)>=np.abs(aic)).sum()
        print(f"  {h.upper()}: IC={aic:+.4f}, {ns:.0f} sigma, random beat: {nb}/5000")

    # --- Bootstrap ---
    print("\n--- 6. BOOTSTRAP CI (1,000 resamples) ---")
    for h in ["1y","3y"]:
        col = f"excess_{h}"
        v = df.dropna(subset=[col])
        if len(v)<100: continue
        rng = np.random.RandomState(42)
        n = len(v)
        bics = [stats.spearmanr(v.iloc[rng.choice(n,size=n,replace=True)]["score"],
                                 v.iloc[rng.choice(n,size=n,replace=True)][col])[0] for _ in range(1000)]
        bics = np.array(bics)
        print(f"  {h.upper()}: mean={bics.mean():.4f}  95% CI=[{np.percentile(bics,2.5):.4f}, {np.percentile(bics,97.5):.4f}]  "
              f"P(IC>0)={(bics>0).mean()*100:.1f}%")

    # --- Structural break ---
    print("\n--- 7. STRUCTURAL BREAK ---")
    col = "excess_3y"
    v = df.dropna(subset=[col])
    for bp in [2016,2017,2018,2019,2020,2021]:
        b = v[v["year"]<bp]; a = v[v["year"]>=bp]
        if len(b)<200 or len(a)<200: continue
        ib,_ = stats.spearmanr(b["score"],b[col])
        ia,_ = stats.spearmanr(a["score"],a[col])
        print(f"  {bp}: before={ib:+.4f}  after={ia:+.4f}  diff={ia-ib:+.4f}  {'STABLE' if abs(ia-ib)<0.05 else 'DRIFT'}")

    # --- Signal decay ---
    print("\n--- 8. SIGNAL DECAY ---")
    for h in ["1y","3y"]:
        col = f"excess_{h}"
        v = df.dropna(subset=[col])
        yearly = []
        for yr in sorted(v["year"].unique()):
            s = v[v["year"]==yr]
            if len(s)<50: continue
            ic,_ = stats.spearmanr(s["score"],s[col])
            yearly.append((yr,ic))
        if len(yearly)>=4:
            yrs,ics = zip(*yearly)
            sl,_,rv,pv,_ = stats.linregress(yrs,ics)
            trend = "STRENGTHENING" if sl>0 else "WEAKENING" if pv<0.05 else "STABLE"
            print(f"  {h.upper()}: slope={sl:+.5f}/yr  p={pv:.4f}  -> {trend}")

    # --- Drawdown ---
    print("\n--- 9. DRAWDOWN (1Y monthly IC) ---")
    col = "excess_1y"
    v = df.dropna(subset=[col])
    mic = []
    for dt in sorted(v["period_date"].unique()):
        s = v[v["period_date"]==dt]
        if len(s)<20: continue
        ic,_ = stats.spearmanr(s["score"],s[col])
        mic.append(ic)
    if mic:
        mic = np.array(mic)
        neg = (mic<0).sum()
        # Find longest negative streak
        streaks=[]; cs=0
        for x in mic:
            if x<0: cs+=1
            else:
                if cs>0: streaks.append(cs)
                cs=0
        if cs>0: streaks.append(cs)
        worst = max(streaks) if streaks else 0
        print(f"  {len(mic)} months, {neg} negative ({neg/len(mic)*100:.1f}%), worst streak: {worst}")
        print(f"  Worst month IC: {mic.min():+.4f}  Best: {mic.max():+.4f}  Avg: {mic.mean():+.4f}")

    # --- Market cycles ---
    print("\n--- 10. MARKET CYCLES (1Y) ---")
    col = "excess_1y"
    v = df.dropna(subset=[col])
    for label,(s,e) in [("Pre-COVID 2015-19",("2015-01-01","2019-12-31")),
                          ("COVID 2020",("2020-01-01","2020-12-31")),
                          ("Post-COVID 2021-22",("2021-01-01","2022-12-31")),
                          ("Rate hikes 2023+",("2023-01-01","2025-12-31"))]:
        sub = v[(v["period_date"]>=s)&(v["period_date"]<=e)]
        if len(sub)<50: continue
        ic,_ = stats.spearmanr(sub["score"],sub[col])
        hit = np.mean((sub["score"]>50)==(sub[col]>0))
        print(f"  {label:<25} IC={ic:+.4f}  Hit={hit*100:.1f}%  N={len(sub):,}")

    # --- Cumulative P&L ---
    print("\n--- 11. CUMULATIVE P&L (1Y) ---")
    col = "excess_1y"
    v = df.dropna(subset=[col]).copy()
    cum_top=0; cum_bot=0
    print(f"  {'Year':<6} {'Top Q':>10} {'Bot Q':>10} {'Spread':>10}")
    print(f"  {'-'*38}")
    for yr in sorted(v["year"].unique()):
        s = v[v["year"]==yr]
        if len(s)<50: continue
        s = s.copy()
        s["q"] = pd.qcut(s["score"].rank(method="first"),5,labels=[1,2,3,4,5])
        qm = s.groupby("q")[col].mean()
        if len(qm)<5: continue
        t=qm[5]; b=qm[1]; cum_top+=t; cum_bot+=b
        print(f"  {yr:<6d} {t*100:>+9.2f}% {b*100:>+9.2f}% {(t-b)*100:>+9.2f}pp")
    print(f"  {'-'*38}")
    print(f"  TOTAL  {cum_top*100:>+9.2f}% {cum_bot*100:>+9.2f}% {(cum_top-cum_bot)*100:>+9.2f}pp")


def main():
    print("="*62)
    print("  COUNTY-LEVEL BACKTEST + FULL VALIDATION")
    print("="*62)
    engine = get_engine()
    df = load_and_score(engine)
    full_analysis(df)
    engine.dispose()
    print("\nDONE.")


if __name__ == "__main__":
    main()
