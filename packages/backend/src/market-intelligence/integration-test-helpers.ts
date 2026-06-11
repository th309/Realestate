/**
 * Shared test helpers for market intelligence integration tests.
 *
 * Provides mock factories for Supabase, MetricResolution, AppConfig,
 * and GeoTagger used across all integration test files.
 */

import { ResolvedMetric } from '../metric-resolution/metric-resolution.types';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { GeoTaggerService } from './geo-tagger.service';
import { NationalBenchmarks } from './market-intelligence.types';

// ---------------------------------------------------------------------------
// ResolvedMetric Factories
// ---------------------------------------------------------------------------

export function makeResolvedMetric(
  value: number | null,
  source = 'zillow',
  date = '2026-01-15',
): ResolvedMetric {
  return {
    value,
    date,
    source,
    sourceGeoId: '31080',
    sourceGeoLevel: 'metro',
    isInherited: false,
    isFallback: false,
  };
}

export function buildFullResolvedBatch(): Record<string, ResolvedMetric> {
  return {
    home_value: makeResolvedMetric(450000),
    appreciation_yoy: makeResolvedMetric(4.2),
    rent_index: makeResolvedMetric(1800),
    rent_growth_yoy: makeResolvedMetric(2.5),
    cap_rate: makeResolvedMetric(5.8),
    vacancy_rate: makeResolvedMetric(4.3),
    population: makeResolvedMetric(2100000),
    population_growth: makeResolvedMetric(1.1),
    unemployment_rate: makeResolvedMetric(3.5),
    median_income: makeResolvedMetric(72000),
    dom: makeResolvedMetric(28),
    inventory: makeResolvedMetric(15000),
    price_to_rent: makeResolvedMetric(20.8),
    permits_growth: makeResolvedMetric(3.2),
    price_to_income: makeResolvedMetric(6.25),
  };
}

export const BENCHMARKS: NationalBenchmarks = {
  vacancy_rate: 5.1,
  appreciation_yoy: 3.0,
  unemployment_rate: 3.7,
};

// ---------------------------------------------------------------------------
// In-memory Supabase Client Mock
// ---------------------------------------------------------------------------

/**
 * In-memory store that simulates Supabase table operations.
 * Tracks inserts and supports simple queries via .eq/.single chains.
 * The `.update()` returns an infinitely chainable `.eq()` that resolves
 * as a thenable, matching Supabase's `await client.from(t).update(p).eq().eq().eq().eq()`.
 */
