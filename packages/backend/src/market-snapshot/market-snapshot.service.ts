import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { ScoringService } from '../scoring/scoring.service';
import { MetricResolutionService } from '../metric-resolution/metric-resolution.service';
import { normalizeZipKey } from '../common/zip';
import {
  normalizeStateRegionId,
  normalizeCountyFips,
  normalizeCbsaCode,
} from '../common/geo';

export interface MarketSnapshotMetric {
  value: number | null;
  date: string | null;
  source: string;
  sourceGeoId: string | null;
  sourceGeoLevel: GeoType | 'national' | null;
  isInherited: boolean;
  isFallback: boolean;
}

export interface MarketSnapshotResponse {
  success: boolean;
  geography: {
    id: string;
    name: string;
    type: string;
  };
  scores: {
    homeready: { score: number; grade: string; components?: Record<string, number> } | null;
    investoredge: { score: number; grade: string; components?: Record<string, number> } | null;
    markethealth: { score: number; grade: string } | null;
  };
  metrics: Record<string, MarketSnapshotMetric>;
  lastUpdated: string;
}

type GeoType = 'metro' | 'county' | 'zip' | 'state';

// Realtor DB column -> metric ID mapping
const REALTOR_COLUMN_MAP: Record<string, string> = {
  median_listing_price: 'listing_price',
  median_listing_price_yy: 'home_value_yoy',
  median_listing_price_mm: 'home_value_mom',
  active_listing_count: 'for_sale_inventory',
  active_listing_count_yy: 'inventory_yoy',
  median_days_on_market: 'days_on_market',
  new_listing_count: 'new_listings',
  new_listing_count_yy: 'new_listings_yoy',
  pending_listing_count: 'pending_listings',
  price_reduced_share: 'price_cut_pct',
  median_listing_price_per_square_foot: 'price_per_sqft',
  pending_ratio: 'pending_ratio',
  hotness_score: 'hotness_score',
  supply_score: 'supply_score',
  demand_score: 'demand_score',
  price_increased_share: 'price_increase_pct',
};

// Realtor percent columns (stored as decimals, need *100)
const REALTOR_PERCENT_COLS = new Set([
  'median_listing_price_yy',
  'median_listing_price_mm',
  'active_listing_count_yy',
  'new_listing_count_yy',
  'price_reduced_share',
  'price_increased_share',
]);

// Zillow metric_name -> metric ID mapping
const ZILLOW_METRIC_MAP: Record<string, string> = {
  zhvi: 'home_value',
  zori: 'rent_index',
  zordi_sfr: 'rent_for_houses',
  sale_to_list: 'sale_to_list',
  market_heat_index: 'market_heat',
  zhvf_12m: 'home_price_forecast',
  sales_count: 'home_sales',
  new_con_sales: 'new_construction_sales',
  new_con_median_price: 'new_construction_price',
  new_con_median_price_per_sqft: 'new_construction_ppsf',
};

// Zillow affordability metric_name -> metric ID (metro only)
const ZILLOW_AFFORD_MAP: Record<string, string> = {
  years_to_save: 'years_to_save',
  renter_income: 'income_to_rent',
};

// Census DB column -> metric ID mapping
const CENSUS_COLUMN_MAP: Record<string, string> = {
  total_population: 'population',
  median_household_income: 'median_income',
  median_age: 'median_age',
  homeownership_rate: 'homeownership_rate',
  population_yoy: 'population_growth',
  income_yoy: 'income_growth',
};

// Economic DB column -> metric ID mapping
const ECONOMIC_COLUMN_MAP: Record<string, string> = {
  unemployment_rate: 'unemployment_rate',
  employment_yoy: 'job_growth',
  gdp_yoy: 'gdp_growth',
  rpp_all_items: 'cost_of_living',
};

// Calculated metrics DB column -> metric ID mapping
const CALC_COLUMN_MAP: Record<string, string> = {
  cap_rate: 'cap_rate',
  gross_yield: 'gross_yield',
  rent_to_price_ratio: 'rent_to_price_ratio',
  grm: 'grm',
  overvalued_pct: 'overvalued_pct',
  home_value_5yr_cagr: 'home_value_5yr',
  inventory_surplus_pct: 'inventory_surplus',
  income_to_buy: 'income_to_buy',
  affordable_home_price: 'affordable_home_price',
};

