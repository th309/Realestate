import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

export interface TimeSeriesDataPoint {
    date: string;
    value: number;
}

export interface DateRange {
    minDate: string;
    maxDate: string;
    count: number;
}

/**
 * TimeSeriesService
 * 
 * Provides unified historical time-series data access across all metrics and geographies.
 * This service dynamically routes queries to the appropriate Supabase table based on
 * the metric ID and geography level.
 * 
 * EXPLANATION: Your backend uses Supabase (PostgreSQL) not TypeORM entities.
 * All data is queried using the Supabase client which provides a simple API for database operations.
 * The service maps frontend metric IDs to the correct database table and metric_name field.
 */
@Injectable()
export class TimeSeriesService {
    constructor(
        @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    ) { }

    /**
     * Get time series data for a specific metric/geography/region
     */
    async getTimeSeries(
        metricId: string,
        geoLevel: string,
        regionId: string,
        startDate?: string,
        endDate?: string,
        limit?: number,
    ): Promise<TimeSeriesDataPoint[]> {
        // Map metric to source table and field
        const mapping = this.getMetricMapping(metricId);
        if (!mapping) {
            throw new Error(`Unknown metric: ${metricId}`);
        }

        // Build query based on geography level and source
        const query = this.buildQuery(mapping, geoLevel, regionId, startDate, endDate, limit);

        const { data, error } = await query;

        if (error) {
            throw new Error(`Error fetching time series for ${metricId}: ${error.message}`);
        }

        if (!data || data.length === 0) return [];

        // Transform to standard format
        return data.map(row => ({
            date: row.period_date,
            value: Number(row.value),
        }));
    }

    /**
     * Get available date range for a metric/geography
     */
    async getAvailableDates(metricId: string, geoLevel: string): Promise<DateRange> {
        const mapping = this.getMetricMapping(metricId);
        if (!mapping) {
            throw new Error(`Unknown metric: ${metricId}`);
        }

        const table = this.getTableName(mapping.source, geoLevel);
        if (!table) {
            throw new Error(`No data available for ${metricId} at ${geoLevel} level`);
        }

        // Query for date range
        const { data, error } = await this.supabase
            .from(table)
            .select('period_date')
            .eq('metric_name', mapping.metricName)
            .order('period_date', { ascending: true });

        if (error || !data || data.length === 0) {
            return {
                minDate: '',
                maxDate: '',
                count: 0,
            };
        }

        const dates = data.map(d => d.period_date);
        const uniqueDates = [...new Set(dates)];

        return {
            minDate: uniqueDates[0],
            maxDate: uniqueDates[uniqueDates.length - 1],
            count: uniqueDates.length,
        };
    }

    /**
     * Build Supabase query based on metric mapping, geography, and filters
     */
    private buildQuery(
        mapping: { source: string; metricName: string; field: string },
        geoLevel: string,
        regionId: string,
        startDate?: string,
        endDate?: string,
        limit?: number,
    ) {
        const table = this.getTableName(mapping.source, geoLevel);
        if (!table) {
            throw new Error(`No table found for ${mapping.source} at ${geoLevel} level`);
        }

        let query = this.supabase
            .from(table)
            .select('period_date, value')
            .eq('metric_name', mapping.metricName)
            .order('period_date', { ascending: true });

        // Add region filter based on geography
        query = this.addRegionFilter(query, geoLevel, regionId);

        // Add date filters
        if (startDate) {
            query = query.gte('period_date', startDate);
        }
        if (endDate) {
            query = query.lte('period_date', endDate);
        }

        // Add limit
        if (limit) {
            query = query.limit(limit);
        }

        return query;
    }

    /**
     * Add region-specific filter to query based on geography level
     */
    private addRegionFilter(query: any, geoLevel: string, regionId: string) {
        switch (geoLevel.toLowerCase()) {
            case 'national':
                return query.eq('region_name', 'United States');
            case 'state':
                return query.eq('region_name', regionId);
            case 'metro':
                return query.eq('cbsa_code', regionId);
            case 'county':
                return query.eq('fips_code', regionId);
            case 'zip':
                return query.eq('region_name', regionId); // ZIP codes use region_name
            case 'city':
                return query.eq('region_name', regionId);
            default:
                return query.eq('region_id', regionId);
        }
    }

