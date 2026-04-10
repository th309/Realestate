#!/usr/bin/env python3
"""Missing tests for ZIP: rolling window, bootstrap, structural break, score persistence, calibration by year, hold-out, drawdown."""
import os, sys, warnings
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.isotonic import IsotonicRegression
warnings.filterwarnings("ignore")
_print = print
def print(*a, **k): _print(*a, **k); sys.stdout.flush()

def get_engine():
    from sqlalchemy import create_engine
    from urllib.parse import quote_plus
    ref = "pysflbhpnqwoczyuaaif"
    pw = os.environ.get("SUPABASE_DB_PASSWORD", "IHatedoingpt12")
    host = "aws-1-us-east-1.pooler.supabase.com"
    url = f"postgresql://postgres.{ref}:{quote_plus(pw)}@{host}:6543/postgres?sslmode=require"
    return create_engine(url, connect_args={"options": "-c statement_timeout=600000"})

def load_and_score(engine):
    print("Loading ZIP data...")
    xw = pd.read_sql("""SELECT DISTINCT zip_code, state_abbrev,
        zillow_state_region_id::text AS zs_id FROM geography_crosswalk
        WHERE zip_code IS NOT NULL AND zillow_state_region_id IS NOT NULL""", engine)
    xw = xw.drop_duplicates(subset="zip_code", keep="first")
    print(f"  Crosswalk: {len(xw)} zips")

    zip_zhvi = pd.read_sql("""SELECT region_name AS zip_code, period_date, value AS zhvi
        FROM zillow_zip WHERE metric_name = 'zhvi' AND value IS NOT NULL AND period_date >= '2010-01-01'""", engine)
    zip_zhvi["period_date"] = pd.to_datetime(zip_zhvi["period_date"])
    print(f"  ZHVI: {len(zip_zhvi):,} rows, {zip_zhvi['zip_code'].nunique()} zips")

    state_zhvi = pd.read_sql("""SELECT region_id::text AS region_id, period_date, value AS zhvi
        FROM zillow_state WHERE metric_name = 'zhvi' AND value IS NOT NULL AND period_date >= '2010-01-01'""", engine)
    state_zhvi["period_date"] = pd.to_datetime(state_zhvi["period_date"])

    redfin = pd.read_sql("""SELECT zip_code, period_end AS period_date, sold_above_list, median_dom
        FROM redfin_zip WHERE property_type = 'All Residential' AND period_end >= '2012-01-01'
        AND sold_above_list IS NOT NULL AND median_dom IS NOT NULL""", engine)
    redfin["period_date"] = pd.to_datetime(redfin["period_date"])
    print(f"  Redfin: {len(redfin):,} rows, {redfin['zip_code'].nunique()} zips")

    print("  Computing returns...")
    zp = zip_zhvi.pivot_table(index="period_date", columns="zip_code", values="zhvi")
    sp = state_zhvi.pivot_table(index="period_date", columns="region_id", values="zhvi")
    frames = []
    for h, lab in [(12,"1y"),(36,"3y")]:
        print(f"    {lab}...")
        zr = (zp.shift(-h)/zp-1).stack().reset_index(); zr.columns=["period_date","zip_code",f"zip_return_{lab}"]
        sr = (sp.shift(-h)/sp-1).stack().reset_index(); sr.columns=["period_date","zs_id",f"state_return_{lab}"]
        m = zr.merge(xw[["zs_id","zip_code","state_abbrev"]], on="zip_code", how="inner")
        m = m.merge(sr, on=["period_date","zs_id"], how="inner")
        m[f"excess_{lab}"] = m[f"zip_return_{lab}"] - m[f"state_return_{lab}"]
        frames.append(m[["period_date","zip_code","state_abbrev",f"excess_{lab}"]])
    base = frames[0].merge(frames[1], on=["period_date","zip_code","state_abbrev"], how="outer")
    base = base.dropna(subset=["zip_code"])

    print("  Joining Redfin + scoring...")
    base["period_month"] = base["period_date"].dt.to_period("M")
    rf = redfin.copy(); rf["period_month"] = rf["period_date"].dt.to_period("M")
    df = base.merge(rf[["zip_code","period_month","sold_above_list","median_dom"]],
                     on=["zip_code","period_month"], how="inner")
    df = df.dropna(subset=["sold_above_list","median_dom"])
    for col,name in [("sold_above_list","z_sal"),("median_dom","z_dom")]:
        df[name] = df.groupby("period_date")[col].transform(lambda x: (x-x.mean())/max(x.std(),0.001))
    df["signal"] = df["z_sal"] - df["z_dom"]
    df["pct_rank"] = df.groupby("period_date")["signal"].rank(pct=True) * 100
    v3 = df.dropna(subset=["excess_3y"])
    if len(v3)>1000:
        sample=v3.sample(min(200000,len(v3)),random_state=42)
        iso=IsotonicRegression(increasing=True,out_of_bounds="clip")
        iso.fit(sample["pct_rank"].values,sample["excess_3y"].values)
        tp=np.linspace(1,99,9901); te=iso.predict(tp); zc=tp[np.argmin(np.abs(te))]
    else: zc=50.0
    df["score"]=np.where(df["pct_rank"]<=zc, 1+(df["pct_rank"]/zc)*49, 50+((df["pct_rank"]-zc)/(100-zc))*49)
    df["score"]=df["score"].round(0).astype(int).clip(1,99)
    df=df[df["period_date"]>="2012-01-01"]; df["year"]=df["period_date"].dt.year
    print(f"  Scored: {len(df):,} obs, {df['zip_code'].nunique()} zips")
    return df

