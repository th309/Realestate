/**
 * Outcome DB Fallback Service
 *
 * Handles individual DB queries that fire when all preloaded caches miss.
 * These are rare during batch population (most data is preloaded), but
 * necessary for completeness and for ad-hoc single-outcome lookups.
 */

import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { GeographyType } from '../scoring.types';
import type { HistoricalDataPoint } from './outcome-generator.types';
import {
  getZillowTable,
  getZillowIdColumn,
  getRedfinRoute,
  getRealtorRoute,
  getCensusRoute,
} from './outcome-generator.types';
import { OutcomeCacheService } from './outcome-cache.service';

@Injectable()
export class OutcomeDbFallbackService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly cache: OutcomeCacheService,
  ) {}

  /**
   * Query DB for historical price data using Zillow → Redfin → Realtor chain.
   * Caches the result so subsequent lookups for the same key are instant.
   */
  async getHistoricalDataFromDb(
    geographyId: string,
    geographyType: GeographyType,
    date: string,
  ): Promise<HistoricalDataPoint[] | null> {
    const client = this.supabase.getClient();
    const zillowTable = getZillowTable(geographyType);
    const zillowIdCol = getZillowIdColumn(geographyType);

    const { data: zillowData } = await client
      .from(zillowTable)
      .select('period_date, value')
      .eq(zillowIdCol, geographyId)
      .eq('metric_name', 'zhvi')
      .lte('period_date', date)
      .order('period_date', { ascending: false })
      .limit(1);

    let result: HistoricalDataPoint[] | null = null;

    if (zillowData?.length) {
      result = [
        {
          date: zillowData[0].period_date,
          zhvi: zillowData[0].value,
          source: 'zillow',
        },
      ];
    }

    if (!result) {
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

        if (redfinData?.length && redfinData[0].median_sale_price != null) {
          result = [
            {
              date: redfinData[0][redfinRoute.dateColumn],
              zhvi: redfinData[0].median_sale_price,
              source: 'redfin',
            },
          ];
        }
      }
    }

    if (!result) {
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
          realtorData?.length &&
          realtorData[0].median_listing_price != null
        ) {
          result = [
            {
              date: realtorData[0][realtorRoute.dateColumn],
              zhvi: realtorData[0].median_listing_price,
              source: 'realtor',
            },
          ];
        }
      }
    }

    const cacheKey = `${geographyType}:${geographyId}:${date}`;
    this.cache.historicalCache.set(cacheKey, result);
    return result;
  }

  /**
   * Query Census ACS for median gross rent as ZORI fallback.
   * Used when Zillow doesn't publish ZORI for a geography (smaller metros).
   */
  async getAcsRentData(
    geographyId: string,
    geographyType: GeographyType,
    date: string,
  ): Promise<number | null> {
    const route = getCensusRoute(geographyType);
    if (!route) return null;

    const requestedYear = parseInt(date.slice(0, 4), 10);
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from(route.table)
      .select(`median_gross_rent, ${route.dateColumn}`)
      .eq(route.idColumn, geographyId)
      .lte(route.dateColumn, requestedYear)
      .not('median_gross_rent', 'is', null)
      .order(route.dateColumn, { ascending: false })
      .limit(1);

    if (error || !data?.length) return null;
    const rent = data[0].median_gross_rent as number;
    if (rent <= 0) return null;
    return rent;
  }
}
