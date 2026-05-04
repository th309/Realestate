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
