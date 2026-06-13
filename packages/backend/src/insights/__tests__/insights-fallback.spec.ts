import { buildFallbackInsightContent } from '../insights-fallback';

describe('buildFallbackInsightContent', () => {
  const ctx = {
    region_name: 'Austin, TX',
    score: 72,
    grade: 'B',
    median_price: 469000,
    days_on_market: 90,
    price_reduced_share: 0.18,
    zhvi_yoy: 0.021,
  } as any;

  it('produces plain prose with the real numbers and no markdown/em-dash/identifiers', () => {
    const text = buildFallbackInsightContent(ctx, 'market_overview');
    expect(text).toContain('Austin, TX');
    expect(text).toContain('72');
    expect(text).not.toMatch(/[*_#]/); // no markdown
    expect(text).not.toContain('—'); // no em-dash
    expect(text).not.toContain('price_reduced_share'); // no raw identifiers
    expect(text.length).toBeGreaterThan(80);
  });

  it('omits a metric sentence when the value is null', () => {
    const text = buildFallbackInsightContent(
      { ...ctx, days_on_market: null },
      'market_take',
    );
    expect(text).not.toMatch(/days on market/i);
  });
});
