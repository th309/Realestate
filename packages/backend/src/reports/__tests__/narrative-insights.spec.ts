import {
  computeAnalyticalInsights,
  calcMonthlyPayment,
  classifyMarketPhase,
  classifyTrajectory,
} from '../narrative-insights';
import { computeInvestmentMath } from '../narrative-insights-investment';

// ── Monthly Payment ──────────────────────────────────────────────────────

describe('calcMonthlyPayment computes standard mortgage formula', () => {
  it('calculates correctly for a $400K loan at 6.5%', () => {
    const monthly = calcMonthlyPayment(400_000, 0.065, 30);
    // Known correct: ~$2,528
    expect(monthly).toBeCloseTo(2528.27, 0);
  });

  it('handles zero interest rate', () => {
    const monthly = calcMonthlyPayment(360_000, 0, 30);
    expect(monthly).toBe(1000);
  });

  it('calculates correctly for a $200K loan at 7%', () => {
    const monthly = calcMonthlyPayment(200_000, 0.07, 30);
    expect(monthly).toBeCloseTo(1330.6, 0);
  });
});

// ── DTI Qualifier Thresholds ─────────────────────────────────────────────

describe('DTI qualifier text matches threshold ranges', () => {
  const baseBenchmarks = {};

  it('returns "well within" for DTI < 28%', () => {
    const result = computeAnalyticalInsights(
      { zhvi: 200_000, median_household_income: 120_000 },
      null,
      baseBenchmarks,
      'homebuyer',
    );
    expect(result.dti_at_median_income).toContain(
      'well within conventional limits',
    );
  });

  it('returns "within" for DTI 28-36%', () => {
    const result = computeAnalyticalInsights(
      { zhvi: 400_000, median_household_income: 75_000 },
      null,
      baseBenchmarks,
      'homebuyer',
    );
    expect(result.dti_at_median_income).toContain('within conventional limits');
    expect(result.dti_at_median_income).not.toContain('well within');
  });

  it('returns "at the edge" for DTI 36-43%', () => {
    const result = computeAnalyticalInsights(
      { zhvi: 500_000, median_household_income: 80_000 },
      null,
      baseBenchmarks,
      'homebuyer',
    );
    expect(result.dti_at_median_income).toContain(
      'at the edge of conventional limits',
    );
  });

  it('returns "exceeds" for DTI > 43%', () => {
    const result = computeAnalyticalInsights(
      { zhvi: 800_000, median_household_income: 70_000 },
      null,
      baseBenchmarks,
      'homebuyer',
    );
    expect(result.dti_at_median_income).toContain(
      'exceeds conventional limits',
    );
  });
});

// ── Market Phase Classification ──────────────────────────────────────────

describe('classifyMarketPhase returns correct phase label', () => {
  // priceCutPct is an integer-scale percent per narrative-insights.ts:170
  // (e.g. 24.11 means 24.11% of listings cut). Tests originally used
  // decimal fractions (0.25) which only matters for the Early-Contraction
  // branch that actually reads cuts > 20; the rest passed by coincidence.
  it('returns Peak Expansion for low supply + high growth', () => {
    expect(classifyMarketPhase(2.0, 10, 8.0)).toContain('Peak Expansion');
  });

  it('returns Late Expansion for moderate supply + positive growth', () => {
    expect(classifyMarketPhase(3.5, 15, 3.0)).toContain('Late Expansion');
  });

  it('returns Balanced for 4-6 months of supply', () => {
    expect(classifyMarketPhase(5.0, 20, 1.0)).toContain('Balanced');
  });

  it('returns Early Contraction for high supply + high price cuts', () => {
    expect(classifyMarketPhase(7.0, 25, -1.0)).toContain('Early Contraction');
  });

  it("returns Buyer's Market for high supply + low price cuts", () => {
    expect(classifyMarketPhase(7.0, 10, -2.0)).toContain("Buyer's Market");
  });

  it('returns Transitional for edge cases (e.g. low supply, negative growth)', () => {
    expect(classifyMarketPhase(3.5, 10, -1.0)).toContain('Transitional');
  });

  it('returns insufficient data when months_of_supply is null', () => {
    expect(classifyMarketPhase(null, 15, 5.0)).toContain('Insufficient data');
  });
});

// ── Appreciation Trajectory ──────────────────────────────────────────────

