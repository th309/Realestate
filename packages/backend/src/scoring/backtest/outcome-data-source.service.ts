/**
 * Outcome Data Source Service
 *
 * Handles all raw data access for the outcome generator pipeline:
 * - Historical price data with Zillow → Redfin → Realtor fallback
 * - Score lookups from propertyiq_scores (v2 schema)
 * - Geography-to-state-code resolution
 * - Benchmark data (state/national) for comparison
 * - Table routing for Zillow, Redfin, and Realtor sources
 */

import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { ScoreType, GeographyType } from '../scoring.types';
import type {
  HistoricalDataPoint,
  BenchmarkData,
} from './outcome-generator.types';
import {
  getZillowTable,
  getZillowIdColumn,
  getRedfinRoute,
  getRealtorRoute,
} from './outcome-generator.types';

@Injectable()
export class OutcomeDataSourceService {
  constructor(private readonly supabase: SupabaseService) {}

  async getHistoricalScore(
    geographyId: string,
    geographyType: GeographyType,
    scoreType: ScoreType,
    date: string,
  ): Promise<number | null> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('propertyiq_scores')
      .select('score')
      .eq('location_id', geographyId)
      .eq('geography', geographyType)
      .eq('score_type', scoreType)
      .eq('score_date', date)
      .single();

    if (error || !data) return null;
    return data.score as number | null;
  }

  async getGeographiesWithScores(
    geographyType: GeographyType,
    scoreType: ScoreType,
    date: string,
    limit: number,
  ): Promise<Array<{ id: string }>> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('propertyiq_scores')
      .select('location_id')
      .eq('geography', geographyType)
      .eq('score_type', scoreType)
      .eq('score_date', date)
      .not('score', 'is', null)
      .limit(limit);

    if (error || !data) return [];
    return data.map((d) => ({ id: d.location_id }));
  }

  /**
   * Get historical price data with multi-source fallback:
   * Zillow ZHVI → Redfin median_sale_price → Realtor median_listing_price
   */
  async getHistoricalData(
    geographyId: string,
    geographyType: GeographyType,
    date: string,
  ): Promise<HistoricalDataPoint[] | null> {
    const client = this.supabase.getClient();
    const zillowTable = getZillowTable(geographyType);
    const zillowIdCol = getZillowIdColumn(geographyType);

    // 1. Try Zillow ZHVI (primary source)
    const { data: zillowData } = await client
      .from(zillowTable)
      .select('period_date, value')
      .eq(zillowIdCol, geographyId)
      .eq('metric_name', 'zhvi')
      .lte('period_date', date)
      .order('period_date', { ascending: false })
      .limit(1);

    if (zillowData && zillowData.length > 0) {
      return [
        {
          date: zillowData[0].period_date,
          zhvi: zillowData[0].value,
          source: 'zillow',
        },
      ];
    }

    // 2. Fallback: Redfin median_sale_price
    const redfinRoute = getRedfinRoute(geographyType);
    if (redfinRoute) {
      const { data: redfinData } = (await client
        .from(redfinRoute.table)
        .select('*')
        .eq(redfinRoute.idColumn, geographyId)
        .eq('property_type', 'All Residential')
        .lte(redfinRoute.dateColumn, date)
        .order(redfinRoute.dateColumn, { ascending: false })
        .limit(1)) as { data: Record<string, any>[] | null };

      if (
        redfinData &&
        redfinData.length > 0 &&
        redfinData[0].median_sale_price != null
      ) {
        return [
          {
            date: redfinData[0][redfinRoute.dateColumn],
            zhvi: redfinData[0].median_sale_price,
            source: 'redfin',
          },
        ];
      }
    }

    // 3. Fallback: Realtor median_listing_price
    const realtorRoute = getRealtorRoute(geographyType);
    if (realtorRoute) {
      const { data: realtorData } = (await client
        .from(realtorRoute.table)
        .select('*')
        .eq(realtorRoute.idColumn, geographyId)
        .lte(realtorRoute.dateColumn, date)
        .order(realtorRoute.dateColumn, { ascending: false })
        .limit(1)) as { data: Record<string, any>[] | null };

      if (
        realtorData &&
        realtorData.length > 0 &&
        realtorData[0].median_listing_price != null
      ) {
        return [
          {
            date: realtorData[0][realtorRoute.dateColumn],
            zhvi: realtorData[0].median_listing_price,
            source: 'realtor',
          },
        ];
      }
    }

    return null;
  }

  async getStateCode(
    geographyId: string,
    geographyType: GeographyType,
  ): Promise<string | null> {
    const client = this.supabase.getClient();

    switch (geographyType) {
      case 'metro': {
        const { data } = await client
          .from('zillow_metro')
          .select('state_code')
          .eq('cbsa_code', geographyId)
          .limit(1)
          .single();
        return data?.state_code || null;
      }
      case 'county': {
        const { data } = await client
          .from('zillow_county')
          .select('state_code')
          .eq('fips_code', geographyId)
          .limit(1)
          .single();
        return data?.state_code || null;
      }
      case 'zip': {
        const { data } = await client
          .from('zillow_zip')
          .select('state_code')
          .eq('region_name', geographyId)
          .limit(1)
          .single();
        return data?.state_code || null;
      }
      default:
        return null;
    }
  }

  async getBenchmarkData(
    level: 'state' | 'national',
    stateCode: string | null,
    date: string,
    metric: 'zhvi' | 'zori' = 'zhvi',
  ): Promise<BenchmarkData | null> {
    const client = this.supabase.getClient();

    if (level === 'national') {
      const { data, error } = await client
        .from('zillow_state')
        .select('value')
        .eq('region_name', 'United States')
        .eq('metric_name', metric)
        .lte('period_date', date)
        .order('period_date', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) return null;
      return metric === 'zhvi'
        ? { zhvi: data[0].value }
        : { zori: data[0].value };
    }

    if (level === 'state' && stateCode) {
      const { data, error } = await client
        .from('zillow_state')
        .select('value')
        .eq('state_code', stateCode)
        .eq('metric_name', metric)
        .lte('period_date', date)
        .order('period_date', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) return null;
      return metric === 'zhvi'
        ? { zhvi: data[0].value }
        : { zori: data[0].value };
    }

    return null;
  }
}
