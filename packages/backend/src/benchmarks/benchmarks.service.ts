import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { STATE_FIPS_TO_NAME } from '../common/geo';

type GeoLevel = 'metro' | 'county' | 'zip';

interface ParentGeo {
  level: string;
  id: string;
  name: string;
}

interface BenchmarkResult {
  metricId: string;
  value: number | null;
  parentGeo: ParentGeo | null;
  parentValue: number | null;
  diff: number | null;
  direction: 'better' | 'worse' | 'similar' | null;
}

/**
 * Map of metric IDs to their column names in the calculated_metrics table.
 */
const METRIC_COLUMN_MAP: Record<string, string> = {
  cap_rate: 'cap_rate',
  gross_yield: 'gross_yield',
  grm: 'grm',
  overvalued_pct: 'overvalued_pct',
  rent_to_price_ratio: 'rent_to_price_ratio',
  income_to_buy: 'income_to_buy',
  affordable_home_price: 'affordable_home_price',
  years_to_save: 'years_to_save',
  home_value_5yr_cagr: 'home_value_5yr_cagr',
};

/**
 * Whether a higher or lower value is favorable for the investor/buyer.
 */
const FAVORABLE_DIRECTION: Record<string, 'higher' | 'lower' | 'neutral'> = {
  cap_rate: 'higher',
  gross_yield: 'higher',
  grm: 'lower',
  overvalued_pct: 'lower',
  rent_to_price_ratio: 'higher',
  income_to_buy: 'lower',
  affordable_home_price: 'higher',
  years_to_save: 'lower',
  home_value_5yr_cagr: 'higher',
};

/** Percentage threshold for "similar" classification. */
const SIMILAR_THRESHOLD = 5;

