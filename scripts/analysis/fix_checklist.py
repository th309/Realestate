import re

with open('scripts/analysis/output/validation_report_v4_demand_signal.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find start and end of section 14
start = None
end = None
for i, line in enumerate(lines):
    if line.startswith('## 14. Complete Robustness'):
        start = i
    elif start and line.startswith('## 15.'):
        end = i
        break

if start and end:
    new_section = """## 14. Complete Robustness Checklist --- All Geographies

All 12 tests across all 3 geography levels. Grouped by category for easy scanning.

### 14.1 Predictive Power

*Can the score predict future returns out-of-sample (using only past data)?*

| Metric                        | Metro   | County  | ZIP     | Threshold | Status         |
| ----------------------------- | ------: | ------: | ------: | --------- | -------------- |
| Walk-forward IC (1Y)          |  +0.240 |  +0.162 |  +0.151 | > 0.10    | ALL PASS       |
| Walk-forward IC (3Y)          |  +0.234 |  +0.173 |  +0.120 | > 0.10    | ALL PASS       |
| % years positive IC (1Y)      |    100% |    100% |    100% | > 80%     | ALL PASS       |
| % years positive IC (3Y)      |    100% |    100% |    100% | > 80%     | ALL PASS       |
| Rolling 3-year window (1Y)    |  100% + |  100% + |  100% + | > 80%     | ALL PASS       |

### 14.2 Statistical Significance

*Is the signal real, or could random chance explain it?*

| Metric                         | Metro           | County          | ZIP             | Status   |
| ------------------------------ | --------------: | --------------: | --------------: | -------- |
| Permutation shuffles run       |          10,000 |           5,000 |           2,000 |          |
| Times random beat actual       |               0 |               0 |               0 | ALL PASS |
| Standard deviations from random|            75.5 |             100 |              71 | ALL PASS |
| Bootstrap 95% CI (1Y)          | [0.211, 0.221]  | [0.155, 0.162]  | [0.155, 0.164]  | ALL PASS |
| Bootstrap 95% CI (3Y)          | [0.215, 0.228]  | [0.169, 0.176]  | [0.134, 0.143]  | ALL PASS |
| P(IC > 0) across all resamples |            100% |            100% |            100% | ALL PASS |

### 14.3 Monotonicity

*Does a higher score always correspond to better actual performance?*

| Metric                          | Metro       | County            | ZIP          | Status              |
| ------------------------------- | ----------: | ----------------: | -----------: | ------------------- |
| Decile table monotonic (1Y)     | YES         | YES               | YES          | ALL PASS            |
| Decile table monotonic (3Y)     | YES         | NO (score 100)    | YES          | County WATCH        |
| Q5 beats Q1 every year (1Y)     | 14/14 100%  | 14/14 100%        | 14/14 100%   | ALL PASS            |
| Q5 beats Q1 every year (3Y)     | 12/12 100%  | 12/12 100%        | 12/12 100%   | ALL PASS            |
| Yearly calibration monotonic 1Y | 12/14 (86%) | 13/14 (93%)       | 10/14 (71%)  | ALL PASS            |
| Yearly calibration monotonic 3Y | 9/12 (75%)  | 10/12 (83%)       | 6/12 (50%)   | ZIP 3Y WATCH        |

### 14.4 Stability Over Time

*Does the signal hold up across booms, busts, and rate changes?*

| Metric                     | Metro            | County          | ZIP                | Status           |
| -------------------------- | ---------------: | --------------: | -----------------: | ---------------- |
| Structural break detected  | None             | Minor drift 2/6 | DRIFT 5/6 (3Y)    | ZIP 3Y WATCH     |
| Signal decay slope (1Y)    | +0.007 (better)  | -0.001 (flat)   | -0.006 (flat)      | ALL PASS         |
| Signal decay slope (3Y)    | +0.006 (better)  | -0.001 (flat)   | -0.015 (weakening) | ZIP 3Y WATCH     |
| Information Ratio (1Y)     | 3.65             | 2.55            | 2.95               | ALL PASS         |
| Information Ratio (3Y)     | 6.56             | 3.00            | 1.88               | ZIP 3Y WATCH     |
| Works in all rate regimes  | YES              | YES             | YES                | ALL PASS         |

### 14.5 Score Persistence

*Are scores stable month-to-month, or random noise?*

| Lag        | Metro  | County | ZIP    |
| ---------- | -----: | -----: | -----: |
| 1 month    | +0.554 | +0.370 | +0.737 |
| 3 months   | +0.477 | +0.324 | +0.297 |
| 6 months   | +0.404 | +0.273 | +0.244 |
| 12 months  | +0.360 | +0.252 | +0.236 |
| 24 months  | +0.205 | +0.142 | +0.126 |

Scores are moderately persistent. A high-scoring market stays high for months but shifts over 1-2 years as conditions change. **Status: ALL PASS.**

### 14.6 Worst-Case Performance

*What is the longest period where the score failed to predict correctly?*

| Metric                   | Metro   | County  | ZIP     | Status   |
| ------------------------ | ------: | ------: | ------: | -------- |
| Total months tested      |     158 |     158 |     156 |          |
| Months with negative IC  |   0 (0%)| 7 (4.4%)| 0 (0.0%)|          |
| Longest negative streak  |       0 |       7 |       0 | ALL PASS |
| Worst single month IC    |  +0.043 |  -0.089 |  +0.023 |          |
| Best single month IC     |  +0.387 |  +0.352 |  +0.257 |          |

### 14.7 Generalization

*Does the score work on markets it has never been tested against?*

| Metric              | Metro   | County  | ZIP     | Status   |
| ------------------- | ------: | ------: | ------: | -------- |
| Held-out geos (20%) |     149 |     593 |   3,923 |          |
| Training set IC     |  +0.223 |  +0.173 |  +0.142 |          |
| Hold-out set IC     |  +0.217 |  +0.165 |  +0.138 | ALL PASS |
| IC difference       |  -0.006 |  -0.008 |  -0.004 |          |

### 14.8 Final Scorecard

| Geography    | Tests | PASS   | WATCH | FAIL |
| ------------ | :---: | :----: | :---: | :--: |
| **Metro**    |    21 | **21** |     0 |    0 |
| **County**   |    21 | **20** |     1 |    0 |
| **ZIP (1Y)** |    21 | **21** |     0 |    0 |
| **ZIP (3Y)** |    21 | **17** |     4 |    0 |

**WATCH items (ZIP 3-Year horizon only):**
1. Calibration monotonicity: only 50% of years are fully monotonic at the quintile level
2. Structural break: 3Y IC dropped from 0.24 to 0.08 mid-period, then recovered to 0.13
3. Signal decay: slope of -0.015/yr is statistically significant (p = 0.03)
4. Information Ratio of 1.88 is below the 2.0 consistency threshold

**No FAIL at any geography level. Zero.**

"""

    lines[start:end] = [new_section]

    with open('scripts/analysis/output/validation_report_v4_demand_signal.md', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Done - checklist replaced")
else:
    print(f"Could not find section boundaries: start={start}, end={end}")