describe('classifyTrajectory detects acceleration, deceleration, steady', () => {
  it('detects Accelerating when 1Y >> 3Y/5Y', () => {
    const result = classifyTrajectory(8.2, 6.1, 5.4);
    expect(result).toContain('Accelerating');
    expect(result).toContain('8.2%');
  });

  it('detects Decelerating when 1Y << 3Y/5Y', () => {
    const result = classifyTrajectory(3.0, 5.5, 6.0);
    expect(result).toContain('Decelerating');
  });

  it('detects Steady when values are close', () => {
    const result = classifyTrajectory(5.0, 5.5, 5.2);
    expect(result).toContain('Steady');
  });

  it('returns raw value when only 1Y data available', () => {
    const result = classifyTrajectory(4.5, null, null);
    expect(result).toBe('4.5% 1Y');
  });

  it('returns Insufficient data when yoy is null', () => {
    expect(classifyTrajectory(null, 5.0, 4.0)).toBe('Insufficient data');
  });
});

// ── Investment Math ──────────────────────────────────────────────────────

describe('computeInvestmentMath calculates net yield and CoC correctly', () => {
  const investorMetrics = {
    zhvi: 300_000,
    zori: 2_000,
    zhvi_yoy: 5.0,
  };

  it('produces net_yield_estimate with expense breakdown', () => {
    const result = computeInvestmentMath(investorMetrics);
    expect(result.net_yield_estimate).toContain('net yield');
    expect(result.net_yield_estimate).toContain('vacancy');
    expect(result.net_yield_estimate).toContain('maintenance');
    expect(result.net_yield_estimate).toContain('mgmt');
  });

  it('produces cash_on_cash_estimate', () => {
    const result = computeInvestmentMath(investorMetrics);
    expect(result.cash_on_cash_estimate).toContain('CoC return');
    expect(result.cash_on_cash_estimate).toContain('25%');
  });

  it('produces monthly_cash_flow_estimate', () => {
    const result = computeInvestmentMath(investorMetrics);
    expect(result.monthly_cash_flow_estimate).toContain('/mo net cash flow');
  });

  it('produces total_return_estimate when zhvi_yoy is available', () => {
    const result = computeInvestmentMath(investorMetrics);
    expect(result.total_return_estimate).toContain('total return');
  });

  it('produces break_even_occupancy', () => {
    const result = computeInvestmentMath(investorMetrics);
    expect(result.break_even_occupancy).toContain('occupancy to break even');
  });

  it('returns empty object when price or rent is missing', () => {
    expect(computeInvestmentMath({ zhvi: 300_000 })).toEqual({});
    expect(computeInvestmentMath({ zori: 2_000 })).toEqual({});
    expect(computeInvestmentMath({})).toEqual({});
  });
});

// ── Graceful Missing Data ────────────────────────────────────────────────

describe('computeAnalyticalInsights handles missing data gracefully', () => {
  it('returns partial results with minimal metrics', () => {
    const result = computeAnalyticalInsights({}, null, {}, 'homebuyer');
    // Should not throw; may return trend fields with 'Insufficient data'
    expect(result.appreciation_trajectory).toBe('Insufficient data');
    expect(result.rent_growth_trajectory).toBe('Insufficient data');
    expect(result.monthly_payment_estimate).toBeUndefined();
  });

  it('produces affordability insights without benchmarks', () => {
    const result = computeAnalyticalInsights(
      { zhvi: 400_000, median_household_income: 90_000 },
      null,
      {},
      'homebuyer',
    );
    expect(result.monthly_payment_estimate).toBeDefined();
    expect(result.dti_at_median_income).toBeDefined();
    expect(result.price_vs_national_pct).toBeUndefined();
  });

  it('skips investment math for homebuyer user type', () => {
    const result = computeAnalyticalInsights(
      { zhvi: 300_000, zori: 2_000 },
      null,
      {},
      'homebuyer',
    );
    expect(result.net_yield_estimate).toBeUndefined();
    expect(result.cash_on_cash_estimate).toBeUndefined();
  });

  it('includes investment math for investor user type', () => {
    const result = computeAnalyticalInsights(
      { zhvi: 300_000, zori: 2_000, zhvi_yoy: 5.0 },
      null,
      {},
      'investor',
    );
    expect(result.net_yield_estimate).toBeDefined();
    expect(result.cash_on_cash_estimate).toBeDefined();
  });

  it('computes price_vs_national when national benchmark exists', () => {
    const result = computeAnalyticalInsights(
      { zhvi: 350_000 },
      null,
      { national: { zhvi: 300_000 } },
      'homebuyer',
    );
    expect(result.price_vs_national_pct).toContain('above national median');
  });

  it('computes downside_scenario when unemployment is available', () => {
    const result = computeAnalyticalInsights(
      { unemployment_rate: 4.2 },
      null,
      {},
      'homebuyer',
    );
    expect(result.downside_scenario).toContain('6.2%');
    expect(result.downside_scenario).toContain('8-12% correction');
  });
});
