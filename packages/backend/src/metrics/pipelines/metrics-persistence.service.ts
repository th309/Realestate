import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';
import {
  CalculatedMetricsInput,
  CalculatedMetricsOutput,
} from '../calculated-metrics.types';

@Injectable()
export class MetricsPersistenceService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Store calculated metrics to the database
   */
  async storeMetrics(
    input: CalculatedMetricsInput,
    metrics: CalculatedMetricsOutput,
  ): Promise<void> {
    const { error } = await this.supabase.from('calculated_metrics').upsert(
      {
        geography_id: input.geography_id,
        geography_type: input.geography_type,
        geography_name: input.geography_name,
        period_date: input.period_date,
        ...metrics,
        calculated_at: new Date().toISOString(),
      },
      {
        onConflict: 'geography_id,geography_type,period_date',
      },
    );

    if (error) {
      throw new Error(`Failed to store calculated metrics: ${error.message}`);
    }
  }

  /**
   * Get calculated metrics for a geography
   */
  async getMetrics(
    geographyId: string,
    geographyType: string,
    periodDate?: string,
  ): Promise<CalculatedMetricsOutput | null> {
    let query = this.supabase
      .from('calculated_metrics')
      .select('*')
      .eq('geography_id', geographyId)
      .eq('geography_type', geographyType);

    if (periodDate) {
      query = query.eq('period_date', periodDate);
    } else {
      // Get the latest few rows and merge non-null values,
      // since different batch jobs may store metrics at different dates
      query = query.order('period_date', { ascending: false }).limit(3);
    }

    const { data: rows, error } = await query;

    if (error || !rows || rows.length === 0) {
      return null;
    }

    // Merge: latest non-null value for each field wins
    const mergedFields = [
      'cap_rate',
      'gross_yield',
      'rent_to_price_ratio',
      'grm',
      'months_of_supply',
      'absorption_rate',
      'market_health_score',
      'investment_score',
      'long_term_growth_score',
      'home_value_5yr_cagr',
      'zhvi_3y_cagr',
      'zori_yoy',
      'zori_5y_cagr',
      'inventory_surplus',
      'overvalued_pct',
    ] as const;

    const merged: Record<string, any> = {};
    for (const field of mergedFields) {
      for (const row of rows) {
        if (row[field] != null) {
          merged[field] = row[field];
          break;
        }
      }
    }

    return {
      cap_rate: merged.cap_rate ?? null,
      gross_yield: merged.gross_yield ?? null,
      rent_to_price_ratio: merged.rent_to_price_ratio ?? null,
      grm: merged.grm ?? null,
      months_of_supply: merged.months_of_supply ?? null,
      absorption_rate: merged.absorption_rate ?? null,
      market_health_score: merged.market_health_score ?? null,
      investment_score: merged.investment_score ?? null,
      long_term_growth_score: merged.long_term_growth_score ?? null,
      home_value_5yr_cagr: merged.home_value_5yr_cagr ?? null,
      zhvi_3y_cagr: merged.zhvi_3y_cagr ?? null,
      zori_yoy: merged.zori_yoy ?? null,
      zori_5y_cagr: merged.zori_5y_cagr ?? null,
      inventory_surplus_pct: merged.inventory_surplus ?? null,
      overvalued_pct: merged.overvalued_pct ?? null,
    };
  }

  /**
   * Get calculated metrics for multiple geographies (for map display)
   */
  async getMetricsForMap(
    geographyType: string,
    metricName: keyof CalculatedMetricsOutput,
    periodDate?: string,
  ): Promise<Record<string, number>> {
    let query = this.supabase
      .from('calculated_metrics')
      .select(`geography_id, ${metricName}`)
      .eq('geography_type', geographyType)
      .not(metricName, 'is', null);

    if (periodDate) {
      query = query.eq('period_date', periodDate);
    }

    const { data, error } = await query;

    if (error || !data) {
      return {};
    }

    const result: Record<string, number> = {};
    for (const row of data) {
      if (row[metricName] !== null && row[metricName] !== undefined) {
        result[row.geography_id] = Number(row[metricName]);
      }
    }

    return result;
  }
}
