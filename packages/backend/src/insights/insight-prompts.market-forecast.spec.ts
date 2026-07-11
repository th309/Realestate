import { buildMarketForecastPrompt } from './insight-prompts';
import type { InsightContext } from './insights.types';

const ctx: InsightContext = {
  region_name: 'Austin, TX',
  region_id: '12420',
  geo_level: 'metro',
  scores: { propertyiq: 62, confidence_level: 'B' },
  score_components: {
    zhvi_yoy: { status: 'ok', value: 0.031 },
    median_days_on_market: { status: 'ok', value: 48 },
  },
  key_metrics: {
    home_value: { value: 455000, yoy_change: 0.031, format: 'currency' },
  },
  benchmarks: {
    state_avg: { home_value: 340000 },
    national_avg: { home_value: 360000 },
  },
};

describe('buildMarketForecastPrompt produces an honest, year-aware forecast prompt', () => {
  const prompt = buildMarketForecastPrompt(ctx, 2027);

  it('uses the display year in the required section headers', () => {
    expect(prompt).toContain('## Will Austin, TX Home Prices Crash in 2027?');
    expect(prompt).toContain('## The Bottom Line for 2027');
  });

  it('forbids price predictions via the honesty rule', () => {
    expect(prompt).toContain('momentum outlook, not a price prediction');
    expect(prompt).toContain('Never state or imply a specific future price');
  });

  it('includes the data-grounding rule', () => {
    expect(prompt).toContain('Use ONLY the data provided');
  });

  it('surfaces the confidence grade', () => {
    expect(prompt).toContain('Confidence: B');
  });

  it('handles a missing confidence grade', () => {
    const noGrade = buildMarketForecastPrompt(
      { ...ctx, scores: { propertyiq: 62, confidence_level: null } },
      2027,
    );
    expect(noGrade).toContain('Confidence: not available');
  });
});