// Permits DB column -> metric ID mapping (county only)
const PERMITS_COLUMN_MAP: Record<string, string> = {
  sf_units: 'sf_permits',
  large_multi_units: 'mf_permits',
  total_units: 'total_permits',
  total_units_yoy: 'permits_yoy',
};

@Injectable()
export class MarketSnapshotService {
  private readonly logger = new Logger(MarketSnapshotService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly scoringService: ScoringService,
    private readonly metricResolution: MetricResolutionService,
  ) {}

  async getSnapshot(geoType: GeoType, geoId: string, state?: string): Promise<MarketSnapshotResponse> {
    const metrics: Record<string, MarketSnapshotMetric> = {};
    let geographyName = `${geoType} ${geoId}`;
    let lastUpdated = new Date().toISOString();
    const toMetric = (
      value: number,
      date: string | null | undefined,
      source: string,
      overrides?: Partial<Pick<MarketSnapshotMetric, 'sourceGeoId' | 'sourceGeoLevel' | 'isInherited' | 'isFallback'>>,
    ): MarketSnapshotMetric => ({
      value,
      date: date ?? null,
      source,
      sourceGeoId: overrides?.sourceGeoId ?? geoId,
      sourceGeoLevel: overrides?.sourceGeoLevel ?? geoType,
      isInherited: overrides?.isInherited ?? false,
      isFallback: overrides?.isFallback ?? false,
    });

    // Run all data source queries in parallel
    const [realtorResult, zillowResult, censusResult, economicResult, calcResult, permitsResult, scoresResult] =
      await Promise.allSettled([
        this.fetchRealtor(geoType, geoId),
        this.fetchZillow(geoType, geoId),
        this.fetchCensus(geoType, geoId),
        this.fetchEconomic(geoType, geoId),
        this.fetchCalculated(geoType, geoId),
        geoType === 'county' ? this.fetchPermits(geoId) : Promise.resolve(null),
        this.fetchScores(geoType, geoId),
      ]);

    // Log any rejected promises for debugging
    const labels = ['realtor', 'zillow', 'census', 'economic', 'calculated', 'permits', 'scores'];
    const allResults = [realtorResult, zillowResult, censusResult, economicResult, calcResult, permitsResult, scoresResult];
    for (let i = 0; i < allResults.length; i++) {
      if (allResults[i].status === 'rejected') {
        this.logger.error(`fetchData[${labels[i]}] rejected for ${geoType}/${geoId}: ${(allResults[i] as PromiseRejectedResult).reason}`);
      }
    }

    // Process Realtor data
    if (realtorResult.status === 'fulfilled' && realtorResult.value) {
      const { data, name, date } = realtorResult.value;
      if (name) geographyName = name;
      if (date) lastUpdated = date;
      for (const [col, metricId] of Object.entries(REALTOR_COLUMN_MAP)) {
        const raw = data[col];
        if (raw != null) {
          const value = REALTOR_PERCENT_COLS.has(col) ? Number(raw) * 100 : Number(raw);
          metrics[metricId] = toMetric(value, data.period_date ?? date ?? null, 'realtor');
        }
      }
      // home_sales_yoy from Realtor
      if (data.pending_listing_count_yy != null) {
        metrics['home_sales_yoy'] = toMetric(
          Number(data.pending_listing_count_yy) * 100,
          data.period_date ?? date ?? null,
          'realtor',
        );
      }
    }

    // Process Zillow data
    if (zillowResult.status === 'fulfilled' && zillowResult.value) {
      const { rows, name } = zillowResult.value;
      if (name && geographyName === `${geoType} ${geoId}`) geographyName = name;
      for (const row of rows) {
        const metricName = row.metric_name as string;
        const val = row.value as number | null;
        const date = row.period_date as string | null;

        // Standard metrics
        const metricId = ZILLOW_METRIC_MAP[metricName];
        if (metricId && val != null) {
          // sale_to_list is stored as a fraction (0.98 = 98%); convert to display form
          const displayValue = metricName === 'sale_to_list' ? val * 100 : val;
          metrics[metricId] = toMetric(displayValue, date, 'zillow');
        }

        // Affordability metrics (metro only)
        const affordId = ZILLOW_AFFORD_MAP[metricName];
        if (affordId && val != null) {
          metrics[affordId] = toMetric(val, date, 'zillow');
        }
      }
    }

    // Fallbacks via centralized MetricResolutionService (source of truth: fallback-registry.ts)
    // home_sales: Zillow sales_count -> Realtor pending_listing_count
    // rent_index: Zillow ZORI -> HUD FMR (ZIP only) -> Census median_gross_rent
    const fallbackMetrics = ['home_sales', 'rent_index'].filter(m => !metrics[m]);
    if (fallbackMetrics.length > 0) {
      try {
        const resolved = await this.metricResolution.resolveMetricBatch(
          fallbackMetrics, geoType as any, geoId,
        );
        for (const metricId of fallbackMetrics) {
          const r = resolved[metricId];
          if (r?.value != null) {
            metrics[metricId] = toMetric(r.value, r.date, r.source, {
              sourceGeoId: r.sourceGeoId,
              sourceGeoLevel: r.sourceGeoLevel,
              isInherited: r.isInherited,
              isFallback: r.isFallback,
            });
          }
        }
      } catch (e) {
        this.logger.warn(`MetricResolution fallback failed for ${geoType}/${geoId}: ${e}`);
      }
    }

    // Process Census data
    if (censusResult.status === 'fulfilled' && censusResult.value) {
      const { data, name } = censusResult.value;
      if (name && geographyName === `${geoType} ${geoId}`) geographyName = name;
      const year = data.year ? `${data.year}-01-01` : null;
      for (const [col, metricId] of Object.entries(CENSUS_COLUMN_MAP)) {
        const raw = data[col];
        if (raw != null && Number(raw) !== -666666666) {
          metrics[metricId] = toMetric(Number(raw), year, 'census');
        }
      }
    }

    // Process Economic data
    if (economicResult.status === 'fulfilled' && economicResult.value) {
      const { data, name } = economicResult.value;
      if (name && geographyName === `${geoType} ${geoId}`) geographyName = name;
      for (const [col, metricId] of Object.entries(ECONOMIC_COLUMN_MAP)) {
        const raw = data[col];
        if (raw != null) {
          metrics[metricId] = toMetric(Number(raw), data.period_date ?? null, 'economic');
        }
      }
    }

    // Process Calculated Metrics
    if (calcResult.status === 'fulfilled' && calcResult.value) {
      const { data } = calcResult.value;
      // Calculated metrics stored as fractions that need *100 for display
      const CALC_PERCENT_COLS = new Set(['rent_to_price_ratio']);
      for (const [col, metricId] of Object.entries(CALC_COLUMN_MAP)) {
        const raw = data[col];
        if (raw != null) {
          const value = CALC_PERCENT_COLS.has(col) ? Number(raw) * 100 : Number(raw);
          metrics[metricId] = toMetric(value, data.period_date ?? null, 'calculated');
        }
      }
      // Also set years_to_save from calculated_metrics if Zillow didn't provide it
      if (data.years_to_save != null && !metrics['years_to_save']) {
        metrics['years_to_save'] = toMetric(Number(data.years_to_save), data.period_date ?? null, 'calculated');
      }
    }

    // Process Permits (county only)
    if (permitsResult.status === 'fulfilled' && permitsResult.value) {
      const { data } = permitsResult.value;
      for (const [col, metricId] of Object.entries(PERMITS_COLUMN_MAP)) {
        const raw = data[col];
        if (raw != null) {
          metrics[metricId] = toMetric(Number(raw), data.period_date ?? null, 'permits');
        }
      }
      // Derived: sf_mf_ratio and permit_value_per_unit
      const sf = Number(data.sf_units) || 0;
      const total = Number(data.total_units) || 0;
      if (total > 0) {
        metrics['sf_mf_ratio'] = toMetric((sf / total) * 100, data.period_date ?? null, 'permits');
      }
      const totalValue = Number(data.total_value) || 0;
      if (total > 0 && totalValue > 0) {
        metrics['permit_value_per_unit'] = toMetric(totalValue / total, data.period_date ?? null, 'permits');
      }
    }

    // Process Scores
    let scores: MarketSnapshotResponse['scores'] = {
      homeready: null,
      investoredge: null,
      markethealth: null,
    };
    if (scoresResult.status === 'fulfilled' && scoresResult.value) {
      const s = scoresResult.value;
      if (s.location_name) geographyName = s.location_name;
      if (s.score_date) lastUpdated = s.score_date;
      scores = {
        homeready: s.scores?.homeready ? {
          score: Math.round(s.scores.homeready.score),
          grade: s.scores.homeready.grade,
          components: s.scores.homeready.components,
        } : null,
        investoredge: s.scores?.investoredge ? {
          score: Math.round(s.scores.investoredge.score),
          grade: s.scores.investoredge.grade,
          components: s.scores.investoredge.components,
        } : null,
        markethealth: s.scores?.markethealth ? {
          score: Math.round(s.scores.markethealth.score),
          grade: s.scores.markethealth.grade,
        } : null,
      };

      // Also add score values as metrics for data card display
      if (s.scores?.homeready) {
        metrics['homeready_score'] = toMetric(Math.round(s.scores.homeready.score), s.score_date ?? null, 'propertyiq');
      }
      if (s.scores?.investoredge) {
        metrics['investoredge_score'] = toMetric(Math.round(s.scores.investoredge.score), s.score_date ?? null, 'propertyiq');
      }
      if (s.scores?.markethealth) {
        metrics['market_health_score'] = toMetric(Math.round(s.scores.markethealth.score), s.score_date ?? null, 'propertyiq');
      }
    }

    return {
      success: true,
      geography: {
        id: geoId,
        name: geographyName,
        type: geoType,
      },
      scores,
      metrics,
      lastUpdated,
    };
  }

