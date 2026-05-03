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

@Injectable()
export class MigrationService {
  constructor(private supabase: SupabaseService) {}

  async getTopInflows(input: TopInflowsInput): Promise<MigrationFlow[]> {
    const limit = input.limit ?? 5;
    const year = input.year ?? new Date().getFullYear() - 2; // IRS data lags ~18 months

    const { data, error } = await this.supabase
      .from('migration_flows')
      .select('from_county_fips, from_name, inflow_count')
      .eq('to_county_fips', input.countyFips)
      .eq('year', year)
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
