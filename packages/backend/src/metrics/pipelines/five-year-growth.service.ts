import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';
import { PAGE_SIZE } from '../metric-pagination.constants';
import { FiveYearGrowthMetroService } from './five-year-growth-metro.service';
import { FiveYearGrowthAggregateService } from './five-year-growth-aggregate.service';
import { FiveYearGrowthGranularService } from './five-year-growth-granular.service';

@Injectable()
export class FiveYearGrowthService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly metro: FiveYearGrowthMetroService,
    private readonly aggregate: FiveYearGrowthAggregateService,
    private readonly granular: FiveYearGrowthGranularService,
  ) {}

  calculate5YrGrowthForMetros = (year?: number) =>
    this.metro.calculate5YrGrowthForMetros(year);

  calculate5YrGrowthForStates = (year?: number) =>
    this.aggregate.calculate5YrGrowthForStates(year);

  calculate5YrGrowthForNational = (year?: number) =>
    this.aggregate.calculate5YrGrowthForNational(year);

  calculate5YrGrowthForCounties = () =>
    this.granular.calculate5YrGrowthForCounties();

  calculate5YrGrowthForZips = () => this.granular.calculate5YrGrowthForZips();

  /**
   * Calculate 5-year growth for all geographies
   */
  async calculate5YrGrowthForAll(year?: number): Promise<{
    metros: { processed: number; stored: number };
    states: { processed: number; stored: number };
    counties: { processed: number; stored: number };
    zips: { processed: number; stored: number };
    national: { processed: number; stored: number };
  }> {
    const [metros, states, counties, zips, national] = await Promise.all([
      this.metro.calculate5YrGrowthForMetros(year),
      this.aggregate.calculate5YrGrowthForStates(year),
      this.granular.calculate5YrGrowthForCounties(),
      this.granular.calculate5YrGrowthForZips(),
      this.aggregate.calculate5YrGrowthForNational(year),
    ]);

    return { metros, states, counties, zips, national };
  }

  /**
   * Get pre-calculated 5-year growth data for map display
   */
  async get5YrGrowthForMap(
    geographyType: 'metro' | 'state' | 'county' | 'zip' | 'national',
  ): Promise<{ data: any[]; success: boolean; source: string }> {
    // Get the latest period_date for this geography type
    const { data: latestRow } = await this.supabase
      .from('calculated_metrics')
      .select('period_date')
      .eq('geography_type', geographyType)
      .not('home_value_5yr_cagr', 'is', null)
      .order('period_date', { ascending: false })
      .limit(1)
      .single();

    if (!latestRow?.period_date) {
      return { data: [], success: false, source: 'calculated_metrics' };
    }

    // Get all data for that period (paginated for large datasets)
    const allData: any[] = [];
    let offset = 0;

    while (true) {
      const { data: pageData } = await this.supabase
        .from('calculated_metrics')
        .select(
          'geography_id, geography_name, home_value_5yr_cagr, period_date',
        )
        .eq('geography_type', geographyType)
        .eq('period_date', latestRow.period_date)
        .not('home_value_5yr_cagr', 'is', null)
        .range(offset, offset + PAGE_SIZE - 1);

      if (!pageData || pageData.length === 0) break;
      allData.push(...pageData);
      if (pageData.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    // Transform to API format
    const results = allData.map((row) => ({
      region_id: row.geography_id,
      region_name: row.geography_name,
      value: row.home_value_5yr_cagr,
      cagr_5yr: row.home_value_5yr_cagr,
      date: row.period_date,
      // Add geo-specific fields for key matching
      ...(geographyType === 'metro' ? { cbsa_code: row.geography_id } : {}),
      ...(geographyType === 'county' ? { county_fips: row.geography_id } : {}),
      ...(geographyType === 'zip' ? { postal_code: row.geography_id } : {}),
    }));

    return { data: results, success: true, source: 'calculated_metrics' };
  }
}
