import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { processMetricValue, metricColumnMap } from './realtor.helpers';
import type { RealtorDataPoint } from './realtor.types';

/**
 * National (realtor_national) data + averages. Split out from the benchmark
 * service so each stays within the file-size limit; the benchmark service
 * consumes getAllNationalAverages().
 */
@Injectable()
export class RealtorNationalService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async getNationalData(
    metric: string,
    date?: string,
  ): Promise<RealtorDataPoint[]> {
    let query = this.supabase
      .from('realtor_national')
      .select(`period_date, ${metric}`)
      .order('period_date', { ascending: false });

    if (date) {
      query = query.eq('period_date', date);
    }

    const { data, error } = await query.limit(1);
    if (error) throw error;

    return (data || []).map((row) => ({
      region_id: 'US',
      region_name: 'United States',
      value: row[metric] as number | null,
    }));
  }

  /**
   * Get national average for a given frontend metric ID
   * Maps frontend metric IDs to Realtor column names
   */
  async getNationalAverage(
    metricId: string,
  ): Promise<{ value: number | null; metricId: string }> {
    const columnName = metricColumnMap[metricId];
    if (!columnName) {
      return { value: null, metricId };
    }

    const { data, error } = await this.supabase
      .from('realtor_national')
      .select(columnName)
      .order('period_date', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching national average:', error);
      return { value: null, metricId };
    }

    const row = data?.[0];

    return {
      value: processMetricValue(metricId, row?.[columnName]),
      metricId,
    };
  }

  /**
   * Get all national averages for benchmark comparison
   */
  async getAllNationalAverages(): Promise<Record<string, number | null>> {
    const columns = Object.values(metricColumnMap);

    const { data, error } = await this.supabase
      .from('realtor_national')
      .select(columns.join(','))
      .order('period_date', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching national averages:', error);
      return {};
    }

    const row = data?.[0] || {};
    const result: Record<string, number | null> = {};

    for (const [metricId, column] of Object.entries(metricColumnMap)) {
      result[metricId] = processMetricValue(metricId, row[column]);
    }

    return result;
  }
}
