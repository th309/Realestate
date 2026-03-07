import {
  computeScenarioInputs,
  calculateMaxLoanForPayment,
} from '../scenario-computation';
import { calcMonthlyPayment } from '../narrative-insights';

// ── Rate Scenarios ───────────────────────────────────────────────────────

describe('computeScenarioInputs rate scenarios show payment deltas', () => {
  const baseMetrics = { zhvi: 400_000 };

  it('computes rate hold and rate drop payments', () => {
    const result = computeScenarioInputs(baseMetrics, null, 'homebuyer');
    expect(result.rate_hold_monthly_payment).toContain('6.5%');
    expect(result.rate_hold_monthly_payment).toContain('stays at');
    expect(result.rate_drop_monthly_payment).toContain('5.5%');
    expect(result.rate_drop_monthly_payment).toContain('drops to');
    expect(result.rate_drop_monthly_payment).toContain('-$');
  });

  it('uses user-provided mortgage rate when available', () => {
    const result = computeScenarioInputs(baseMetrics, null, 'homebuyer', {
      mortgage_rate: 7.0,
    });
    expect(result.rate_hold_monthly_payment).toContain('7.0%');
    expect(result.rate_drop_monthly_payment).toContain('6.0%');
  });

  it('uses user-provided down payment percentage', () => {
    const result = computeScenarioInputs(baseMetrics, null, 'homebuyer', {
      down_payment_pct: 10,
    });
    // 10% down on $400K = $360K loan, larger payments
    expect(result.rate_hold_monthly_payment).toBeDefined();
    // Verify the payment is higher than with 20% down
    const result20 = computeScenarioInputs(baseMetrics, null, 'homebuyer');
    // Extract dollar amounts (rough check — both should be present)
    expect(result.rate_hold_monthly_payment).not.toBe(
      result20.rate_hold_monthly_payment,
    );
  });

  it('computes buying power change at lower rate', () => {
    const result = computeScenarioInputs(baseMetrics, null, 'homebuyer');
    expect(result.rate_drop_buying_power_change).toContain('more home');
    expect(result.rate_drop_buying_power_change).toContain('5.5%');
    expect(result.rate_drop_buying_power_change).toContain('$');
  });
});

// ── calculateMaxLoanForPayment ───────────────────────────────────────────

describe('calculateMaxLoanForPayment inverts the mortgage formula', () => {
  it('round-trips with calcMonthlyPayment', () => {
    const loan = 320_000;
    const rate = 0.065;
    const years = 30;
    const payment = calcMonthlyPayment(loan, rate, years);
    const recoveredLoan = calculateMaxLoanForPayment(payment, rate, years);
    expect(recoveredLoan).toBeCloseTo(loan, 0);
  });

  it('handles zero interest rate', () => {
    const maxLoan = calculateMaxLoanForPayment(1000, 0, 30);
    expect(maxLoan).toBe(360_000);
  });
});

// ── Price Correction Scenarios ───────────────────────────────────────────

describe('computeScenarioInputs price correction scenarios', () => {
  it('computes 10% correction with equity impact', () => {
    const result = computeScenarioInputs({ zhvi: 500_000 }, null, 'homebuyer');
    // 10% of $500K = $50K loss; 20% down = $100K; 50% of equity
    expect(result.correction_10pct_new_price).toContain('$450,000');
    expect(result.correction_10pct_equity_impact).toContain('$50,000');
    expect(result.correction_10pct_equity_impact).toContain('50%');
  });

  it('uses actual zhvi_yoy for appreciation scenario when available', () => {
    const result = computeScenarioInputs(
      { zhvi: 400_000, zhvi_yoy: 8.0 },
      null,
      'homebuyer',
    );
    expect(result.appreciation_5pct_equity_gain).toContain('8.0%');
    expect(result.appreciation_5pct_equity_gain).toContain('$32,000');
  });

  it('falls back to 5% appreciation when zhvi_yoy is missing', () => {
    const result = computeScenarioInputs({ zhvi: 400_000 }, null, 'homebuyer');
    expect(result.appreciation_5pct_equity_gain).toContain('5.0%');
    expect(result.appreciation_5pct_equity_gain).toContain('$20,000');
  });

  it('adjusts equity impact for investor 25% default down payment', () => {
    const result = computeScenarioInputs({ zhvi: 400_000 }, null, 'investor');
    // 10% of $400K = $40K loss; 25% down = $100K; 40% of equity
    expect(result.correction_10pct_equity_impact).toContain('40%');
  });
});

// ── Investment Return Scenarios ──────────────────────────────────────────

describe('computeScenarioInputs investment return scenarios', () => {
  it('computes bull/base/bear cases with job growth context', () => {
    const result = computeScenarioInputs(
      { zhvi: 300_000, zhvi_yoy: 5.0, gross_yield: 6.0, job_growth_yoy: 2.5 },
      null,
      'investor',
    );
    expect(result.bull_case_total_return).toContain('Bull case');
    expect(result.bull_case_total_return).toContain('total return');
    expect(result.bull_case_total_return).toContain('2.5%');
    expect(result.base_case_total_return).toContain('Base case');
    expect(result.bear_case_total_return).toContain('Bear case');
  });

  it('uses unemployment for bear case driver when available', () => {
    const result = computeScenarioInputs(
      {
        zhvi: 300_000,
        zhvi_yoy: 4.0,
        gross_yield: 5.5,
        unemployment_rate: 3.8,
      },
      null,
      'investor',
    );
    expect(result.bear_case_total_return).toContain('3.8%');
    expect(result.bear_case_total_return).toContain('5.3%');
  });

  it('uses fallback drivers when job/unemployment data missing', () => {
    const result = computeScenarioInputs(
      { zhvi: 300_000, zhvi_yoy: 4.0, gross_yield: 5.0 },
      null,
      'investor',
    );
    expect(result.bull_case_total_return).toContain('economic tailwinds');
    expect(result.bear_case_total_return).toContain('economic headwinds');
  });

  it('returns empty scenario fields when both yield and yoy missing', () => {
    const result = computeScenarioInputs({ zhvi: 300_000 }, null, 'investor');
    expect(result.bull_case_total_return).toBeUndefined();
    expect(result.base_case_total_return).toBeUndefined();
    expect(result.bear_case_total_return).toBeUndefined();
  });
});

// ── Graceful Missing Data ────────────────────────────────────────────────

describe('computeScenarioInputs handles missing data gracefully', () => {
  it('returns empty object when price is missing', () => {
    const result = computeScenarioInputs({}, null, 'homebuyer');
    expect(result).toEqual({});
  });

  it('works with median_listing_price fallback', () => {
    const result = computeScenarioInputs(
      { median_listing_price: 350_000 },
      null,
      'homebuyer',
    );
    expect(result.rate_hold_monthly_payment).toBeDefined();
    expect(result.correction_10pct_new_price).toContain('$315,000');
  });

  it('includes rate and correction scenarios even without yield data', () => {
    const result = computeScenarioInputs({ zhvi: 400_000 }, null, 'homebuyer');
    expect(result.rate_hold_monthly_payment).toBeDefined();
    expect(result.rate_drop_monthly_payment).toBeDefined();
    expect(result.correction_10pct_new_price).toBeDefined();
    // No investment return scenarios without yield/yoy
    expect(result.bull_case_total_return).toBeUndefined();
  });
});