  // ============================================================================
  // Data Source Fetchers
  // ============================================================================

  private async fetchRealtor(geoType: GeoType, geoId: string): Promise<{
    data: Record<string, any>;
    name: string | null;
    date: string | null;
  } | null> {
    const table = `realtor_${geoType}`;
    const keyCol = this.getRealtorKeyCol(geoType);
    const nameCol = this.getRealtorNameCol(geoType);
    const cols = [
      ...Object.keys(REALTOR_COLUMN_MAP),
      'pending_listing_count_yy',
      'period_date',
      nameCol,
    ].join(',');

    const { data, error } = await this.supabase
      .from(table)
      .select(cols)
      .eq(keyCol, geoId)
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    const row = data as Record<string, any>;
    return {
      data: row,
      name: row[nameCol] ?? null,
      date: row.period_date ?? null,
    };
  }

  private async fetchZillow(geoType: GeoType, geoId: string): Promise<{
    rows: Record<string, any>[];
    name: string | null;
  } | null> {
    const table = `zillow_${geoType}`;

    // Determine filter column and value per geo type
    let filterCol: string;
    let filterVal: string;

    if (geoType === 'metro') {
      filterCol = 'cbsa_code';
      filterVal = normalizeCbsaCode(geoId);
    } else if (geoType === 'county') {
      filterCol = 'fips_code';
      filterVal = normalizeCountyFips(geoId);
    } else if (geoType === 'zip') {
      filterCol = 'region_name';
      filterVal = normalizeZipKey(geoId);
    } else {
      filterCol = 'state_code';
      filterVal = geoId;
    }

    // Query each Zillow metric individually in parallel.
    // The zillow_zip table is very large and .in() queries cause statement timeouts,
    // but individual .eq() queries with .limit(1) are fast (~50ms each).
    const allMetricNames = [
      ...Object.keys(ZILLOW_METRIC_MAP),
      ...Object.keys(ZILLOW_AFFORD_MAP),
    ];

    const metricResults = await Promise.allSettled(
      allMetricNames.map(async (metricName) => {
        const { data, error } = await this.supabase
          .from(table)
          .select('metric_name, value, period_date, region_name')
          .eq(filterCol, filterVal)
          .eq('metric_name', metricName)
          .order('period_date', { ascending: false })
          .limit(1);

        if (error || !data || data.length === 0) return null;
        return data[0] as Record<string, any>;
      }),
    );

    const rows: Record<string, any>[] = [];
    let name: string | null = null;
    for (const r of metricResults) {
      if (r.status === 'fulfilled' && r.value) {
        rows.push(r.value);
        if (!name && r.value.region_name) name = String(r.value.region_name);
      }
    }

    if (rows.length === 0) {
      this.logger.warn(`fetchZillow no data for ${geoType}/${geoId} from ${table}.${filterCol}=${filterVal}`);
      return null;
    }

    return { rows, name };
  }

