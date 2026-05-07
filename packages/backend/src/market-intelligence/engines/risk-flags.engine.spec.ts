import {
  computeRiskFlags,
  RiskFlag,
  RiskMetrics,
  GeoData,
} from './risk-flags.engine';
import { NationalBenchmarks } from '../market-intelligence.types';

describe('computeRiskFlags', () => {
  const nationalBenchmarks: NationalBenchmarks = {
    vacancy_rate: 5.1,
    unemployment_rate: 3.8,
    appreciation_yoy: 3.0,
  };

  // ---------------------------------------------------------------------------
  // HIGH severity: population_decline
  // ---------------------------------------------------------------------------
  describe('population_decline flag (high severity)', () => {
    it('flags population decline when population_growth < -0.3', () => {
      const metrics: RiskMetrics = { population_growth: -0.5 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      const popFlag = flags.find((f) => f.flag === 'population_decline');
      expect(popFlag).toBeDefined();
      expect(popFlag!.severity).toBe('high');
      expect(popFlag!.metric_value).toBe(-0.5);
      expect(popFlag!.detail).toContain('-0.5');
    });

    it('does not flag population_decline when growth is exactly -0.3 (boundary)', () => {
      const metrics: RiskMetrics = { population_growth: -0.3 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      expect(flags.find((f) => f.flag === 'population_decline')).toBeUndefined();
    });

    it('does not flag population_decline when growth is positive', () => {
      const metrics: RiskMetrics = { population_growth: 1.0 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      expect(flags.find((f) => f.flag === 'population_decline')).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // HIGH severity: price_decline
  // ---------------------------------------------------------------------------
  describe('price_decline flag (high severity)', () => {
    it('flags price decline when appreciation_yoy < -2', () => {
      const metrics: RiskMetrics = { appreciation_yoy: -3.5 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      const priceFlag = flags.find((f) => f.flag === 'price_decline');
      expect(priceFlag).toBeDefined();
      expect(priceFlag!.severity).toBe('high');
      expect(priceFlag!.metric_value).toBe(-3.5);
      expect(priceFlag!.detail).toContain('-3.5');
    });

    it('does not flag price_decline when appreciation_yoy is exactly -2 (boundary)', () => {
      const metrics: RiskMetrics = { appreciation_yoy: -2.0 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      expect(flags.find((f) => f.flag === 'price_decline')).toBeUndefined();
    });

    it('does not flag price_decline when appreciation is positive', () => {
      const metrics: RiskMetrics = { appreciation_yoy: 4.0 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      expect(flags.find((f) => f.flag === 'price_decline')).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // HIGH severity: high_vacancy
  // ---------------------------------------------------------------------------
  describe('high_vacancy flag (high severity)', () => {
    it('flags high vacancy when vacancy_rate > national + 2', () => {
      const metrics: RiskMetrics = { vacancy_rate: 8.0 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      const vacancyFlag = flags.find((f) => f.flag === 'high_vacancy');
      expect(vacancyFlag).toBeDefined();
      expect(vacancyFlag!.severity).toBe('high');
      expect(vacancyFlag!.metric_value).toBe(8.0);
      expect(vacancyFlag!.threshold).toContain('7.1');
    });

    it('does not flag high_vacancy when vacancy_rate is exactly national + 2 (boundary)', () => {
      const metrics: RiskMetrics = { vacancy_rate: 7.1 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      expect(flags.find((f) => f.flag === 'high_vacancy')).toBeUndefined();
    });

    it('does not flag high_vacancy when vacancy_rate is below national average', () => {
      const metrics: RiskMetrics = { vacancy_rate: 4.0 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      expect(flags.find((f) => f.flag === 'high_vacancy')).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // HIGH severity: rising_unemployment
  // ---------------------------------------------------------------------------
  describe('rising_unemployment flag (high severity)', () => {
    it('flags rising unemployment when unemployment_rate > national + 1.5', () => {
      const metrics: RiskMetrics = { unemployment_rate: 6.0 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      const unempFlag = flags.find((f) => f.flag === 'rising_unemployment');
      expect(unempFlag).toBeDefined();
      expect(unempFlag!.severity).toBe('high');
      expect(unempFlag!.metric_value).toBe(6.0);
      expect(unempFlag!.threshold).toContain('5.3');
    });

    it('does not flag rising_unemployment at exactly national + 1.5 (boundary)', () => {
      const metrics: RiskMetrics = { unemployment_rate: 5.3 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      expect(flags.find((f) => f.flag === 'rising_unemployment')).toBeUndefined();
    });

    it('does not flag rising_unemployment when rate is below national average', () => {
      const metrics: RiskMetrics = { unemployment_rate: 3.0 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      expect(flags.find((f) => f.flag === 'rising_unemployment')).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // MEDIUM severity: inventory_surge
  // ---------------------------------------------------------------------------
  describe('inventory_surge flag (medium severity)', () => {
    it('flags inventory surge when inventory_yoy_change > 20', () => {
      const metrics: RiskMetrics = { inventory_yoy_change: 25.0 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      const invFlag = flags.find((f) => f.flag === 'inventory_surge');
      expect(invFlag).toBeDefined();
      expect(invFlag!.severity).toBe('medium');
      expect(invFlag!.metric_value).toBe(25.0);
    });

    it('does not flag inventory_surge at exactly 20 (boundary)', () => {
      const metrics: RiskMetrics = { inventory_yoy_change: 20.0 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      expect(flags.find((f) => f.flag === 'inventory_surge')).toBeUndefined();
    });

    it('does not flag inventory_surge when change is negative', () => {
      const metrics: RiskMetrics = { inventory_yoy_change: -5.0 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      expect(flags.find((f) => f.flag === 'inventory_surge')).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // MEDIUM severity: dom_increasing
  // ---------------------------------------------------------------------------
  describe('dom_increasing flag (medium severity)', () => {
    it('flags DOM increasing when dom_yoy_change > 15', () => {
      const metrics: RiskMetrics = { dom_yoy_change: 20.0 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      const domFlag = flags.find((f) => f.flag === 'dom_increasing');
      expect(domFlag).toBeDefined();
      expect(domFlag!.severity).toBe('medium');
      expect(domFlag!.metric_value).toBe(20.0);
    });

    it('does not flag dom_increasing at exactly 15 (boundary)', () => {
      const metrics: RiskMetrics = { dom_yoy_change: 15.0 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      expect(flags.find((f) => f.flag === 'dom_increasing')).toBeUndefined();
    });

    it('does not flag dom_increasing when DOM is decreasing', () => {
      const metrics: RiskMetrics = { dom_yoy_change: -3.0 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      expect(flags.find((f) => f.flag === 'dom_increasing')).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // MEDIUM severity: affordability_squeeze
  // ---------------------------------------------------------------------------
  describe('affordability_squeeze flag (medium severity)', () => {
    it('flags affordability squeeze when price_to_income > 6', () => {
      const metrics: RiskMetrics = { price_to_income: 7.5 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      const affFlag = flags.find((f) => f.flag === 'affordability_squeeze');
      expect(affFlag).toBeDefined();
      expect(affFlag!.severity).toBe('medium');
      expect(affFlag!.metric_value).toBe(7.5);
    });

    it('does not flag affordability_squeeze at exactly 6 (boundary)', () => {
      const metrics: RiskMetrics = { price_to_income: 6.0 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      expect(flags.find((f) => f.flag === 'affordability_squeeze')).toBeUndefined();
    });

    it('does not flag affordability_squeeze when ratio is low', () => {
      const metrics: RiskMetrics = { price_to_income: 3.5 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      expect(flags.find((f) => f.flag === 'affordability_squeeze')).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // MEDIUM severity: low_rent_growth
  // ---------------------------------------------------------------------------
  describe('low_rent_growth flag (medium severity)', () => {
    it('flags low rent growth when rent_growth_yoy < 0', () => {
      const metrics: RiskMetrics = { rent_growth_yoy: -2.0 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      const rentFlag = flags.find((f) => f.flag === 'low_rent_growth');
      expect(rentFlag).toBeDefined();
      expect(rentFlag!.severity).toBe('medium');
      expect(rentFlag!.metric_value).toBe(-2.0);
    });

    it('does not flag low_rent_growth at exactly 0 (boundary)', () => {
      const metrics: RiskMetrics = { rent_growth_yoy: 0.0 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      expect(flags.find((f) => f.flag === 'low_rent_growth')).toBeUndefined();
    });

    it('does not flag low_rent_growth when growth is positive', () => {
      const metrics: RiskMetrics = { rent_growth_yoy: 3.0 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      expect(flags.find((f) => f.flag === 'low_rent_growth')).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // LOW severity: geography-based risks
  // ---------------------------------------------------------------------------
  describe('geography-based risk flags (low severity)', () => {
    it('flags coastal_risk when geoData.coastal_risk is true', () => {
      const geoData: GeoData = { coastal_risk: true, fire_risk: false, flood_risk: false };
      const flags = computeRiskFlags({}, nationalBenchmarks, geoData);
      const coastalFlag = flags.find((f) => f.flag === 'coastal_risk');
      expect(coastalFlag).toBeDefined();
      expect(coastalFlag!.severity).toBe('low');
      expect(coastalFlag!.metric_value).toBeNull();
    });

    it('flags fire_risk when geoData.fire_risk is true', () => {
      const geoData: GeoData = { coastal_risk: false, fire_risk: true, flood_risk: false };
      const flags = computeRiskFlags({}, nationalBenchmarks, geoData);
      const fireFlag = flags.find((f) => f.flag === 'fire_risk');
      expect(fireFlag).toBeDefined();
      expect(fireFlag!.severity).toBe('low');
    });

    it('flags flood_risk when geoData.flood_risk is true', () => {
      const geoData: GeoData = { coastal_risk: false, fire_risk: false, flood_risk: true };
      const flags = computeRiskFlags({}, nationalBenchmarks, geoData);
      const floodFlag = flags.find((f) => f.flag === 'flood_risk');
      expect(floodFlag).toBeDefined();
      expect(floodFlag!.severity).toBe('low');
    });

    it('flags multiple geo risks simultaneously', () => {
      const geoData: GeoData = { coastal_risk: true, fire_risk: false, flood_risk: true };
      const flags = computeRiskFlags({}, nationalBenchmarks, geoData);
      expect(flags.some((f) => f.flag === 'coastal_risk')).toBe(true);
      expect(flags.some((f) => f.flag === 'flood_risk')).toBe(true);
      expect(flags.some((f) => f.flag === 'fire_risk')).toBe(false);
    });

    it('does not flag any geo risks when all are false', () => {
      const geoData: GeoData = { coastal_risk: false, fire_risk: false, flood_risk: false };
      const flags = computeRiskFlags({}, nationalBenchmarks, geoData);
      expect(flags.filter((f) => f.severity === 'low')).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // No risks scenario
  // ---------------------------------------------------------------------------
  describe('no risk flags when thresholds not breached', () => {
    it('returns empty array when all metrics are safe', () => {
      const metrics: RiskMetrics = {
        population_growth: 1.0,
        appreciation_yoy: 4.0,
        vacancy_rate: 4.0,
        unemployment_rate: 3.0,
        inventory_yoy_change: 5.0,
        dom_yoy_change: 3.0,
        price_to_income: 4.0,
        rent_growth_yoy: 2.0,
      };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      expect(flags).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Null / empty handling
  // ---------------------------------------------------------------------------
  describe('null and empty metric handling', () => {
    it('handles empty metrics object without crashing', () => {
      const flags = computeRiskFlags({}, nationalBenchmarks, null);
      expect(Array.isArray(flags)).toBe(true);
      expect(flags).toHaveLength(0);
    });

    it('handles null geoData gracefully', () => {
      const flags = computeRiskFlags({}, nationalBenchmarks, null);
      expect(Array.isArray(flags)).toBe(true);
    });

    it('skips null metric values without crashing', () => {
      const metrics: RiskMetrics = {
        population_growth: null,
        appreciation_yoy: null,
        vacancy_rate: null,
        unemployment_rate: null,
        inventory_yoy_change: null,
        dom_yoy_change: null,
        price_to_income: null,
        rent_growth_yoy: null,
      };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      expect(flags).toHaveLength(0);
    });

    it('skips undefined metric values without crashing', () => {
      const metrics: RiskMetrics = {
        population_growth: undefined,
      };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      expect(flags).toHaveLength(0);
    });

    it('correctly evaluates zero values (0 is valid, not null)', () => {
      const metrics: RiskMetrics = {
        rent_growth_yoy: 0.0,
        population_growth: 0.0,
      };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      // rent_growth_yoy = 0 is NOT < 0, so no flag
      // population_growth = 0 is NOT < -0.3, so no flag
      expect(flags).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple simultaneous flags
  // ---------------------------------------------------------------------------
  describe('multiple risk flags returned simultaneously', () => {
    it('returns all applicable flags from different severity levels', () => {
      const metrics: RiskMetrics = {
        population_growth: -0.5,          // high: population_decline
        appreciation_yoy: -3.0,           // high: price_decline
        vacancy_rate: 8.0,                // high: high_vacancy
        unemployment_rate: 6.0,           // high: rising_unemployment
        inventory_yoy_change: 25.0,       // medium: inventory_surge
        dom_yoy_change: 20.0,             // medium: dom_increasing
        price_to_income: 7.5,             // medium: affordability_squeeze
        rent_growth_yoy: -1.0,            // medium: low_rent_growth
      };
      const geoData: GeoData = { coastal_risk: true, fire_risk: true, flood_risk: true };

      const flags = computeRiskFlags(metrics, nationalBenchmarks, geoData);

      // 4 high + 4 medium + 3 low = 11 total
      expect(flags).toHaveLength(11);

      const highFlags = flags.filter((f) => f.severity === 'high');
      const mediumFlags = flags.filter((f) => f.severity === 'medium');
      const lowFlags = flags.filter((f) => f.severity === 'low');

      expect(highFlags).toHaveLength(4);
      expect(mediumFlags).toHaveLength(4);
      expect(lowFlags).toHaveLength(3);
    });

    it('returns mix of high and medium flags when only some thresholds breached', () => {
      const metrics: RiskMetrics = {
        population_growth: -0.5,          // high: population_decline
        appreciation_yoy: 4.0,            // no flag
        vacancy_rate: 4.0,                // no flag
        unemployment_rate: 3.0,           // no flag
        inventory_yoy_change: 25.0,       // medium: inventory_surge
        dom_yoy_change: 3.0,              // no flag
        price_to_income: 7.5,             // medium: affordability_squeeze
        rent_growth_yoy: 2.0,             // no flag
      };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);

      expect(flags).toHaveLength(3);
      expect(flags.some((f) => f.flag === 'population_decline')).toBe(true);
      expect(flags.some((f) => f.flag === 'inventory_surge')).toBe(true);
      expect(flags.some((f) => f.flag === 'affordability_squeeze')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Flag structure validation
  // ---------------------------------------------------------------------------
  describe('flag structure validation', () => {
    it('each flag includes all required fields', () => {
      const metrics: RiskMetrics = { population_growth: -0.5 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);

      expect(flags).toHaveLength(1);
      const flag = flags[0];

      expect(flag.flag).toBe('population_decline');
      expect(flag.severity).toBe('high');
      expect(typeof flag.detail).toBe('string');
      expect(flag.detail.length).toBeGreaterThan(0);
      expect(flag.metric_value).toBe(-0.5);
      expect(typeof flag.threshold).toBe('string');
      expect(flag.threshold.length).toBeGreaterThan(0);
    });

    it('detail string includes metric value formatted to 1 decimal place', () => {
      const metrics: RiskMetrics = { appreciation_yoy: -3.567 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      const flag = flags.find((f) => f.flag === 'price_decline');
      expect(flag).toBeDefined();
      expect(flag!.detail).toContain('-3.6');
    });

    it('geo risk flags have null metric_value', () => {
      const geoData: GeoData = { coastal_risk: true };
      const flags = computeRiskFlags({}, nationalBenchmarks, geoData);
      const coastalFlag = flags.find((f) => f.flag === 'coastal_risk');
      expect(coastalFlag).toBeDefined();
      expect(coastalFlag!.metric_value).toBeNull();
    });

    it('threshold string describes the condition for metric-based flags', () => {
      const metrics: RiskMetrics = { vacancy_rate: 8.0 };
      const flags = computeRiskFlags(metrics, nationalBenchmarks, null);
      const flag = flags.find((f) => f.flag === 'high_vacancy');
      expect(flag).toBeDefined();
      // Threshold should reference the national benchmark + 2
      expect(flag!.threshold).toMatch(/vacancy_rate/i);
    });
  });

  // ---------------------------------------------------------------------------
  // Benchmark-relative thresholds
  // ---------------------------------------------------------------------------
  describe('benchmark-relative thresholds adapt to different benchmarks', () => {
    it('high_vacancy threshold adjusts with different national vacancy_rate', () => {
      const lowBenchmarks: NationalBenchmarks = { vacancy_rate: 3.0, unemployment_rate: 3.8, appreciation_yoy: 3.0 };
      // 3.0 + 2 = 5.0 threshold; 5.5 should trigger
      const metrics: RiskMetrics = { vacancy_rate: 5.5 };
      const flags = computeRiskFlags(metrics, lowBenchmarks, null);
      expect(flags.some((f) => f.flag === 'high_vacancy')).toBe(true);
    });

    it('rising_unemployment threshold adjusts with different national rate', () => {
      const lowBenchmarks: NationalBenchmarks = { vacancy_rate: 5.1, unemployment_rate: 2.0, appreciation_yoy: 3.0 };
      // 2.0 + 1.5 = 3.5 threshold; 4.0 should trigger
      const metrics: RiskMetrics = { unemployment_rate: 4.0 };
      const flags = computeRiskFlags(metrics, lowBenchmarks, null);
      expect(flags.some((f) => f.flag === 'rising_unemployment')).toBe(true);
    });

    it('vacancy at 5.5 does NOT trigger with higher national benchmark', () => {
      const highBenchmarks: NationalBenchmarks = { vacancy_rate: 6.0, unemployment_rate: 3.8, appreciation_yoy: 3.0 };
      // 6.0 + 2 = 8.0 threshold; 5.5 should NOT trigger
      const metrics: RiskMetrics = { vacancy_rate: 5.5 };
      const flags = computeRiskFlags(metrics, highBenchmarks, null);
      expect(flags.some((f) => f.flag === 'high_vacancy')).toBe(false);
    });
  });
});
