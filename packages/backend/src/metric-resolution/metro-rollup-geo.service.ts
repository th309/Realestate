/**
 * Metro Rollup Geo Service
 *
 * Implements the `irs_metro_rollup` computed source: it sums a county-level IRS
 * migration column up to the metro. This exists because Redfin's metro
 * migration dataset is not publicly available (its importer is a permanent
 * no-op), which left `net_migration` unresolvable at metro level.
 *
 * Metro composition comes from the canonical `geographies` table (one cbsa_code
 * per county row — a clean 1:1 mapping). It intentionally does NOT use the
 * ZIP-grained geography_crosswalk (GeographyChainService.getCountiesForMetro),
 * where a county can appear under multiple CBSAs (boundary-straddling ZIPs) and
 * would double-count in an aggregate. The single-geography and bulk paths share
 * this mapping so they always agree on a metro's constituent counties.
 *
 * The rolled-up value is, by construction, consistent with the county-level
 * `net_migration` / `irs_migration_net_returns` metrics (same source column);
 * intra-metro moves cancel, so the sum is the metro's net vs. the rest of the US.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { normalizeCbsaCode } from '../common/geo';
import { GeoLevel } from './metric-resolution.types';

const IRS_TABLE = 'irs_migration_county_aggregates';

/** Structurally compatible with SourceFetcherService.FetchedValue. */
export interface RollupValue {
  value: number;
  date: string | null;
}

/** Structurally compatible with SourceFetcherBulkService.BulkFetchedRow. */
export interface RollupBulkRow {
  regionId: string;
  regionName: string | null;
  value: number;
  date: string | null;
}

@Injectable()
export class MetroRollupGeoService {
  private readonly logger = new Logger(MetroRollupGeoService.name);

  /**
   * Full county-FIPS -> metro-CBSA map, cached for the process lifetime
   * (metro composition changes ~yearly). Lazily built by getCountyToMetroMap().
   */
  private countyToMetroMap: Map<string, string> | null = null;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  // ==========================================================================
  // Rollup fetch (single geography + bulk) — the `irs_metro_rollup` source
  // ==========================================================================

  /**
   * Sum a county-level IRS column up to a single metro. Returns null for a
   * non-metro request, an unknown metro, or when no county has data.
   */
  async fetchMetroValue(
    column: string,
    geoLevel: GeoLevel,
    geoId: string,
  ): Promise<RollupValue | null> {
    if (geoLevel !== 'metro') return null;

    const cbsa = /^\d+$/.test(geoId.trim()) ? normalizeCbsaCode(geoId) : geoId;
    const counties = await this.getMetroCountyFips(cbsa);
    if (counties.length === 0) return null;

    const { data, error } = await this.supabase
      .from(IRS_TABLE)
      .select(`${column}, tax_year`)
      .in('county_fips', counties);

    if (error || !data || data.length === 0) return null;

    const rows = data as Array<Record<string, any>>;
    const latestYear = Math.max(...rows.map((r) => Number(r.tax_year)));

    let sum = 0;
    let found = false;
    for (const r of rows) {
      if (Number(r.tax_year) === latestYear && r[column] != null) {
        sum += Number(r[column]);
        found = true;
      }
    }
    if (!found) return null;

    return { value: sum, date: String(latestYear) };
  }

  /**
   * Sum a county-level IRS column up to every metro (bulk). Uses the same
   * canonical county->metro map as the single-geography path. Paginates past
   * the PostgREST 1000-row read cap (~3.1k county rows). Sorted value-desc.
   */
  async fetchMetroBulk(
    column: string,
    geoLevel: GeoLevel,
  ): Promise<RollupBulkRow[]> {
    if (geoLevel !== 'metro') return [];

    const countyToMetro = await this.getCountyToMetroMap();
    if (countyToMetro.size === 0) return [];

    const { data: yr } = await this.supabase
      .from(IRS_TABLE)
      .select('tax_year')
      .order('tax_year', { ascending: false })
      .limit(1)
      .single();
    if (!yr) return [];
    const latestYear = (yr as { tax_year: number }).tax_year;

    const perMetro = new Map<string, number>();
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await this.supabase
        .from(IRS_TABLE)
        .select(`county_fips, ${column}`)
        .eq('tax_year', latestYear)
        .not(column, 'is', null)
        .range(offset, offset + pageSize - 1);

      if (error || !data || data.length === 0) break;

      for (const r of data as Array<Record<string, any>>) {
        const cbsa = countyToMetro.get(String(r.county_fips));
        if (!cbsa) continue;
        perMetro.set(cbsa, (perMetro.get(cbsa) ?? 0) + Number(r[column]));
      }
      if (data.length < pageSize) break;
    }

    const date = String(latestYear);
    return Array.from(perMetro.entries())
      .map(([regionId, value]) => ({ regionId, regionName: null, value, date }))
      .sort((a, b) => b.value - a.value);
  }

  // ==========================================================================
  // Canonical county <-> metro composition (from `geographies`)
  // ==========================================================================

  /**
   * Constituent county FIPS for a single metro (CBSA code).
   * Returns [] for an unknown metro.
   */
  async getMetroCountyFips(cbsaCode: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('geographies')
      .select('fips_code')
      .eq('geography_type', 'county')
      .eq('cbsa_code', cbsaCode)
      .not('fips_code', 'is', null);

    if (error || !data) return [];
    return [
      ...new Set(data.map((r) => (r as { fips_code: string }).fips_code)),
    ].filter(Boolean);
  }

  /**
   * The full canonical county-FIPS -> metro-CBSA map. Cached after first load.
   * Paginates past the PostgREST 1000-row read cap (~3.1k county rows).
   */
  async getCountyToMetroMap(): Promise<Map<string, string>> {
    if (this.countyToMetroMap) return this.countyToMetroMap;

    const map = new Map<string, string>();
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await this.supabase
        .from('geographies')
        .select('fips_code, cbsa_code')
        .eq('geography_type', 'county')
        .not('cbsa_code', 'is', null)
        .not('fips_code', 'is', null)
        .range(offset, offset + pageSize - 1);

      if (error) {
        this.logger.warn(`county->metro map load failed: ${error.message}`);
        break;
      }
      if (!data || data.length === 0) break;

      for (const row of data as Array<{
        fips_code: string | null;
        cbsa_code: string | null;
      }>) {
        if (row.fips_code && row.cbsa_code) {
          map.set(String(row.fips_code), String(row.cbsa_code));
        }
      }
      if (data.length < pageSize) break;
    }

    this.countyToMetroMap = map;
    return map;
  }

  /** Clear the cached map (useful in tests). */
  clearCache(): void {
    this.countyToMetroMap = null;
  }
}