export function createIntegrationSupabaseClient() {
  const tables: Record<string, any[]> = {
    market_briefings: [],
    rankings_cache: [],
    market_news: [],
    geographies: [
      {
        geography_id: '31080',
        geography_name: 'Los Angeles-Long Beach-Anaheim, CA',
        geography_type: 'metro',
      },
      {
        geography_id: '19740',
        geography_name: 'Denver-Aurora-Lakewood, CO',
        geography_type: 'metro',
      },
      {
        geography_id: '45300',
        geography_name: 'Tampa-St. Petersburg-Clearwater, FL',
        geography_type: 'metro',
      },
    ],
  };

  function buildQuery(tableName: string) {
    const filters: Record<string, any> = {};

    const chain: any = {
      select: jest.fn().mockImplementation(() => chain),
      eq: jest.fn().mockImplementation((col: string, val: any) => {
        filters[col] = val;
        return chain;
      }),
      contains: jest.fn().mockImplementation(() => chain),
      in: jest.fn().mockImplementation((col: string, vals: any[]) => {
        const rows = tables[tableName] || [];
        const matched = rows.filter((r) => vals.includes(r[col]));
        return Promise.resolve({ data: matched, error: null });
      }),
      gte: jest.fn().mockImplementation(() => chain),
      gt: jest.fn().mockImplementation(() => chain),
      order: jest.fn().mockImplementation(() => chain),
      limit: jest.fn().mockImplementation(() => chain),
      single: jest.fn().mockImplementation(() => {
        const rows = tables[tableName] || [];
        const match = rows.find((r) =>
          Object.entries(filters).every(([k, v]) => r[k] === v),
        );
        return Promise.resolve({ data: match || null, error: null });
      }),
      insert: jest.fn().mockImplementation((row: any) => {
        if (!tables[tableName]) tables[tableName] = [];
        const newRow = {
          id: `${tableName}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          ...row,
        };
        tables[tableName].push(newRow);
        return {
          select: jest.fn().mockResolvedValue({
            data: [{ id: newRow.id }],
            error: null,
          }),
        };
      }),
      // NewsIngestionService writes via .upsert(payload, { onConflict: 'url' }).
      // Dedup is handled upstream in the service, so this just stores the row.
      upsert: jest.fn().mockImplementation((row: any) => {
        if (!tables[tableName]) tables[tableName] = [];
        tables[tableName].push({
          id: `${tableName}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          ...row,
        });
        return Promise.resolve({ data: null, error: null });
      }),
      update: jest.fn().mockImplementation((payload: any) => {
        const updateFilters: Record<string, any> = {};
        // Use a plain self-referential object (not jest.fn) to avoid
        // deeply-chained mock issues with 4+ .eq() calls.
        const self: any = {};
        self.eq = (col: string, val: any) => {
          updateFilters[col] = val;
          return self;
        };
        self.then = (resolve: Function, reject?: Function) => {
          try {
            const rows = tables[tableName] || [];
            for (const row of rows) {
              const match = Object.entries(updateFilters).every(
                ([k, v]) => row[k] === v,
              );
              if (match) Object.assign(row, payload);
            }
            resolve({ data: null, error: null });
          } catch (err) {
            if (reject) reject(err);
          }
        };
        return self;
      }),
    };

    return chain;
  }

  return {
    from: jest
      .fn()
      .mockImplementation((tableName: string) => buildQuery(tableName)),
    _tables: tables,
  };
}

// ---------------------------------------------------------------------------
// Service Mocks
// ---------------------------------------------------------------------------

export function createMockMetricResolution(): jest.Mocked<MetricResolutionService> {
  return {
    resolveMetricBatch: jest.fn().mockResolvedValue(buildFullResolvedBatch()),
    resolveMetric: jest.fn(),
    resolveMetricForAllGeos: jest.fn().mockResolvedValue(new Map()),
  } as any;
}

export function createMockAppConfig(
  overrides: Record<string, string | boolean> = {},
) {
  const config: Record<string, string> = {
    AI_BASE_URL: 'https://api.deepseek.com',
    AI_MODEL: 'deepseek-v4-pro',
    DEEPSEEK_API_KEY: 'test-api-key',
    NEWS_API_PROVIDER: 'newsapi',
    NEWS_API_KEY: 'test-news-api-key',
    ...Object.fromEntries(
      Object.entries(overrides).map(([k, v]) => [k, String(v)]),
    ),
  };

  return {
    get: jest
      .fn()
      .mockImplementation((key: string, defaultValue = '') =>
        Promise.resolve(config[key] ?? defaultValue),
      ),
    getBool: jest
      .fn()
      .mockImplementation((key: string, defaultValue = false) => {
        const val = config[key];
        if (val === undefined) return Promise.resolve(defaultValue);
        return Promise.resolve(val === 'true' || val === '1');
      }),
    getNumber: jest.fn().mockImplementation((key: string, defaultValue = 0) => {
      const val = config[key];
      return Promise.resolve(val === undefined ? defaultValue : Number(val));
    }),
  } as any;
}

export function createMockGeoTagger(): jest.Mocked<GeoTaggerService> {
  return {
    tagArticle: jest
      .fn()
      .mockImplementation(async (headline: string): Promise<any[]> => {
        if (headline.toLowerCase().includes('denver')) {
          return [
            {
              geography_id: '19740',
              geography_name: 'Denver-Aurora-Lakewood, CO',
              confidence: 0.95,
            },
          ];
        }
        if (headline.toLowerCase().includes('tampa')) {
          return [
            {
              geography_id: '45300',
              geography_name: 'Tampa-St. Petersburg-Clearwater, FL',
              confidence: 0.95,
            },
          ];
        }
        return [];
      }),
    clearCache: jest.fn(),
  } as any;
}
