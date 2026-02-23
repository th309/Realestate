import {
  computeMarketStance,
  MarketStance,
  StanceSignal,
  StanceResult,
  StanceMetrics,
} from './market-stance.engine';
import { NationalBenchmarks } from '../market-intelligence.types';

/** Default StanceMetrics with no-signal values for convenience */
function makeMetrics(overrides: Partial<StanceMetrics> = {}): StanceMetrics {
  return {
    appreciation_yoy: null,
    population_growth: null,
    vacancy_rate: null,
    dom_yoy_change: null,
    homeready_score: null,
    unemployment_rate: null,
    cap_rate: null,
    positive_news_count: 0,
    negative_news_count: 0,
    ...overrides,
  };
}

describe('computeMarketStance', () => {
  const nationalBenchmarks: NationalBenchmarks = {
    vacancy_rate: 5.1,
    appreciation_yoy: 3.0,
    unemployment_rate: 3.8,
  };

  describe('strong_bullish stance', () => {
    it('returns strong_bullish when 4+ bullish signals present', () => {
      const metrics = makeMetrics({
        appreciation_yoy: 5.0,
        population_growth: 1.2,
        vacancy_rate: 3.5,
        dom_yoy_change: -10,
        homeready_score: 85,
        unemployment_rate: 2.5, // below national - 0.5
        cap_rate: 6.0,
      });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(result.stance).toBe('strong_bullish');
      expect(result.bullish_count).toBeGreaterThanOrEqual(4);
      expect(result.bearish_count).toBe(0);
    });
  });

  describe('strong_bearish stance', () => {
    it('returns strong_bearish when 4+ bearish signals present', () => {
      const metrics = makeMetrics({
        appreciation_yoy: -2.5,
        population_growth: -0.8,
        vacancy_rate: 7.5,
        dom_yoy_change: 25,
        homeready_score: 35,
        unemployment_rate: 6.5, // above national + 1.5
        cap_rate: 1.5,
      });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(result.stance).toBe('strong_bearish');
      expect(result.bearish_count).toBeGreaterThanOrEqual(4);
      expect(result.bullish_count).toBe(0);
    });
  });

  describe('neutral stance', () => {
    it('returns neutral when no signals triggered', () => {
      const metrics = makeMetrics({
        appreciation_yoy: 2.0,
        population_growth: 0.3,
        vacancy_rate: 5.0,
        dom_yoy_change: 5,
        homeready_score: 60,
        unemployment_rate: 3.5,
        cap_rate: 3.5,
      });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(result.stance).toBe('neutral');
    });

    it('returns neutral when equal bullish and bearish signals', () => {
      const metrics = makeMetrics({
        appreciation_yoy: 5.0,    // bullish
        population_growth: -0.8,  // bearish
        vacancy_rate: 3.5,        // bullish
        dom_yoy_change: 25,       // bearish
        homeready_score: 60,
      });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(result.stance).toBe('neutral');
    });
  });

  describe('weak_bullish stance', () => {
    it('returns weak_bullish when 2-3 bullish signals', () => {
      const metrics = makeMetrics({
        appreciation_yoy: 5.0,     // bullish
        population_growth: 1.2,    // bullish
        vacancy_rate: 5.5,         // no signal (not < 5.1)
        dom_yoy_change: 5,         // no signal
        homeready_score: 55,       // no signal
      });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(result.stance).toBe('weak_bullish');
      expect(result.bullish_count).toBeGreaterThanOrEqual(2);
      expect(result.bullish_count).toBeLessThanOrEqual(3);
    });
  });

  describe('weak_bearish stance', () => {
    it('returns weak_bearish when 2-3 bearish signals', () => {
      const metrics = makeMetrics({
        appreciation_yoy: -2.5,    // bearish
        population_growth: -0.8,   // bearish
        vacancy_rate: 5.0,         // no signal
        dom_yoy_change: 5,         // no signal
        homeready_score: 55,       // no signal
      });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(result.stance).toBe('weak_bearish');
      expect(result.bearish_count).toBeGreaterThanOrEqual(2);
      expect(result.bearish_count).toBeLessThanOrEqual(3);
    });
  });

  describe('null metric handling', () => {
    it('handles all null metric values gracefully', () => {
      const metrics = makeMetrics(); // all null, news counts 0
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(result.stance).toBe('neutral');
      expect(result.signals).toBeDefined();
      expect(result.signals).toHaveLength(0);
      expect(result.bullish_count).toBe(0);
      expect(result.bearish_count).toBe(0);
    });

    it('handles partial null values gracefully', () => {
      const metrics = makeMetrics({ homeready_score: 65 }); // no signal
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(result.stance).toBe('neutral');
      expect(result.signals).toBeDefined();
    });

    it('does not count null metrics as bullish or bearish', () => {
      const metrics = makeMetrics({ appreciation_yoy: 5.0 }); // 1 bullish
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(result.bullish_count).toBe(1);
      expect(result.bearish_count).toBe(0);
      expect(result.signals).toHaveLength(1);
    });
  });

  describe('signal structure', () => {
    it('each signal includes direction, value, and threshold', () => {
      const metrics = makeMetrics({ appreciation_yoy: 5.0 });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(result.signals).toHaveLength(1);

      const signal = result.signals[0];
      expect(signal.signal).toBe('strong_appreciation');
      expect(signal.direction).toBe('bullish');
      expect(signal.value).toBe(5.0);
      expect(typeof signal.threshold).toBe('string');
    });

    it('bearish signals have correct structure', () => {
      const metrics = makeMetrics({ appreciation_yoy: -2.5 });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(result.signals).toHaveLength(1);

      const signal = result.signals[0];
      expect(signal.signal).toBe('price_decline');
      expect(signal.direction).toBe('bearish');
      expect(signal.value).toBe(-2.5);
    });

    it('includes all detected signals in the result', () => {
      const metrics = makeMetrics({
        appreciation_yoy: 5.0,
        population_growth: 1.2,
        vacancy_rate: 3.5,
        dom_yoy_change: -10,
        homeready_score: 85,
      });
      const result = computeMarketStance(metrics, nationalBenchmarks);

      const signalNames = result.signals.map((s) => s.signal);
      expect(signalNames).toContain('strong_appreciation');
      expect(signalNames).toContain('population_growth');
      expect(signalNames).toContain('low_vacancy');
      expect(signalNames).toContain('decreasing_dom');
      expect(signalNames).toContain('strong_homeready');
    });
  });

  describe('news sentiment signals', () => {
    it('positive news generates bullish signal when 2+ articles', () => {
      const metrics = makeMetrics({ positive_news_count: 3 });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      const signal = result.signals.find(
        (s) => s.signal === 'positive_news_sentiment',
      );
      expect(signal).toBeDefined();
      expect(signal?.direction).toBe('bullish');
    });

    it('negative news generates bearish signal when 2+ articles', () => {
      const metrics = makeMetrics({ negative_news_count: 2 });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      const signal = result.signals.find(
        (s) => s.signal === 'negative_news_sentiment',
      );
      expect(signal).toBeDefined();
      expect(signal?.direction).toBe('bearish');
    });

    it('no news signal when fewer than 2 articles', () => {
      const metrics = makeMetrics({
        positive_news_count: 1,
        negative_news_count: 1,
      });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(
        result.signals.find(
          (s) =>
            s.signal === 'positive_news_sentiment' ||
            s.signal === 'negative_news_sentiment',
        ),
      ).toBeUndefined();
    });
  });

  describe('unemployment and cap_rate signals', () => {
    it('low unemployment generates bullish signal', () => {
      const metrics = makeMetrics({ unemployment_rate: 2.5 }); // < 3.8 - 0.5 = 3.3
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(
        result.signals.find((s) => s.signal === 'low_unemployment'),
      ).toBeDefined();
    });

    it('high unemployment generates bearish signal', () => {
      const metrics = makeMetrics({ unemployment_rate: 6.0 }); // > 3.8 + 1.5 = 5.3
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(
        result.signals.find((s) => s.signal === 'high_unemployment'),
      ).toBeDefined();
    });

    it('strong cap_rate generates bullish signal', () => {
      const metrics = makeMetrics({ cap_rate: 6.0 }); // > 5%
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(
        result.signals.find((s) => s.signal === 'strong_cap_rate'),
      ).toBeDefined();
    });

    it('weak cap_rate generates bearish signal', () => {
      const metrics = makeMetrics({ cap_rate: 1.5 }); // < 2%
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(
        result.signals.find((s) => s.signal === 'weak_cap_rate'),
      ).toBeDefined();
    });
  });

  describe('threshold boundary conditions', () => {
    it('appreciation_yoy exactly at 3% is not bullish', () => {
      const metrics = makeMetrics({ appreciation_yoy: 3.0 });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(result.bullish_count).toBe(0);
    });

    it('appreciation_yoy exactly at 0% is not bearish', () => {
      const metrics = makeMetrics({ appreciation_yoy: 0.0 });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(result.bearish_count).toBe(0);
    });

    it('vacancy_rate exactly at national average is not bullish', () => {
      const metrics = makeMetrics({ vacancy_rate: 5.1 });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(result.bullish_count).toBe(0);
    });

    it('vacancy_rate exactly at national + 1% is not bearish', () => {
      const metrics = makeMetrics({ vacancy_rate: 6.1 });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(result.bearish_count).toBe(0);
    });

    it('dom_yoy_change exactly at 0 is not bullish', () => {
      const metrics = makeMetrics({ dom_yoy_change: 0 });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(result.bullish_count).toBe(0);
    });

    it('dom_yoy_change exactly at 15 is not bearish', () => {
      const metrics = makeMetrics({ dom_yoy_change: 15 });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(result.bearish_count).toBe(0);
    });

    it('homeready_score exactly at 70 is not bullish', () => {
      const metrics = makeMetrics({ homeready_score: 70 });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(result.bullish_count).toBe(0);
    });

    it('homeready_score exactly at 45 is not bearish', () => {
      const metrics = makeMetrics({ homeready_score: 45 });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      expect(result.bearish_count).toBe(0);
    });
  });

  describe('result counts match signals', () => {
    it('bullish_count matches number of bullish signals', () => {
      const metrics = makeMetrics({
        appreciation_yoy: 5.0,
        population_growth: 1.2,
        vacancy_rate: 3.5,
        dom_yoy_change: 5,
        homeready_score: 55,
      });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      const bullishSignals = result.signals.filter(
        (s) => s.direction === 'bullish',
      );
      expect(result.bullish_count).toBe(bullishSignals.length);
    });

    it('bearish_count matches number of bearish signals', () => {
      const metrics = makeMetrics({
        appreciation_yoy: -2.5,
        population_growth: -0.8,
        vacancy_rate: 7.5,
        dom_yoy_change: 5,
        homeready_score: 55,
      });
      const result = computeMarketStance(metrics, nationalBenchmarks);
      const bearishSignals = result.signals.filter(
        (s) => s.direction === 'bearish',
      );
      expect(result.bearish_count).toBe(bearishSignals.length);
    });
  });
});