  private async fetchCensus(geoType: GeoType, geoId: string): Promise<{
    data: Record<string, any>;
    name: string | null;
  } | null> {
    const table = `census_${geoType}`;
    const keyCol = this.getCensusKeyCol(geoType);
    const nameCol = this.getCensusNameCol(geoType);

    if (!keyCol) return null;

    const cols = [...Object.keys(CENSUS_COLUMN_MAP), 'year', nameCol].join(',');

    const { data, error } = await this.supabase
      .from(table)
      .select(cols)
      .eq(keyCol, geoType === 'zip' ? normalizeZipKey(geoId) : geoId)
      .order('year', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    const row = data as Record<string, any>;
    return {
      data: row,
      name: row[nameCol] ?? null,
    };
  }

  private async fetchEconomic(geoType: GeoType, geoId: string): Promise<{
    data: Record<string, any>;
    name: string | null;
  } | null> {
    const table = `economic_${geoType}`;
    const keyCol = this.getEconomicKeyCol(geoType);
    const nameCol = this.getEconomicNameCol(geoType);

    if (!keyCol) return null;

    const cols = [...Object.keys(ECONOMIC_COLUMN_MAP), 'period_date', nameCol].join(',');

    const { data, error } = await this.supabase
      .from(table)
      .select(cols)
      .eq(keyCol, geoId)
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    const row = data as Record<string, any>;
    return {
      data: row,
      name: row[nameCol] ?? null,
    };
  }

  private async fetchCalculated(geoType: GeoType, geoId: string): Promise<{
    data: Record<string, any>;
  } | null> {
    // Fetch latest 3 rows and merge (different batch jobs write at different dates)
    const cols = [...Object.keys(CALC_COLUMN_MAP), 'years_to_save', 'period_date'].join(',');

    const { data, error } = await this.supabase
      .from('calculated_metrics')
      .select(cols)
      .eq('geography_id', geoId)
      .eq('geography_type', geoType)
      .order('period_date', { ascending: false })
      .limit(3);

    if (error || !data || data.length === 0) return null;
    const rows = data as Record<string, any>[];

    // Merge: latest non-null value per column wins
    const merged: Record<string, any> = {};
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        if (merged[key] == null && row[key] != null) {
          merged[key] = row[key];
        }
      }
    }