def run_missing(df):
    # 1. ROLLING 3-YEAR WINDOW
    print("\n" + "="*60)
    print("TEST: ROLLING 3-YEAR WINDOW (ZIP)")
    print("="*60)
    col="excess_1y"; v=df.dropna(subset=[col])
    years=sorted(v["year"].unique())
    print(f"  {'Train Window':<16} {'Test':<8} {'IC':>8} {'Hit%':>8}")
    print(f"  {'-'*42}")
    for ty in years:
        if ty<2015: continue
        test=v[v["year"]==ty]
        if len(test)<100: continue
        ic,_=stats.spearmanr(test["score"],test[col])
        hit=np.mean((test["score"]>50)==(test[col]>0))
        print(f"  {ty-3}-{ty-1:<11d} {ty:<8d} {ic:>+.4f} {hit*100:>7.1f}%")

    # 2. BOOTSTRAP CI
    print("\n" + "="*60)
    print("TEST: BOOTSTRAP CI (ZIP, 200K sample)")
    print("="*60)
    for h in ["1y","3y"]:
        col=f"excess_{h}"; v=df.dropna(subset=[col])
        if len(v)>200000: v=v.sample(200000,random_state=42)
        if len(v)<100: continue
        rng=np.random.RandomState(42); n=len(v); bics=[]
        for _ in range(1000):
            idx=rng.choice(n,size=n,replace=True)
            s=v.iloc[idx]
            ic,_=stats.spearmanr(s["score"].values,s[col].values)
            bics.append(ic)
        bics=np.array(bics)
        print(f"  {h.upper()}: mean={bics.mean():.4f}  95% CI=[{np.percentile(bics,2.5):.4f}, {np.percentile(bics,97.5):.4f}]  "
              f"P(IC>0)={(bics>0).mean()*100:.1f}%  P(IC>0.10)={(bics>0.10).mean()*100:.1f}%")

    # 3. STRUCTURAL BREAK
    print("\n" + "="*60)
    print("TEST: STRUCTURAL BREAK (ZIP)")
    print("="*60)
    col="excess_3y"; v=df.dropna(subset=[col])
    for bp in [2016,2017,2018,2019,2020,2021]:
        b=v[v["year"]<bp]; a=v[v["year"]>=bp]
        if len(b)<500 or len(a)<500: continue
        ib,_=stats.spearmanr(b["score"],b[col])
        ia,_=stats.spearmanr(a["score"],a[col])
        print(f"  {bp}: before={ib:+.4f}  after={ia:+.4f}  diff={ia-ib:+.4f}  {'STABLE' if abs(ia-ib)<0.05 else 'DRIFT'}")

    # 4. SCORE PERSISTENCE
    print("\n" + "="*60)
    print("TEST: SCORE PERSISTENCE (ZIP, 5K sample)")
    print("="*60)
    # Sample ZIPs for speed
    zips = df["zip_code"].unique()
    rng = np.random.RandomState(42)
    sample_zips = set(rng.choice(zips, size=min(5000, len(zips)), replace=False))
    df_sample = df[df["zip_code"].isin(sample_zips)]
    for lag in [1,3,6,12,24]:
        corrs=[]
        for zc,grp in df_sample.groupby("zip_code"):
            grp=grp.sort_values("period_date")
            if len(grp)<lag+6: continue
            s1=grp["score"].values[:-lag]; s2=grp["score"].values[lag:]
            if len(s1)>5:
                c,_=stats.spearmanr(s1,s2)
                if np.isfinite(c): corrs.append(c)
        if corrs:
            print(f"  Lag {lag:>2d}m: autocorrelation = {np.mean(corrs):+.4f}  ({len(corrs)} zips)")

    # 5. DRAWDOWN
    print("\n" + "="*60)
    print("TEST: DRAWDOWN (ZIP, 1Y monthly IC)")
    print("="*60)
    col="excess_1y"; v=df.dropna(subset=[col])
    mic=[]
    for dt in sorted(v["period_date"].unique()):
        s=v[v["period_date"]==dt]
        if len(s)<50: continue
        ic,_=stats.spearmanr(s["score"],s[col])
        mic.append(ic)
    if mic:
        mic=np.array(mic); neg=(mic<0).sum()
        streaks=[]; cs=0
        for x in mic:
            if x<0: cs+=1
            else:
                if cs>0: streaks.append(cs)
                cs=0
        if cs>0: streaks.append(cs)
        worst=max(streaks) if streaks else 0
        print(f"  {len(mic)} months, {neg} negative ({neg/len(mic)*100:.1f}%), worst streak: {worst}")
        print(f"  Worst: {mic.min():+.4f}  Best: {mic.max():+.4f}  Avg: {mic.mean():+.4f}")

    # 6. CALIBRATION BY YEAR
    print("\n" + "="*60)
    print("TEST: CALIBRATION BY YEAR (ZIP)")
    print("="*60)
    for h in ["1y","3y"]:
        col=f"excess_{h}"; v=df.dropna(subset=[col]).copy()
        print(f"\n  {h.upper()}:")
        print(f"  {'Year':<6} {'Q1':>10} {'Q2':>10} {'Q3':>10} {'Q4':>10} {'Q5':>10} {'Mono':>6} {'Q5>Q1':>7}")
        print(f"  {'-'*68}")
        mono_cnt=0; q5_cnt=0; tot=0
        for yr in sorted(v["year"].unique()):
            s=v[v["year"]==yr]
            if len(s)<200: continue
            s=s.copy(); s["q"]=pd.qcut(s["score"].rank(method="first"),5,labels=[1,2,3,4,5])
            qm=s.groupby("q")[col].mean()
            if len(qm)<5: continue
            tot+=1; mono=qm.is_monotonic_increasing; q5w=qm[5]>qm[1]
            if mono: mono_cnt+=1
            if q5w: q5_cnt+=1
            print(f"  {yr:<6d} {qm[1]*100:>+9.2f}% {qm[2]*100:>+9.2f}% {qm[3]*100:>+9.2f}% {qm[4]*100:>+9.2f}% {qm[5]*100:>+9.2f}% {'Y' if mono else 'N':>5} {'Y' if q5w else 'N':>6}")
        if tot>0:
            print(f"  Monotonic: {mono_cnt}/{tot} ({mono_cnt/tot*100:.0f}%)  Q5>Q1: {q5_cnt}/{tot} ({q5_cnt/tot*100:.0f}%)")

    # 7. HOLD-OUT TEST
    print("\n" + "="*60)
    print("TEST: HOLD-OUT 20% ZIPs")
    print("="*60)
    col="excess_3y"; v=df.dropna(subset=[col]).copy()
    zips=v["zip_code"].unique()
    rng=np.random.RandomState(42)
    holdout=set(rng.choice(zips,size=int(len(zips)*0.2),replace=False))
    train=v[~v["zip_code"].isin(holdout)]; test=v[v["zip_code"].isin(holdout)]
    ic_tr,_=stats.spearmanr(train["score"],train[col])
    ic_te,_=stats.spearmanr(test["score"],test[col])
    hit_tr=np.mean((train["score"]>50)==(train[col]>0))
    hit_te=np.mean((test["score"]>50)==(test[col]>0))
    print(f"  {'Set':<10} {'N Geo':>8} {'N Obs':>10} {'IC':>8} {'Hit%':>8}")
    print(f"  {'-'*48}")
    print(f"  {'Train':<10} {train['zip_code'].nunique():>8} {len(train):>10} {ic_tr:>+.4f} {hit_tr*100:>7.1f}%")
    print(f"  {'Hold-out':<10} {test['zip_code'].nunique():>8} {len(test):>10} {ic_te:>+.4f} {hit_te*100:>7.1f}%")
    print(f"  Diff: {ic_te-ic_tr:+.4f}  {'PASS' if ic_te>0.05 else 'FAIL'}")

def main():
    print("="*60)
    print("  MISSING TESTS — ZIP")
    print("="*60)
    engine=get_engine(); df=load_and_score(engine); run_missing(df); engine.dispose()
    print("\nDONE.")

if __name__=="__main__": main()
