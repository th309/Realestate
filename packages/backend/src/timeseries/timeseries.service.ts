import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { getMetricMapping } from './timeseries-metric-mapping';
import { addRegionFilter, getTableName } from './timeseries-region-filter';
import {
  getComputedInvestmentTimeSeries,
  getComputedOvervaluedTimeSeries,
  getComputedPermitsTimeSeries,
} from './timeseries-computed';

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
}

export interface DateRange {
  minDate: string;
  maxDate: string;
  count: number;
}

/** Supabase default row limit; we paginate when no limit is requested so graphs can get full history. */
const TIMESERIES_PAGE_SIZE = 1000;

@Injectable()
export class TimeSeriesService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) { }

  /**
   * Get time series data for a specific metric/geography/region.
   * When lastPoints is set, returns the most recent lastPoints points (for history/trend).
   */
  async getTimeSeries(
    metricId: string,
    geoLevel: string,
    regionId: string,
    startDate?: string,
    endDate?: string,
    limit?: number,
    lastPoints?: number,
  ): Promise<TimeSeriesDataPoint[]> {
    console.log('[TimeSeriesService] getTimeSeries called:', {
      metricId,
      geoLevel,
      regionId,
      startDate,
      endDate,
    });

    const mapping = getMetricMapping(metricId);
    if (!mapping) {
      console.log('[TimeSeriesService] No mapping found for metric:', metricId);
      return [];
    }

    // Delegate computed metrics to specialized functions
    if (mapping.source === 'computed_investment') {
      return getComputedInvestmentTimeSeries(this.supabase, metricId, geoLevel, regionId, startDate, endDate, limit, lastPoints);
    }
    if (mapping.source === 'computed_overvalued') {
      return getComputedOvervaluedTimeSeries(this.supabase, geoLevel, regionId, startDate, endDate, limit, lastPoints);
    }
    if (mapping.source === 'computed_permits') {
      return getComputedPermitsTimeSeries(this.supabase, metricId, geoLevel, regionId, startDate, endDate, limit, lastPoints);
    }

    console.log('[TimeSeriesService] Mapping:', {
      source: mapping.source,
      columnName: mapping.columnName,
      usesMetricName: mapping.usesMetricName,
    });

    const table = getTableName(mapping.source, geoLevel);
    if (!table) {
      console.log('[TimeSeriesService] No table found for:', {
        source: mapping.source,
        geoLevel,
      });
      return [];
    }
    console.log('[TimeSeriesService] Using table:', table);

    try {
      // Census tables use 'year' field, others use 'period_date'
      // PropertyIQ scores use 'score_date'
      const dateField = mapping.source === 'census'
        ? 'year'
        : mapping.source === 'propertyiq'
          ? 'score_date'
          : 'period_date';

      // When lastPoints is set we need most recent points: order desc, limit, then reverse
      const useLastPoints = lastPoints != null && lastPoints > 0 && !startDate && !endDate;
      let query = this.supabase
        .from(table)
        .select(`${dateField}, ${mapping.columnName}`)
        .order(dateField, { ascending: !useLastPoints });

      // Add region filter
      query = addRegionFilter(query, geoLevel, regionId, mapping.source);

      // For calculated metrics, filter out null values
      if (mapping.source === 'calculated') {
        query = query.not(mapping.columnName, 'is', null);
      }

      // For PropertyIQ scores, filter by score_type and exclude null values
      if (mapping.source === 'propertyiq') {
        query = query.eq('score_type', mapping.metricNameValue);
        query = query.not(mapping.columnName, 'is', null);
      }

      // For Zillow tables, add metric_name filter
      if (mapping.usesMetricName && mapping.source === 'zillow') {
        query = query.eq('metric_name', mapping.metricNameValue);
      }

      // Add date/year filters
      if (startDate) {
        if (mapping.source === 'census') {
          const year = parseInt(startDate.split('-')[0]);
          query = query.gte(dateField, year);
        } else {
          query = query.gte(dateField, startDate);
        }
      }
      if (endDate) {
        if (mapping.source === 'census') {
          const year = parseInt(endDate.split('-')[0]);
          query = query.lte(dateField, year);
        } else {
          query = query.lte(dateField, endDate);
        }
      }

      // Add limit
      if (useLastPoints) {
        query = query.limit(lastPoints!);
      } else if (limit) {
        query = query.limit(limit);
      }

      type Row = Record<string, unknown>;
      let data: Row[];
      if (!useLastPoints && !limit) {
        // Paginate to bypass Supabase default row cap so graphing page can get all history
        data = [];
        let offset = 0;
        let page: Row[];
        do {
          const { data: pageData, error: pageError } = await query.range(
            offset,
            offset + TIMESERIES_PAGE_SIZE - 1,
          );
          if (pageError) {
            throw new Error(
              `Error fetching time series for ${metricId}: ${pageError.message}`,
            );
          }
          page = (pageData ?? []) as unknown as Row[];
          data = data.concat(page);
          offset += page.length;
        } while (page.length === TIMESERIES_PAGE_SIZE);
      } else {
        const res = await query;
        if (res.error) {
          throw new Error(
            `Error fetching time series for ${metricId}: ${res.error.message}`,
          );
        }
        data = (res.data ?? []) as unknown as Row[];
      }

      console.log('[TimeSeriesService] Query result:', {
        rowCount: data?.length || 0,
        sampleRow: data?.[0],
      });

      if (!data || data.length === 0) {
        console.log('[TimeSeriesService] No data returned');
        return [];
      }

      // Transform to standard format
      let result: TimeSeriesDataPoint[] = data.map((row: Row) => {
        const rawDate = row[dateField];
        const dateStr =
          mapping.source === 'census'
            ? `${String(rawDate ?? '')}-01-01`
            : String(rawDate ?? '');
        return {
          date: dateStr,
          value: Number(row[mapping.columnName]) || 0,
        };
      });
      if (useLastPoints && result.length > 0) {
        result = result.reverse();
      }
      console.log(
        '[TimeSeriesService] Returning',
        result.length,
        'points, sample:',
        result[0],
      );
      return result;
    } catch (err) {
      console.error(`[TimeSeriesService] Error for ${metricId}:`, err);
      return [];
    }
  }

  /**
   * Get available date range for a metric/geography
   */
  async getAvailableDates(
    metricId: string,
    geoLevel: string,
  ): Promise<DateRange> {
    const mapping = getMetricMapping(metricId);
    if (!mapping) {
      return { minDate: '', maxDate: '', count: 0 };
    }

    let tableSource = mapping.source;
    let metricNameFilter = mapping.usesMetricName ? mapping.metricNameValue : undefined;

    if (tableSource === 'computed_investment' || tableSource === 'computed_overvalued') {
      tableSource = 'zillow';
      metricNameFilter = 'zhvi';
    }

    const table = getTableName(tableSource, geoLevel);
    if (!table) {
      return { minDate: '', maxDate: '', count: 0 };
    }

    try {
      let query = this.supabase
        .from(table)
        .select('period_date')
        .order('period_date', { ascending: true });

      if (metricNameFilter) {
        query = query.eq('metric_name', metricNameFilter);
      }

      const { data, error } = await query;

      if (error || !data || data.length === 0) {
        return { minDate: '', maxDate: '', count: 0 };
      }

      const dates = data.map((d) => d.period_date);
      const uniqueDates = [...new Set(dates)];

      return {
        minDate: uniqueDates[0],
        maxDate: uniqueDates[uniqueDates.length - 1],
        count: uniqueDates.length,
      };
    } catch (err) {
      console.error(`Error getting date range for ${metricId}:`, err);
      return { minDate: '', maxDate: '', count: 0 };
    }
  }
}
