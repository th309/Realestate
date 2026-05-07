import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface MigrationFlow {
  fromCountyFips: string;
  fromName: string;
  inflowCount: number;
}

export interface TopInflowsInput {
  countyFips: string;
  limit?: number;
  year?: number;
}

export type MigrationFlowsSource = 'irs' | 'redfin';
export type MigrationFlowsDirection = 'in' | 'out';

export interface MigrationFlowsResponse {
  geography: { fips: string; name: string | null; level: 'county' | 'metro' };
  source: MigrationFlowsSource;
  direction: MigrationFlowsDirection;
  as_of: string | null;
  flows: Array<Record<string, unknown>>;
}

const RESERVED_PARTNER_FIPS = new Set(['00000', '99999']);

/**
 * Default year for IRS Statistics-of-Income migration data lookups.
 * IRS publishes year-N migration data in mid-year-N+2 (~20-month lag).
 * `currentYear - 2` is the safest default that's almost always published.
 *
 * Override with `input.year` once a fresh ingest brings in newer data.
 */
const DEFAULT_MIGRATION_LAG_YEARS = 2;

@Injectable()
export class MigrationService {
  constructor(private supabase: SupabaseService) {}

  async getFlows(
    source: MigrationFlowsSource,
    fips: string,
    direction: MigrationFlowsDirection,
    limit: number,
  ): Promise<MigrationFlowsResponse> {
    const client = this.supabase.getClient();

    if (source === 'irs') {
      const dirCol = direction === 'in' ? 'destination_fips' : 'origin_fips';
      const partnerCol =
        direction === 'in' ? 'origin_fips' : 'destination_fips';

      const { data, error } = await client
        .from('irs_county_migration_flows')
        .select(
          `tax_year, num_returns, num_exemptions, agi_thousands, ${partnerCol}`,
        )
        .eq(dirCol, fips)
        .order('num_returns', { ascending: false })
        .limit(limit + 5);
      if (error) throw error;

      const filtered = (data ?? [])
        .filter(
          (r: Record<string, unknown>) =>
            r[partnerCol] !== fips &&
            !RESERVED_PARTNER_FIPS.has(String(r[partnerCol])),
        )
        .slice(0, limit);

      const taxYear = filtered[0]?.tax_year ?? null;
      const partnerFipsList = filtered.map(
        (r: Record<string, unknown>) => r[partnerCol] as string,
      );
      const geoMap = await this.lookupGeoNames([fips, ...partnerFipsList]);

      return {
        geography: {
          fips,
          name: geoMap.get(fips) ?? null,
          level: 'county',
        },
        source,
        direction,
        as_of: taxYear ? String(taxYear) : null,
        flows: filtered.map((r: Record<string, unknown>) => ({
          [partnerCol]: r[partnerCol],
          [partnerCol === 'origin_fips' ? 'origin_name' : 'destination_name']:
            geoMap.get(r[partnerCol] as string) ?? null,
          num_returns: r.num_returns,
          num_exemptions: r.num_exemptions,
          avg_agi:
            typeof r.num_returns === 'number' && r.num_returns > 0
              ? Math.round(((r.agi_thousands as number) * 1000) / r.num_returns)
              : null,
        })),
      };
    }

    // redfin metro
    const dirCol = direction === 'in' ? 'destination_cbsa' : 'origin_cbsa';
    const partnerCol = direction === 'in' ? 'origin_cbsa' : 'destination_cbsa';

    const { data, error } = await client
      .from('redfin_migration_flows_metro')
      .select(`period_date, share_pct, net_searches, ${partnerCol}`)
      .eq(dirCol, fips)
      .order('share_pct', { ascending: false })
      .limit(limit);
    if (error) throw error;

    const periodDate = (data?.[0]?.period_date as string | undefined) ?? null;
    const partnerList = (data ?? []).map(
      (r: Record<string, unknown>) => r[partnerCol] as string,
    );
    const geoMap = await this.lookupGeoNames([fips, ...partnerList]);

    return {
      geography: { fips, name: geoMap.get(fips) ?? null, level: 'metro' },
      source,
      direction,
      as_of: periodDate,
      flows: (data ?? []).map((r: Record<string, unknown>) => ({
        [partnerCol]: r[partnerCol],
        [partnerCol === 'origin_cbsa' ? 'origin_name' : 'destination_name']:
          geoMap.get(r[partnerCol] as string) ?? null,
        share_pct: r.share_pct,
        net_searches: r.net_searches,
      })),
    };
  }

  private async lookupGeoNames(ids: string[]): Promise<Map<string, string>> {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return new Map();
    const { data } = await this.supabase
      .getClient()
      .from('geographies')
      .select('geography_id, name')
      .in('geography_id', unique);
    return new Map(
      (data ?? []).map(
        (g: Record<string, unknown>) =>
          [g.geography_id as string, g.name as string] as const,
      ),
    );
  }

  async getTopInflows(input: TopInflowsInput): Promise<MigrationFlow[]> {
    const limit = input.limit ?? 5;
    const year =
      input.year ?? new Date().getFullYear() - DEFAULT_MIGRATION_LAG_YEARS;

    const { data, error } = await this.supabase
      .from('migration_flows')
      .select('from_county_fips, from_name, inflow_count')
      .eq('to_county_fips', input.countyFips)
      .eq('year', year)
      .not('from_county_fips', 'is', null)
      .not('from_name', 'is', null)
      .order('inflow_count', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data.map((row) => ({
      fromCountyFips: row.from_county_fips,
      fromName: row.from_name,
      inflowCount: row.inflow_count,
    }));
  }
}
