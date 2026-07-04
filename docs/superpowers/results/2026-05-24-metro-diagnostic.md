# Metro pre-modeling diagnostic

**Run date:** 2026-05-24

## Panel scale

- Joined panel: **275,394 rows** (2000-01-31 -> 2023-01-31)
- Candidate features: **154**
- Peer tier distribution: {1: np.int64(173739), 2: np.int64(17130)}

## Feature coverage (post-2012)

- Features with >=30% coverage in ANY post-2012 year: **26 / 154**

### Features w/ >=30% coverage by year (count)

```
year
2000     1
2001     1
2002     1
2003     1
2004     1
2005     1
2006     1
2007     1
2008     1
2009     1
2010     1
2011    12
2012    14
2013    14
2014    14
2015    16
2016    14
2017    19
2018    24
2019    24
2020    24
2021    24
2022    24
2023    22
```

## Target sanity

### excess_3y by year

```
      count    mean     std     min     max
year                                       
2000   5399  0.0040  0.0690 -0.3787  0.3068
2001   5851  0.0068  0.0883 -0.4585  0.4388
2002   5930  0.0079  0.1129 -0.5434  0.5149
2003   6165  0.0053  0.1198 -0.5675  0.4991
2004   6407  0.0007  0.1065 -0.3440  1.6374
2005   6566 -0.0017  0.0909 -0.4410  1.5559
2006   6875 -0.0020  0.0942 -0.4571  1.5633
2007   7064 -0.0010  0.0796 -0.4256  0.3478
2008   7306 -0.0002  0.0673 -0.3257  0.3389
2009   9275  0.0017  0.0582 -0.2629  0.4792
2010   9738  0.0039  0.0714 -0.3092  0.8112
2011   9868  0.0045  0.0887 -0.4201  0.5800
2012  10442  0.0055  0.1007 -0.4588  0.6832
2013  10544  0.0019  0.0862 -0.6235  0.4600
2014  10623  0.0001  0.0798 -0.6249  0.5791
2015  14254 -0.0013  0.0803 -0.5070  0.7173
2016  17641 -0.0031  0.0814 -0.4816  1.4942
2017  20604 -0.0040  0.0707 -0.2867  1.2470
2018  20600 -0.0050  0.1021 -0.3270  2.0976
2019  20624 -0.0056  0.1192 -0.4061  2.1553
2020  20628 -0.0034  0.0999 -0.4580  0.3652
2021  20632 -0.0005  0.0847 -0.7332  0.3614
2022  20638  0.0022  0.0774 -0.7086  1.6869
2023   1720  0.0022  0.0920 -0.7114  1.6869
```

### excess_3y by peer tier

```
            count    mean     std     min     max
peer_tier                                        
1          250186  0.0004  0.0849 -0.7332  2.1553
2           25208 -0.0085  0.1294 -0.5433  1.3725
```

## Univariate predictive power (Spearman IC vs excess_3y)

- Features with |IC| >= 0.05: **61 / 154**

### Top 10 by |IC|

```
                                      feature  ic_overall       p_value  n_obs  pct_positive_years  ic_year_mean
            rfdc_rhpi_redfin_home_price_index   -0.341511 8.709535e-142   5185            0.181818     -0.123691
              rfdc_cash_loan_percent_fha_loan    0.198705  2.089093e-42   4626            0.583333      0.040825
   rfdc_investors_investor_home_purchases_yoy    0.176099  1.428221e-20   2747            0.681818      0.088593
        rfdc_housing_market_median_sale_price   -0.172203  4.289272e-73  10866            0.333333     -0.112182
                         realtor_demand_score    0.164737 7.400354e-115  18862            1.000000      0.183617
             rfdc_delistings_total_delistings   -0.152197  6.913765e-36   6676            0.000000     -0.189334
rfdc_housing_market_median_days_on_market_yoy   -0.147173  5.355659e-53  10725            0.083333     -0.124007
              rfdc_buyers_sellers_sellers_yoy   -0.132971  7.086366e-15   3398            0.142857     -0.140039
             rfdc_delistings_total_relistings   -0.132861  1.143387e-28   6931            0.000000     -0.177491
   rfdc_buyers_sellers_buyer_seller_ratio_yoy    0.126458  2.505967e-13   3325            0.857143      0.122012
```

## Verdict

**✅ Worth running the full pipeline.** 61 features above |IC|=0.05 — enough raw material for LightGBM+SHAP feature discovery to work with.
