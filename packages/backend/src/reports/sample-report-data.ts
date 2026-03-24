/**
 * Populated Data for the Static Sample Report
 *
 * Current metrics, historical time series, benchmarks, demographics,
 * and real-time signals for the DFW sample report.
 *
 * Separated from the main report to keep files under the 300-line limit.
 */

export const SAMPLE_REPORT_DATA = {
  current: {
    home_value: 398000,
    zhvi: 398000,
    median_listing_price: 415000,
    median_sale_price: 392000,
    median_listing_price_yoy: 0.054,
    rent_index: 1920,
    zori: 1920,
    price_to_rent_ratio: 17.3,
    days_on_market: 35,
    inventory: 3.1,
    months_of_supply: 3.4,
    price_reduced_share: 0.26,
    new_listings: 13200,
    pending_sales: 8800,
    sale_to_list_ratio: 0.982,
    mortgage_rate_30yr: 6.38,
    unemployment_rate: 3.4,
    population_growth: 0.019,
    job_growth: 0.026,
    median_household_income: 84200,
    price_to_income_ratio: 4.73,
    rental_vacancy: 0.064,
    homeownership_rate: 0.618,
    building_permits: 4500,
    foreclosure_rate: 0.002,
    home_value_yoy: 5.4,
  },
  historical: {
    home_value: {
      data: [
        { date: '2025-01', value: 377500 },
        { date: '2025-02', value: 379000 },
        { date: '2025-03', value: 381000 },
        { date: '2025-04', value: 383500 },
        { date: '2025-05', value: 385000 },
        { date: '2025-06', value: 388000 },
        { date: '2025-07', value: 390000 },
        { date: '2025-08', value: 391500 },
        { date: '2025-09', value: 392000 },
        { date: '2025-10', value: 393000 },
        { date: '2025-11', value: 394500 },
        { date: '2025-12', value: 395500 },
        { date: '2026-01', value: 396000 },
        { date: '2026-02', value: 397000 },
        { date: '2026-03', value: 398000 },
      ],
      trend: 'up' as const,
      change_pct: 5.4,
    },
    rent_index: {
      data: [
        { date: '2025-01', value: 1810 },
        { date: '2025-04', value: 1840 },
        { date: '2025-07', value: 1870 },
        { date: '2025-10', value: 1895 },
        { date: '2026-01', value: 1910 },
        { date: '2026-03', value: 1920 },
      ],
      trend: 'up' as const,
      change_pct: 6.1,
    },
    days_on_market: {
      data: [
        { date: '2025-01', value: 42 },
        { date: '2025-04', value: 39 },
        { date: '2025-07', value: 33 },
        { date: '2025-10', value: 37 },
        { date: '2026-01', value: 36 },
        { date: '2026-03', value: 35 },
      ],
      trend: 'down' as const,
      change_pct: -16.7,
    },
    inventory: {
      data: [
        { date: '2025-01', value: 2.5 },
        { date: '2025-04', value: 2.8 },
        { date: '2025-07', value: 3.3 },
        { date: '2025-10', value: 3.2 },
        { date: '2026-01', value: 3.1 },
        { date: '2026-03', value: 3.1 },
      ],
      trend: 'up' as const,
      change_pct: 24.0,
    },
    unemployment_rate: {
      data: [
        { date: '2025-01', value: 3.7 },
        { date: '2025-04', value: 3.6 },
        { date: '2025-07', value: 3.5 },
        { date: '2025-10', value: 3.4 },
        { date: '2026-01', value: 3.4 },
        { date: '2026-03', value: 3.4 },
      ],
      trend: 'down' as const,
      change_pct: -8.1,
    },
  },
  benchmarks: {
    national: {
      home_value: 375000,
      rent_index: 1840,
      days_on_market: 40,
      inventory: 3.3,
      unemployment_rate: 3.9,
      price_to_income_ratio: 5.1,
      mortgage_rate_30yr: 6.38,
    },
    state: {
      home_value: 325000,
      rent_index: 1740,
      days_on_market: 38,
      inventory: 3.2,
      unemployment_rate: 3.8,
      price_to_income_ratio: 4.4,
    },
  },
  scores: {
    homeready: {
      score: 76,
      trend: 'up' as const,
      percentile: 72,
      context: {
        interpretation:
          'DFW delivers where it matters most: a stable economic engine, sustained appreciation, and improving buyer leverage.',
        comparison:
          'Outperforms 72% of comparable metros nationwide on homebuyer readiness',
        percentile_text: 'In the 72nd percentile among 384 tracked metro areas',
        dollar_impact:
          'Buyers who purchased at this score level historically saw 18-24% equity gains over 5 years',
      },
    },
    investoredge: { score: 71, trend: 'up' as const, percentile: 63 },
  },
  demographics: {
    population: 8120000,
    median_age: 34.6,
    college_educated_pct: 0.378,
    median_household_income: 84200,
  },
  realtime: {
    signal_summary: {
      overall: 'bullish',
      confidence: 0.72,
      bullish_count: 5,
      bearish_count: 2,
      summary:
        'Mortgage rates trending lower and strong spring hiring momentum favor near-term buyer conditions.',
      factors: [
        'Mortgage rates declined 37 bps since January',
        'March payroll additions beat expectations (+18K in DFW)',
        'New construction deliveries increasing supply',
        'Corporate relocations pipeline remains robust',
        'Tariff uncertainty creating mild consumer hesitancy',
      ],
    },
    news: [
      {
        title:
          'Texas Instruments Breaks Ground on $30B Semiconductor Campus in Sherman',
        source: 'Dallas Morning News',
        date: '2026-03-18',
        sentiment: 'bullish',
        summary:
          'The expansion will create 3,000+ jobs in the extended DFW corridor, supporting continued housing demand in northern suburbs.',
      },
      {
        title: 'Fed Signals Two More Rate Cuts in 2026, Mortgage Markets Rally',
        source: 'Reuters',
        date: '2026-03-15',
        sentiment: 'bullish',
        summary:
          'The 30-year fixed rate has fallen to 6.38% from 6.75% at year-start, improving purchasing power by roughly $18,000 for the median DFW buyer.',
      },
      {
        title: 'DFW Apartment Vacancy Ticks Up to 6.4%, Easing Rent Pressure',
        source: 'CoStar Group',
        date: '2026-03-12',
        sentiment: 'neutral',
        summary:
          'Rising multifamily completions are moderating rent growth, which may slow the transition from renting to buying for some households.',
      },
    ],
    economic_indicators: [
      {
        name: 'DFW Job Growth (YoY)',
        value: '+2.6%',
        trend: 'up',
        context: 'vs. +1.4% national average',
      },
      {
        name: '30-Year Mortgage Rate',
        value: '6.38%',
        trend: 'down',
        context: 'down from 6.75% in January',
      },
      {
        name: 'Consumer Confidence (TX)',
        value: '102.4',
        trend: 'stable',
        context: 'above 100 = expansion territory',
      },
    ],
  },
};