@Injectable()
export class BenchmarksService {
  private readonly logger = new Logger(BenchmarksService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Compare a geography's metric values against its parent geography.
   */
  async getBenchmarks(
    geoLevel: GeoLevel,
    geoId: string,
    metricIds: string[],
  ): Promise<BenchmarkResult[]> {
    // Filter to only supported metrics
    const supported = metricIds.filter((m) => METRIC_COLUMN_MAP[m]);
    if (supported.length === 0) {
      return metricIds.map((m) => ({
        metricId: m,
        value: null,
        parentGeo: null,
        parentValue: null,
        diff: null,
        direction: null,
      }));
    }

    // Determine columns to select
    const columns = [...new Set(supported.map((m) => METRIC_COLUMN_MAP[m]))];

    // Fetch target metric values and parent geo in parallel
    const [targetRow, parentGeo] = await Promise.all([
      this.fetchMetricValues(geoLevel, geoId, columns),
      this.resolveParentGeo(geoLevel, geoId),
    ]);

    // Fetch parent metric values if we found a parent
    let parentRow: Record<string, any> | null = null;
    if (parentGeo) {
      parentRow = await this.fetchMetricValues(
        parentGeo.level as GeoLevel,
        parentGeo.id,
        columns,
      );
    }

    // Build results for all requested metrics (including unsupported ones)
    return metricIds.map((metricId) => {
      const col = METRIC_COLUMN_MAP[metricId];
      if (!col) {
        return {
          metricId,
          value: null,
          parentGeo: null,
          parentValue: null,
          diff: null,
          direction: null,
        };
      }

      const value = targetRow?.[col] != null ? Number(targetRow[col]) : null;
      const parentValue =
        parentRow?.[col] != null ? Number(parentRow[col]) : null;

      let diff: number | null = null;
      let direction: 'better' | 'worse' | 'similar' | null = null;

      if (value != null && parentValue != null && parentValue !== 0) {
        diff =
          Math.round(
            ((value - parentValue) / Math.abs(parentValue)) * 100 * 10,
          ) / 10;

        direction = this.classifyDirection(metricId, diff);
      }

      return {
        metricId,
        value,
        parentGeo: parentGeo ?? null,
        parentValue,
        diff,
        direction,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Metric value fetching
  // ---------------------------------------------------------------------------

  /**
   * Fetch the latest metric values from calculated_metrics for a geography.
   * Merges the latest 3 rows (different batch jobs write at different dates).
   */
  private async fetchMetricValues(
    geoLevel: string,
    geoId: string,
    columns: string[],
  ): Promise<Record<string, any> | null> {
    const selectCols = [...new Set([...columns, 'period_date'])].join(',');

    const { data, error } = await this.supabase
      .from('calculated_metrics')
      .select(selectCols)
      .eq('geography_id', geoId)
      .eq('geography_type', geoLevel)
      .order('period_date', { ascending: false })
      .limit(3);

    if (error) {
      this.logger.warn(
        `fetchMetricValues error for ${geoLevel}/${geoId}: ${error.message}`,
      );
      return null;
    }
    if (!data || data.length === 0) return null;

    // Merge: latest non-null value per column wins
    const merged: Record<string, any> = {};
    for (const row of data as Record<string, any>[]) {
      for (const key of Object.keys(row)) {
        if (merged[key] == null && row[key] != null) {
          merged[key] = row[key];
        }
      }
    }

    return merged;
  }

  // ---------------------------------------------------------------------------
  // Parent geography resolution
  // ---------------------------------------------------------------------------

  /**
   * Determine the parent geography for a given geo level + id.
   *
   * ZIP  -> County (via geography_crosswalk)
   * County -> Metro (via geographies.cbsa_code), or State if no metro
   * Metro -> State (via geographies.state_fips, primary state)
   */
  private async resolveParentGeo(
    geoLevel: GeoLevel,
    geoId: string,
  ): Promise<ParentGeo | null> {
    try {
      switch (geoLevel) {
        case 'zip':
          return await this.resolveZipParent(geoId);
        case 'county':
          return await this.resolveCountyParent(geoId);
        case 'metro':
          return await this.resolveMetroParent(geoId);
        default:
          return null;
      }
    } catch (e: any) {
      this.logger.warn(
        `resolveParentGeo failed for ${geoLevel}/${geoId}: ${e.message}`,
      );
      return null;
    }
  }

  /**
   * ZIP -> County via geography_crosswalk table.
   */
  private async resolveZipParent(zipCode: string): Promise<ParentGeo | null> {
    const { data, error } = await this.supabase
      .from('geography_crosswalk')
      .select('county_fips')
      .eq('zip_code', zipCode)
      .limit(1)
      .single();

    if (error || !data) {
      this.logger.debug(`No crosswalk entry for ZIP ${zipCode}`);
      return null;
    }

    const countyFips = String((data as any).county_fips).padStart(5, '0');

    // Look up county name from geographies table
    const name = await this.getGeoName('county', countyFips);

    return {
      level: 'county',
      id: countyFips,
      name: name || `County ${countyFips}`,
    };
  }

  /**
   * County -> Metro (via cbsa_code) or State (if no metro assignment).
   */
  private async resolveCountyParent(
    countyFips: string,
  ): Promise<ParentGeo | null> {
    const { data, error } = await this.supabase
      .from('geographies')
      .select('cbsa_code, state_fips')
      .eq('geography_type', 'county')
      .eq('geography_id', countyFips)
      .limit(1)
      .single();

    if (error || !data) {
      this.logger.debug(`No geographies entry for county ${countyFips}`);
      return null;
    }

    const row = data as Record<string, any>;

    // Prefer metro (cbsa_code) as the parent
    if (row.cbsa_code) {
      const cbsa = String(row.cbsa_code).padStart(5, '0');
      const name = await this.getGeoName('metro', cbsa);
      return {
        level: 'metro',
        id: cbsa,
        name: name || `Metro ${cbsa}`,
      };
    }

    // Fall back to state
    if (row.state_fips) {
      const fips = String(row.state_fips).padStart(2, '0');
      const name = STATE_FIPS_TO_NAME[fips] || `State ${fips}`;
      return {
        level: 'state',
        id: fips,
        name,
      };
    }

    return null;
  }

  /**
   * Metro -> State (primary state via state_fips).
   */
  private async resolveMetroParent(cbsaCode: string): Promise<ParentGeo | null> {
    const { data, error } = await this.supabase
      .from('geographies')
      .select('state_fips')
      .eq('geography_type', 'metro')
      .eq('geography_id', cbsaCode)
      .limit(1)
      .single();

    if (error || !data) {
      this.logger.debug(`No geographies entry for metro ${cbsaCode}`);
      return null;
    }

    const row = data as Record<string, any>;
    if (!row.state_fips) return null;

    const fips = String(row.state_fips).padStart(2, '0');
    const name = STATE_FIPS_TO_NAME[fips] || `State ${fips}`;

    return {
      level: 'state',
      id: fips,
      name,
    };
  }

  /**
   * Look up a geography's display name from the geographies table.
   */
  private async getGeoName(
    geoType: string,
    geoId: string,
  ): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('geographies')
      .select('name')
      .eq('geography_type', geoType)
      .eq('geography_id', geoId)
      .limit(1)
      .single();

    if (error || !data) return null;
    return (data as any).name ?? null;
  }

  // ---------------------------------------------------------------------------
  // Direction classification
  // ---------------------------------------------------------------------------

  /**
   * Classify the percentage difference as "better", "worse", or "similar"
   * based on the metric's favorable direction.
   */
  private classifyDirection(
    metricId: string,
    diff: number,
  ): 'better' | 'worse' | 'similar' {
    if (Math.abs(diff) <= SIMILAR_THRESHOLD) {
      return 'similar';
    }

    const favorable = FAVORABLE_DIRECTION[metricId] ?? 'neutral';

    if (favorable === 'neutral') {
      return 'similar';
    }

    // diff > 0 means target is higher than parent
    if (favorable === 'higher') {
      return diff > 0 ? 'better' : 'worse';
    }

    // favorable === 'lower': lower is better
    return diff < 0 ? 'better' : 'worse';
  }
}
