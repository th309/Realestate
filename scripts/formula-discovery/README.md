# PropertyIQ Formula Discovery System

Analyzes **RAW market data** to discover optimal formulas for PropertyIQ scores.

> **Key Point**: This system does NOT use existing scores. It goes back to the raw data (Zillow, Realtor, Census, Economic) to find which metrics actually predict outcomes.

## Quick Start

```bash
# Interactive mode (recommended)
npx ts-node scripts/formula-discovery/run-analysis.ts

# Or run directly
npx ts-node scripts/formula-discovery/discover-optimal-formulas.ts --all
```

## Available Scripts

### 1. `run-analysis.ts` - Interactive Interface

Simple menu-driven interface with these options:

1. **Quick Analysis** - Metro, 3-year, fastest
2. **Full Analysis** - All combinations (takes 10-20 min)
3. **Compare Formulas** - Helps decide: 3 or 9 formulas?
4. **Custom Analysis** - Choose your parameters

```bash
npx ts-node scripts/formula-discovery/run-analysis.ts
```

### 2. `discover-optimal-formulas.ts` - Core Discovery Engine

Analyzes raw data to find optimal weights.

**Options:**
- `--geo=metro|county|zip` - Geography level (default: metro)
- `--horizon=1|3|5|10` - Time horizon in years (default: 3)
- `--outcome=price|rent|total` - What to optimize for (default: price)
- `--all` - Run all combinations

```bash
# Single analysis
npx ts-node scripts/formula-discovery/discover-optimal-formulas.ts --geo=county --horizon=5

# Full sweep
npx ts-node scripts/formula-discovery/discover-optimal-formulas.ts --all
```

### 3. `validate-formulas.ts` - Validation Report

Generates the summary table and validation metrics.

**Options:**
- `--geo=metro|county|zip` - Geography level
- `--horizon=1|3|5` - Time horizon in years
- `--json` - Output raw JSON

```bash
# Generate validation report
npx ts-node scripts/formula-discovery/validate-formulas.ts --geo=metro --horizon=3

# Get JSON output
npx ts-node scripts/formula-discovery/validate-formulas.ts --json
```

## Output Format

The validation report includes:

### Summary Table
| Metric | HomeReady | InvestorEdge | MarketHealth | Meaning |
|--------|-----------|--------------|--------------|---------|
| Top Quintile Excess Return | +X.XX% | +X.XX% | +X.XX% | Higher = better buy signal |
| Bottom Quintile Excess Return | -X.XX% | -X.XX% | -X.XX% | Lower = better avoid signal |
| SPREAD | +X.XX% | +X.XX% | +X.XX% | Bigger = more valuable |
| T-test p-value | <0.001 | 0.XXX | <0.001 | <0.05 = significant |
| Spearman Correlation | 0.XX | 0.XX | 0.XX | >0.3 = meaningful |

### Key Findings
1. Which scores add genuine value
2. Which score is the strongest predictor
3. Avoiding losers vs picking winners

### Dollar Impact
- Top quintile gain vs median
- Bottom quintile loss vs median
- Total value at risk

## How It Works

1. **Data Collection**: Pulls raw metrics from all sources at historical snapshot dates
2. **Outcome Calculation**: Calculates forward price appreciation (1y, 3y, 5y, 10y)
3. **Correlation Analysis**: Finds which metrics correlate with outcomes
4. **Ridge Regression**: Optimizes weights using regularized regression
5. **Quintile Validation**: Tests if high scores → high outcomes

## Understanding the Output

### Do I Need 3 or 9 Formulas?

The "Compare Formulas" option (Option 3) helps answer this:

- **3 formulas** = One per score type (HomeReady, InvestorEdge, MarketHealth)
- **9 formulas** = One per score type × geography level

**Look for:**
1. Are top metrics similar across geo levels? → Use 3 formulas
2. Are spreads similar? → Use 3 formulas
3. Big differences in predictive power? → Use 9 formulas

### Interpreting Validation Metrics

| Metric | Good | Moderate | Weak |
|--------|------|----------|------|
| Spread | >5% | 2-5% | <2% |
| Spearman r | >0.3 | 0.1-0.3 | <0.1 |
| p-value | <0.001 | <0.05 | >0.05 |
| Top Beat Rate | >55% | 50-55% | <50% |
| Bottom Beat Rate | <40% | 40-45% | >45% |

## Technical Notes

- Uses Spearman correlation (rank-based, robust to outliers)
- Ridge regression with λ=0.1 (prevents overfitting)
- Z-score normalization for fair metric comparison
- Requires at least 100 data points for analysis
- Tests across multiple market windows (2015-2021 snapshots)
