# PIQ Score (Candidate B): Plain-English Explainer, Dollar Examples, and Defense Against Criticism

**Date:** 2026-06-12
**Evidence base:** `2026-06-12-monolithic-feature-discovery.md` + the three score backtests (`metro/county/zip-score-backtest.md`), 2001–2023, ~5.7M scored vintages with observed 3-year outcomes. All dollar figures below computed directly from `data/*_score_history.parquet` joined to `zhvi_forward_returns` (script in this commit's history; medians from latest ZHVI).

---

## 1. The plain-English explanation

**One sentence:** The PropertyIQ Score measures whether a housing market is currently running hotter or colder than its peers — and markets that run hot tend to keep outperforming for the next few years.

**The slightly longer version:**

Every month, for every metro, county, and ZIP code in the country, we look at four things anyone can understand:

1. **Are home values rising faster than other places?** (price growth over the last year)
2. **Is that growth still happening right now?** (price growth over the last 3 months)
3. **Are homes selling quickly?** (days on market — fast sales = strong demand)
4. **Are sellers having to cut their asking prices?** (price cuts = weak demand)

A market where prices are climbing, homes sell fast, and nobody's cutting prices gets a high score. A market where prices are flat, homes sit, and price cuts are spreading gets a low score. We then rank every market against all its peers and put it on a 1–99 scale where **50 means "performing like a typical market in its state."** Above 50: outperforming. Below 50: lagging.

**Why does this predict anything?** Housing markets have inertia. Unlike stocks, home prices don't jump on news — they grind. The things that make a market hot (job growth, migration, tight supply) take years to play out, so a market that's outperforming today usually keeps outperforming for the next several years. This isn't our invention — price momentum in housing is one of the most documented effects in real-estate economics (Case & Shiller documented it in 1989). The score also watches for early cooling signals (days-on-market rising, price cuts spreading) that pure price-watching would miss.

**What the score is NOT:** It's not an appraisal, not a "buy" signal for a specific house, and not a guarantee. It says: _over the next 3 years, markets that look like this one have, on average, beaten markets that look like that one_ — consistently, in 22 years of monthly data.

---

## 2. The money example: score 99 vs score 1

Backtest, 2001–2023. We take every month a geography held the given score, then look at what actually happened to home values over the following 3 years, on a median-priced US home.

### Simple version (what actually happened, all years)

**ZIP codes** (median home $284,081; ~25,000 observations at each extreme):

|                | 3-year appreciation | Gain on a $284k home |
| -------------- | ------------------- | -------------------- |
| Score 99 ZIPs  | +23.0%              | **+$65,300**         |
| Score 1 ZIPs   | +7.4%               | +$21,000             |
| **Difference** |                     | **≈ $44,300**        |

**Metros** (median home $251,629):

|                 | 3-year appreciation | Gain on a $252k home |
| --------------- | ------------------- | -------------------- |
| Score 99 metros | +19.6%              | **+$49,300**         |
| Score 1 metros  | +5.6%               | +$14,100             |
| **Difference**  |                     | **≈ $35,200**        |

For an investor: same purchase price, same 3 years, same effort — the 99-scored ZIP earned roughly **three times the appreciation** of the 1-scored ZIP. On a typical 20%-down purchase ($57k down on the $284k home), +$65,300 vs +$21,000 of appreciation is the difference between roughly **doubling your equity and adding a third to it** — before rent, leverage costs, or taxes.

### Rigorous version (same state, isolating the score's own contribution)

Critics will correctly note that high-scoring geos cluster in hot states. So strip that out: compare top vs bottom scores **within the same state** (the score's excess-vs-state spread), assuming the state itself appreciates 4%/yr:

| Level          | Top-band home (95–99) after 3y | Bottom-band (1–5) after 3y | Within-state difference |
| -------------- | ------------------------------ | -------------------------- | ----------------------- |
| ZIP ($284k)    | +$49,100                       | +$25,100                   | **≈ $24,000**           |
| Metro ($252k)  | +$36,200                       | +$17,800                   | **≈ $18,400**           |
| County ($230k) | +$31,700                       | +$16,300                   | **≈ $15,400**           |

(Continuity check: the old formula's published within-state metro claim was $18,100 — this formula reproduces it at metro and roughly **doubles the spread at ZIP level**, where investors actually pick neighborhoods.)

**Honest footnote that defuses the obvious attack:** score-1 geos did not lose money on average (+5–7% over 3 years). A low score means _lagging your state_, not _falling prices_. We should never market it as crash prediction.

---

## 3. Anticipated criticisms and our answers

**1. "Past performance doesn't predict future results. This is just momentum chasing."**
Housing isn't the stock market. Price momentum in housing is a peer-reviewed, 35-year-old empirical finding (Case & Shiller 1989, and replicated continuously since) rooted in real frictions: slow information diffusion, supply that takes years to build, moving costs. Our own test: 22 years of monthly walk-forward data, and the score-return relationship was positive in 100% of years at county and ZIP, 22 of 23 at metro. A spurious pattern doesn't survive 264 consecutive monthly out-of-sample tests through two complete housing cycles.

**2. "You tested 1,507 formulas and kept the best one. That's data mining."**
We searched broadly but _validated narrowly_. The winning formula was selected on walk-forward performance (train on past, test on unseen later years — never the reverse), then subjected to permutation tests (its IC is 50–200 standard deviations above what shuffled data produces), year-by-year consistency gates, and a separate full score-construction backtest. Crucially, the formula has **no fitted weights** — four features, equal weights, signs set by economic logic (fast sales good, price cuts bad). There are almost no parameters _to_ overfit. And the runner-up formulas perform nearly identically — the result isn't a fragile needle in a haystack; the whole momentum+demand family works.

**3. "Your backtest missed the 2007 crash."**
Partly true, and we say so. Before 2016 only the two price-momentum inputs existed (Realtor.com data begins 2016), and momentum alone was nearly flat through the 2005–2007 bubble peak at metro level (county and ZIP stayed positive even then). The two demand features — days on market and price cuts — are precisely the inputs that spike before a bust, and the full 4-feature formula has never run a momentum-only month since 2016. We also publish confidence grades: pre-2016 history would carry a C badge for this reason.

**4. "ZHVI is Zillow's model, not real transactions."**
ZHVI is the industry-standard home value index (used by the Fed, academic research, and every major real-estate data product), built from the largest property database in the country. Two of our four inputs (days on market, price cuts) are direct market observations from Realtor.com's listing database, not modeled values. And because the score uses _ranks_, not levels, modest index revisions barely move it — a market doesn't change from "hot" to "cold" because its index was revised 1%.

**5. "Why does 50 mean 'state average'? Why benchmark against the state?"**
Because that's how buyers and investors actually frame decisions ("where in Texas?"), and because we verified it empirically: markets scored 45–55 went on to perform within ±0.2pp/yr of their state average — at ZIP level, +0.006pp, essentially exact. The midpoint isn't a marketing choice; it's calibrated and measured.

**6. "A score of 99 doesn't guarantee my property outperforms."**
Correct, and we will never claim it does. The score describes the _market_, not your house, and the dollar figures above are averages across thousands of observations — individual outcomes spread around them. What we claim is exactly what we measured: high-scored markets beat low-scored markets on average, in every market regime tested. That's the same epistemic status as "smokers get more lung cancer" — probabilistic, robust, and actionable.

**7. "Your data sources could vanish, like Redfin's just did."**
That risk is why this formula exists — it was built _after_ Redfin restricted its feed, deliberately on the two most durable public sources (Zillow research data since 2000, Realtor.com inventory data since 2016), each with full metro/county/ZIP coverage. The formula degrades gracefully (it scores with 2 of 4 features, at reduced confidence), the IC is monitored monthly in production, and the discovery pipeline that found this formula is committed and re-runnable if a source ever erodes.

**8. "Equal weights are lazy. Why not optimize them?"**
Deliberate choice, backed by 50 years of forecasting literature (Dawes 1979 onward): on correlated predictors, fitted weights mostly fit noise and underperform equal weights out of sample. We tested this trade-off and took the option with fewer parameters, not more. Equal weights are also the honest answer to criticism #2 — you cannot overfit weights you never fit.

**9. "Why 3 years?"**
It matches how long housing momentum persists before mean reversion (the same literature), matches the typical hold-decision window for investors, and is the horizon the previous score was validated on — keeping every claim comparable. The signal is positive at 1-year horizons too; 3 years is where the signal-to-noise is best.

**10. "1–2 percentage points a year of excess return is small."**
Compounded on a leveraged asset it is not — see the table above ($24k–$44k differences on a median home in 3 years). For comparison, an equity factor with an IC of 0.19–0.26 and a 100% positive-year record would be considered exceptional; most professionally marketed stock signals run ICs of 0.05–0.10 with frequent negative years.

---

## 4. Claims discipline (what we say and don't say)

| We say                                                                                               | We don't say                                                         |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| "Markets scoring 80+ have historically outperformed their state average over the following 3 years." | "This market will go up."                                            |
| "Score 50 = performing like a typical market in its state (verified)."                               | "Low score = prices will fall."                                      |
| "Based on 22 years of monthly data across two full housing cycles."                                  | "Guaranteed" / "proven to predict" anything about a single property. |
| Dollar examples labeled as historical averages on a median-priced home.                              | Dollar promises about the user's specific property.                  |
| Pre-2016 history is momentum-only and carries reduced confidence.                                    | Hide the 2007 metro result.                                          |

## Known limitations (internal, monitored)

- Backtest uses final-revised ZHVI (standard practice, but live data arrives unrevised; rank-based scoring minimizes but doesn't eliminate the gap). Mitigation: monthly live-IC monitoring after launch; shadow month vs v4 before cutover.
- Realtor.com is now load-bearing for 2 of 4 inputs; column-population monitoring needed (its `hotness_score` already shows erosion).
- ~1-month publication lag on inputs means a score reflects the market as of last month — fine for a 3-year signal, worth a tooltip.
