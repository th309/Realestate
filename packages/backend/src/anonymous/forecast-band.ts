/**
 * Forecast band (modeled 80% confidence interval) for the listing-presentation
 * Forecast section.
 *
 * HONESTY CONTRACT: the backend has only a POINT 12-month home-value forecast
 * (Zillow ZHVF `zhvf_12m`, a % change). It ships NO confidence interval. Rather
 * than fabricate a band, we DERIVE an 80% interval from the market's OWN realized
 * price volatility — a standard random-walk forecast cone:
 *
 *   center path : today's price compounded monthly to the Zillow point forecast
 *   spread      : ±z80 · sigma_monthly · sqrt(h)   (widens with horizon h = "cone")
 *                 sigma_monthly = std-dev of the market's recent monthly % changes
 *                 z80 = 1.2816 (10th/90th percentile of the standard normal)
 *
 * Every input is real market data; only the random-walk assumption is modeled.
 * The section copy labels it "modeled 80% interval" so the assumption is disclosed.
 */

export interface ForecastBand {
  /** last 12 raw ZHVI values (oldest -> newest), for the historic line */
  historic: number[];
  /** next 12 modeled monthly values (the center path) */
  forecast: number[];
  /** 80% lower bound, per forecast month (same length as forecast) */
  ciLow: number[];
  /** 80% upper bound, per forecast month (same length as forecast) */
  ciHigh: number[];
  /** forecast[11] — the 12-month point projection */
  projectedValue: number;
  /** ciLow[11] — 12-month lower bound */
  ciLow12: number;
  /** ciHigh[11] — 12-month upper bound */
  ciHigh12: number;
}

/** 10th/90th percentile of the standard normal → an 80% interval. */
const Z80 = 1.2816;
const HORIZON = 12;
/** Cap the volatility lookback so the band reflects RECENT regime, not 2008. */
const LOOKBACK_RETURNS = 24;

/** Sample standard deviation (n-1). */
function sampleStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Build the forecast band from a historical price series + Zillow's point forecast.
 *
 * @param series          historical monthly ZHVI values, oldest -> newest (>= 2)
 * @param forecast12mPct  Zillow 12-month forecast as a percent (e.g. 4.2 = +4.2%)
 * @returns the band, or null if there is not enough history to model it
 *
 * ── LEARNING-MODE CONTRIBUTION POINT ──────────────────────────────────────
 * The block below is the ONE genuine modeling decision in this task. The
 * default is a simple random-walk cone (simple monthly returns, 24-month
 * lookback, multiplicative ±band). Valid alternatives you may prefer:
 *   • log returns + exp() bounds (cleaner for compounding, never goes negative)
 *   • a shorter/longer sigma window (12 = jumpier, 36 = smoother)
 *   • a different z (1.645 = 90% interval, 1.96 = 95%)
 * Tweak `sigma`, `g`, and the per-month loop to taste — everything downstream
 * (projectedValue / ciLow12 / ciHigh12) flows from the three arrays.
 * ──────────────────────────────────────────────────────────────────────────
 */
export function computeForecastBand(
  series: number[],
  forecast12mPct: number,
): ForecastBand | null {
  const clean = series.filter((v) => Number.isFinite(v) && v > 0);
  if (clean.length < 2 || !Number.isFinite(forecast12mPct)) return null;

  const current = clean[clean.length - 1];

  // monthly % changes over the recent lookback window
  const window = clean.slice(-(LOOKBACK_RETURNS + 1));
  const returns: number[] = [];
  for (let i = 1; i < window.length; i++) {
    returns.push(window[i] / window[i - 1] - 1);
  }
  const sigma = sampleStdDev(returns);

  // center path: compound monthly so month 12 lands exactly on the point forecast
  const g = Math.pow(1 + forecast12mPct / 100, 1 / HORIZON) - 1;

  const forecast: number[] = [];
  const ciLow: number[] = [];
  const ciHigh: number[] = [];
  for (let m = 1; m <= HORIZON; m++) {
    const center = current * Math.pow(1 + g, m);
    const halfWidth = Z80 * sigma * Math.sqrt(m); // relative; widens with sqrt(h)
    forecast.push(center);
    ciLow.push(center * (1 - halfWidth));
    ciHigh.push(center * (1 + halfWidth));
  }

  return {
    historic: clean.slice(-12),
    forecast,
    ciLow,
    ciHigh,
    projectedValue: forecast[HORIZON - 1],
    ciLow12: ciLow[HORIZON - 1],
    ciHigh12: ciHigh[HORIZON - 1],
  };
}
