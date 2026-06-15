import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';
import { PAGE_SIZE } from '../metric-pagination.constants';
import { InvestmentMetricsMetrosService } from './investment-metrics-metros.service';
import { InvestmentMetricsCountiesService } from './investment-metrics-counties.service';
import { InvestmentMetricsZipsService } from './investment-metrics-zips.service';

@Injectable()
export class InvestmentMetricsService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly metros: InvestmentMetricsMetrosService,
    private readonly counties: InvestmentMetricsCountiesService,
    private readonly zips: InvestmentMetricsZipsService,
  ) {}

  /**
   * Get pre-calculated investment metrics for map display
   * Uses pagination to fetch all records (Supabase default limit is 1000)
   */
  async getInvestmentMetricsForMap(
    metricName:
      | 'cap_rate'
      | 'gross_yield'
      | 'rent_to_price_ratio'
      | 'grm'
      | 'overvalued_pct'
      | 'months_of_supply'
      | 'absorption_rate'
      | 'renter_demand_index',
    geographyType: 'metro' | 'county' | 'zip' | 'state' | 'national' = 'metro',
  ): Promise<{ data: any[]; success: boolean; source: string }> {
    // Get the 3 most recent distinct period_dates for this metric
    // (ZORI, ZHVI, Realtor, HUD data may arrive on different dates)
    const uniqueRecentDates: string[] = [];
    let dateCursor: string | null = null;
    for (let i = 0; i < 3; i++) {
      const q = this.supabase
        .from('calculated_metrics')
        .select('period_date')
        .eq('geography_type', geographyType)
        .not(metricName, 'is', null);
      if (dateCursor) q.lt('period_date', dateCursor);
      const { data: dateRow } = await q
        .order('period_date', { ascending: false })
        .limit(1)
        .single();
      if (!dateRow?.period_date) break;
      uniqueRecentDates.push(dateRow.period_date);
      dateCursor = dateRow.period_date;
    }

    if (uniqueRecentDates.length === 0) {
      return { data: [], success: false, source: 'calculated_metrics' };
    }

    // Fetch data from the most recent dates (paginated), keeping latest per geography
    const dataByGeoId: Record<string, any> = {};

    for (const periodDate of uniqueRecentDates) {
      let offset = 0;
      while (true) {
        const { data: pageData, error } = await this.supabase
          .from('calculated_metrics')
          .select(`geography_id, geography_name, ${metricName}, period_date`)
          .eq('geography_type', geographyType)
          .eq('period_date', periodDate)
          .not(metricName, 'is', null)
          .range(offset, offset + PAGE_SIZE - 1);

        if (error || !pageData || pageData.length === 0) break;

        for (const row of pageData) {
          // Only keep the latest value per geography (dates are iterated newest-first)
          if (!dataByGeoId[row.geography_id]) {
            dataByGeoId[row.geography_id] = row;
          }
        }

        if (pageData.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
    }

    const allData = Object.values(dataByGeoId);

    if (allData.length === 0) {
      return { data: [], success: false, source: 'calculated_metrics' };
    }

    // Transform to API format
    const results = allData.map((row) => ({
      region_id: row.geography_id,
      region_name: row.geography_name,
      value: row[metricName],
      [metricName]: row[metricName],
      date: row.period_date,
      // Add geo-specific fields for key matching
      ...(geographyType === 'metro' ? { cbsa_code: row.geography_id } : {}),
      ...(geographyType === 'county' ? { county_fips: row.geography_id } : {}),
      ...(geographyType === 'zip' ? { postal_code: row.geography_id } : {}),
    }));

    return { data: results, success: true, source: 'calculated_metrics' };
  }

  calculateInvestmentMetricsForMetros(year?: number) {
    return this.metros.calculateInvestmentMetricsForMetros(year);
  }

  calculateInvestmentMetricsForCounties(year?: number) {
    return this.counties.calculateInvestmentMetricsForCounties(year);
  }

  calculateInvestmentMetricsForZips(year?: number) {
    return this.zips.calculateInvestmentMetricsForZips(year);
  }
}