    /**
     * Get table name based on data source and geography level
     */
    private getTableName(source: string, geoLevel: string): string | null {
        const level = geoLevel.toLowerCase();

        // Zillow tables
        if (source === 'zillow') {
            if (level === 'metro') return 'zillow_metro';
            if (level === 'state') return 'zillow_state';
            if (level === 'county') return 'zillow_county';
            if (level === 'zip') return 'zillow_zip';
            if (level === 'city') return 'zillow_city';
        }

        // Realtor tables
        if (source === 'realtor') {
            if (level === 'national') return 'realtor_national';
            if (level === 'metro') return 'realtor_metro';
            if (level === 'state') return 'realtor_state';
            if (level === 'county') return 'realtor_county';
            if (level === 'zip') return 'realtor_zip';
        }

        // TODO: Add support for:
        // - Census demographics tables
        // - Economic indicators tables  
        // - Calculated metrics tables

        return null;
    }

    /**
     * Map metric ID to database table source, metric_name field, and value field
     * 
     * In your database schema, most tables have:
     * - metric_name: the specific metric identifier (e.g., 'zhvi', 'zori', 'median_listing_price')
     * - value: the numeric value
     * - period_date: the date
     */
    private getMetricMapping(metricId: string): { source: string; metricName: string; field: string } | null {
        const mappings: Record<string, { source: string; metricName: string; field: string }> = {
            // Zillow ZHVI (Home Value)
            'home_value': { source: 'zillow', metricName: 'zhvi', field: 'value' },

            // Zillow Forecast
            'home_price_forecast': { source: 'zillow', metricName: 'zhvf_12m', field: 'value' },

            // Zillow Rent (ZORI)
            'rent_index': { source: 'zillow', metricName: 'zori', field: 'value' },

            // Zillow Renter Demand (ZORDI)
            'rent_for_houses': { source: 'zillow', metricName: 'zordi_sfr', field: 'value' },

            // Zillow Market Indicators
            'for_sale_inventory': { source: 'zillow', metricName: 'inventory', field: 'value' },
            'new_listings': { source: 'zillow', metricName: 'new_listings', field: 'value' },
            'pending_listings': { source: 'zillow', metricName: 'pending_listings', field: 'value' },
            'home_sales': { source: 'zillow', metricName: 'sales_count', field: 'value' },
            'days_on_market': { source: 'zillow', metricName: 'days_to_pending', field: 'value' },
            'sale_to_list': { source: 'zillow', metricName: 'sale_to_list', field: 'value' },
            'market_heat': { source: 'zillow', metricName: 'market_heat_index', field: 'value' },

            // Zillow Price Cuts
            'price_cut_pct': { source: 'zillow', metricName: 'price_cut_share', field: 'value' },

            // Zillow New Construction
            'new_construction_sales': { source: 'zillow', metricName: 'new_con_sales', field: 'value' },
            'new_construction_price': { source: 'zillow', metricName: 'new_con_median_price', field: 'value' },
            'new_construction_ppsf': { source: 'zillow', metricName: 'new_con_median_price_per_sqft', field: 'value' },

            // Realtor Listing Price (uses median_listing_price from realtor tables)
            'listing_price': { source: 'realtor', metricName: 'median_listing_price', field: 'value' },
            'price_per_sqft': { source: 'realtor', metricName: 'median_listing_price_per_square_foot', field: 'value' },

            // Realtor Growth Rates
            'home_value_yoy': { source: 'realtor', metricName: 'median_listing_price_yy', field: 'value' },
            'home_value_mom': { source: 'realtor', metricName: 'median_listing_price_mm', field: 'value' },

            // Realtor Inventory
            'inventory_yoy': { source: 'realtor', metricName: 'active_listing_count_yy', field: 'value' },
            'new_listings_yoy': { source: 'realtor', metricName: 'new_listing_count_yy', field: 'value' },

            // Realtor Market Metrics
            'pending_ratio': { source: 'realtor', metricName: 'pending_ratio', field: 'value' },
            'price_increase_pct': { source: 'realtor', metricName: 'price_increased_share', field: 'value' },
        };

        return mappings[metricId] || null;
    }
}
