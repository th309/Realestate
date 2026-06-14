import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { RealtorFetchService } from './realtor-fetch.service';
import { mapRows } from './realtor.helpers';
import type { RealtorDataPoint, RealtorRow } from './realtor.types';

/**
 * Generic per-metric data access for each geography level. Returns one
 * RealtorDataPoint per region for the latest (or requested) period.
 */
@Injectable()
export class RealtorDataService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly fetch: RealtorFetchService,
  ) {}

  async getStateData(
    metric: string,
    date?: string,
  ): Promise<RealtorDataPoint[]> {
    // Use cached latest date if not specified
    const latestDate =
      date || (await this.fetch.getLatestDate('realtor_state'));

    const { data, error } = await this.supabase
      .from('realtor_state')
      .select(`state_id, state_name, ${metric}`)
      .eq('period_date', latestDate);

    if (error) throw error;

    return mapRows(
      (data || []) as unknown as RealtorRow[],
      metric,
      { idCol: 'state_id', nameCol: 'state_name', idKey: 'state_id' },
      latestDate,
    );
  }

  async getMetroData(
    metric: string,
    date?: string,
    _state?: string,
  ): Promise<RealtorDataPoint[]> {
    // Use cached latest date if not specified
    const latestDate =
      date || (await this.fetch.getLatestDate('realtor_metro'));

    // Use high limit to get all metros (~1000)
    const { data, error } = await this.supabase
      .from('realtor_metro')
      .select(`cbsa_code, cbsa_title, ${metric}`)
      .eq('period_date', latestDate)
      .limit(2000);

    if (error) throw error;

    return mapRows(
      (data || []) as unknown as RealtorRow[],
      metric,
      { idCol: 'cbsa_code', nameCol: 'cbsa_title', idKey: 'cbsa_code' },
      latestDate,
    );
  }

  async getCountyData(
    metric: string,
    date?: string,
    _state?: string,
  ): Promise<RealtorDataPoint[]> {
    // Use cached latest date if not specified
    const latestDate =
      date || (await this.fetch.getLatestDate('realtor_county'));

    // Use pagination to get all counties (~3200)
    const columns = `county_fips, county_name, ${metric}`;
    const data = await this.fetch.fetchAllRows(
      'realtor_county',
      latestDate as string,
      columns,
    );

    return mapRows(
      data,
      metric,
      { idCol: 'county_fips', nameCol: 'county_name', idKey: 'county_fips' },
      latestDate,
    );
  }

  async getZipData(
    metric: string,
    state?: string,
    date?: string,
  ): Promise<RealtorDataPoint[]> {
    // Get latest date from cache if not specified
    const latestDate = date || (await this.fetch.getLatestDate('realtor_zip'));

    // OPTIMIZATION: When state is provided, query database directly with filter
    // This fetches ~500-2000 ZIPs per state instead of all 28,000
    const columns = `postal_code, zip_name, ${metric}`;
    let data: RealtorRow[];
    if (state) {
      data = await this.fetch.fetchZipsByState(
        latestDate as string,
        state,
        columns,
      );
    } else {
      // No state filter - fetch all ZIPs (uses pagination + caching)
      data = await this.fetch.fetchAllRows(
        'realtor_zip',
        latestDate as string,
        columns,
      );
    }

    return mapRows(
      data,
      metric,
      { idCol: 'postal_code', nameCol: 'zip_name', idKey: 'postal_code' },
      latestDate,
    );
  }
}