    return { data: merged };
  }

  private async fetchPermits(geoId: string): Promise<{
    data: Record<string, any>;
  } | null> {
    const cols = [
      ...Object.keys(PERMITS_COLUMN_MAP),
      'total_value',
      'period_date',
    ].join(',');

    const { data, error } = await this.supabase
      .from('permits_county')
      .select(cols)
      .eq('fips_code', normalizeCountyFips(geoId))
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return { data: data as Record<string, any> };
  }

  private async fetchScores(geoType: GeoType, geoId: string): Promise<any> {
    try {
      return await this.scoringService.getScore(geoId, geoType as any, undefined, {
        components: true,
      });
    } catch (e) {
      this.logger.warn(`Failed to fetch scores for ${geoType}/${geoId}: ${e}`);
      return null;
    }
  }

  // ============================================================================
  // Key Column Helpers
  // ============================================================================

  private getRealtorKeyCol(geoType: GeoType): string {
    switch (geoType) {
      case 'metro': return 'cbsa_code';
      case 'county': return 'county_fips';
      case 'zip': return 'postal_code';
      case 'state': return 'state_id';
      default: return 'cbsa_code';
    }
  }

  private getRealtorNameCol(geoType: GeoType): string {
    switch (geoType) {
      case 'metro': return 'cbsa_title';
      case 'county': return 'county_name';
      case 'zip': return 'zip_name';
      case 'state': return 'state_name';
      default: return 'cbsa_title';
    }
  }

  private getZillowKeyCol(geoType: GeoType): string {
    switch (geoType) {
      case 'metro': return 'cbsa_code';
      case 'county': return 'fips_code';
      case 'zip': return 'region_name';
      case 'state': return 'state_code';
      default: return 'region_id';
    }
  }

  private getCensusKeyCol(geoType: GeoType): string | null {
    switch (geoType) {
      case 'metro': return 'cbsa_code';
      case 'county': return 'fips_code';
      case 'zip': return 'zcta';
      case 'state': return 'state_fips';
      default: return null;
    }
  }

  private getCensusNameCol(geoType: GeoType): string {
    switch (geoType) {
      case 'metro': return 'cbsa_title';
      case 'county': return 'county_name';
      case 'zip': return 'zcta';
      case 'state': return 'state_name';
      default: return 'cbsa_title';
    }
  }

  private getEconomicKeyCol(geoType: GeoType): string | null {
    switch (geoType) {
      case 'metro': return 'cbsa_code';
      case 'county': return 'fips_code';
      case 'state': return 'state_fips';
      default: return null;
    }
  }

  private getEconomicNameCol(geoType: GeoType): string {
    switch (geoType) {
      case 'metro': return 'cbsa_title';
      case 'county': return 'county_name';
      case 'state': return 'state_name';
      default: return 'cbsa_title';
    }
  }
}
